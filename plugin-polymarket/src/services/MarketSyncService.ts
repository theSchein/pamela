/**
 * Market Sync Service for Polymarket Plugin
 * Handles periodic synchronization of market data from Polymarket API to local database
 */

import { type IAgentRuntime, logger, Service } from '@elizaos/core';
import { eq, and, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { initializeClobClient, type ClobClient } from '../utils/clobClient';
import { initializePolymarketTables, checkPolymarketTablesExist } from '../utils/databaseInit';
import { 
  polymarketMarketsTable,
  polymarketTokensTable,
  polymarketRewardsTable,
  polymarketSyncStatusTable,
  type NewPolymarketMarket,
  type NewPolymarketToken,
  type NewPolymarketReward,
  type NewPolymarketSyncStatus,
} from '../schema';
import type { Market, MarketsResponse } from '../types';

/**
 * Service responsible for syncing Polymarket data with local database
 */
export class MarketSyncService extends Service {
  static serviceType = 'polymarket-sync';
  capabilityDescription = 'Syncs Polymarket market data to local database on a 12-hour schedule';
  
  private clobClient: ClobClient | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
  private readonly MAX_PAGES = 2; // Maximum pages to fetch (testing - increase to 50+ for production)
  private readonly PAGE_SIZE = 100; // Markets per page
  private isRunning = false;

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  /**
   * Start the market sync service
   */
  static async start(runtime: IAgentRuntime): Promise<MarketSyncService> {
    logger.info('*** Starting Polymarket Market Sync Service ***');
    
    const service = new MarketSyncService(runtime);
    
    try {
      // Initialize CLOB client
      service.clobClient = await initializeClobClient(runtime);
      logger.info('Market sync service: CLOB client initialized');
      
      // Set up recurring sync every 12 hours (will handle database availability internally)
      service.setupRecurringSync();
      
      // Schedule initial sync after a delay to allow database initialization
      setTimeout(async () => {
        try {
          await service.testDatabaseConnection();
          await service.performSync('startup');
        } catch (error) {
          logger.warn('Initial startup sync failed, will retry on next scheduled sync:', error);
        }
      }, 5000); // Wait 5 seconds before first sync attempt
      
      logger.info('Market sync service started successfully');
      return service;
    } catch (error) {
      logger.error('Failed to start market sync service:', error);
      throw error;
    }
  }

  /**
   * Stop the market sync service
   */
  static async stop(runtime: IAgentRuntime): Promise<void> {
    logger.info('*** Stopping Polymarket Market Sync Service ***');
    
    const service = runtime.getService(MarketSyncService.serviceType) as MarketSyncService;
    if (service) {
      await service.stop();
    }
  }

  /**
   * Stop service instance
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    logger.info('Market sync service stopped');
  }

  /**
   * Set up recurring sync every 12 hours
   */
  private setupRecurringSync(): void {
    this.syncInterval = setInterval(async () => {
      if (!this.isRunning) {
        await this.performSync('scheduled');
      }
    }, this.SYNC_INTERVAL_MS);
    
    logger.info(`Recurring market sync scheduled every ${this.SYNC_INTERVAL_MS / 1000 / 60 / 60} hours`);
  }

  /**
   * Perform a complete sync of market data
   */
  async performSync(syncType: 'startup' | 'scheduled' | 'manual'): Promise<void> {
    if (this.isRunning) {
      logger.warn('Sync already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    // Check database availability first
    const db = (this.runtime as any).db;
    if (!db) {
      logger.warn(`Database not available for ${syncType} sync, will retry later`);
      this.isRunning = false;
      return;
    }
    
    try {
      logger.info(`Starting ${syncType} market sync...`);
      
      // Fetch active markets from Polymarket API
      const markets = await this.fetchActiveMarkets();
      logger.info(`Fetched ${markets.length} active markets from API`);
      
      // Sync markets to database
      let syncedCount = 0;
      for (const market of markets) {
        try {
          await this.syncMarketToDatabase(market);
          syncedCount++;
        } catch (error) {
          logger.error(`Failed to sync market ${market.condition_id}:`, error);
        }
      }
      
      const duration = Date.now() - startTime;
      logger.info(`Market sync completed: ${syncedCount}/${markets.length} markets synced in ${duration}ms`);
      
    } catch (error) {
      logger.error('Market sync failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Fetch active markets from Polymarket API with pagination
   */
  private async fetchActiveMarkets(): Promise<Market[]> {
    if (!this.clobClient) {
      throw new Error('CLOB client not initialized');
    }

    try {
      const allMarkets: Market[] = [];
      let nextCursor = ''; // Start from beginning
      let pageCount = 0;
      const maxPages = this.MAX_PAGES;
      const pageSize = this.PAGE_SIZE;
      
      logger.info('Starting paginated market fetch...');
      
      do {
        pageCount++;
        logger.info(`Fetching page ${pageCount} with cursor: ${nextCursor || 'start'}`);
        
        // Fetch one page of markets (remove closed filter - let active markets through)
        const response: MarketsResponse = await (this.clobClient as any).getMarkets(nextCursor, {
          active: true,
          limit: pageSize,
        });

        const pageMarkets = response.data || [];
        allMarkets.push(...pageMarkets);
        
        logger.info(`Page ${pageCount}: fetched ${pageMarkets.length} markets, total so far: ${allMarkets.length}`);
        
        // Update cursor for next page
        nextCursor = response.next_cursor || '';
        
        // Safety checks
        if (pageCount >= maxPages) {
          logger.warn(`Reached maximum pages limit (${maxPages}), stopping pagination`);
          break;
        }
        
        if (pageMarkets.length === 0) {
          logger.info('Received empty page, stopping pagination');
          break;
        }
        
        // Small delay between requests to be respectful to API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } while (nextCursor && nextCursor !== 'LTE='); // Continue until no more pages
      
      logger.info(`Pagination complete: fetched ${allMarkets.length} total markets across ${pageCount} pages`);
      
      // Filter for truly active markets (future end dates)
      const currentDate = new Date();
      let totalActive = 0;
      let totalNonClosed = 0;
      let totalFuture = 0;
      
      const activeMarkets = allMarkets.filter((market) => {
        // Count totals for debugging
        if (market.active === true) totalActive++;
        if (market.closed === false) totalNonClosed++;
        
        // Since we already fetched active markets, just validate they're truly active
        const isActive = market.active === true;
        
        // Check if market end date is in the future (be more lenient)
        let isFutureOrCurrent = true;
        if (market.end_date_iso) {
          const endDate = new Date(market.end_date_iso);
          // Allow markets ending within the next 7 days (recent or upcoming)
          const sevenDaysAgo = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
          isFutureOrCurrent = endDate > sevenDaysAgo;
          if (isFutureOrCurrent) totalFuture++;
        }
        
        // For testing: just return active markets regardless of dates
        return isActive;
      });

      logger.info(`Filter breakdown: active=${totalActive}, nonClosed=${totalNonClosed}, futureEndDate=${totalFuture}, finalFiltered=${activeMarkets.length}`);

      logger.info(`Filtered ${activeMarkets.length} active markets from ${allMarkets.length} total markets`);
      return activeMarkets;
      
    } catch (error) {
      logger.error('Failed to fetch markets from API:', error);
      throw error;
    }
  }

  /**
   * Sync a single market to the database (upsert)
   */
  private async syncMarketToDatabase(market: Market): Promise<void> {
    const db = (this.runtime as any).db;
    if (!db) {
      throw new Error('Database not available');
    }

    // Check if tables exist and create them if they don't
    const tablesExist = await checkPolymarketTablesExist(db);
    if (!tablesExist) {
      logger.info('Polymarket tables do not exist, attempting to create them...');
      const initialized = await initializePolymarketTables(db);
      if (!initialized) {
        logger.error('Failed to initialize database tables, skipping sync');
        return;
      }
      logger.info('Database tables created successfully');
    }

    try {
      // Test database connection and table existence after initialization
      logger.info('Testing database connection and table existence...');
      const testResult = await db.select().from(polymarketMarketsTable).limit(1);
      logger.info(`Database test successful, found ${testResult.length} existing markets`);
    } catch (dbTestError) {
      logger.error('Database connection or table test failed after initialization:', dbTestError);
      
      // Log more specific error info for database errors
      if (dbTestError instanceof Error) {
        logger.error('Database test error details:', {
          message: dbTestError.message,
          name: dbTestError.name
        });
      }
      
      logger.warn('Database not ready for sync, skipping market sync');
      return; // Don't throw error, just skip sync
    }

    try {
      await db.transaction(async (tx: any) => {
        // Validate required fields
        if (!market.condition_id || !market.question_id || !market.question || !market.market_slug) {
          logger.warn(`Skipping market with missing required fields:`, {
            condition_id: market.condition_id,
            question_id: market.question_id,
            question: market.question?.substring(0, 50),
            market_slug: market.market_slug,
          });
          return;
        }

        // Upsert market
        const marketData = {
          conditionId: market.condition_id,
          questionId: market.question_id,
          question: market.question,
          marketSlug: market.market_slug,
          category: market.category || null,
          endDateIso: market.end_date_iso ? new Date(market.end_date_iso) : null,
          gameStartTime: market.game_start_time ? new Date(market.game_start_time) : null,
          active: market.active,
          closed: market.closed,
          minimumOrderSize: market.minimum_order_size || null,
          minimumTickSize: market.minimum_tick_size || null,
          minIncentiveSize: market.min_incentive_size || null,
          maxIncentiveSpread: market.max_incentive_spread || null,
          secondsDelay: market.seconds_delay || 0,
          icon: market.icon || null,
          fpmm: market.fpmm || null,
        };

        // Try to insert market with better error handling
        try {
          logger.info(`Attempting to insert market: ${marketData.conditionId} - "${marketData.question}"`);
          
          // Generate UUID explicitly to avoid default value issues
          const marketUuid = randomUUID();
          
          await tx.insert(polymarketMarketsTable)
            .values({
              id: marketUuid,
              conditionId: marketData.conditionId,
              questionId: marketData.questionId,
              marketSlug: marketData.marketSlug,
              question: marketData.question,
              category: marketData.category,
              endDateIso: marketData.endDateIso,
              gameStartTime: marketData.gameStartTime,
              active: marketData.active,
              closed: marketData.closed,
              minimumOrderSize: marketData.minimumOrderSize,
              minimumTickSize: marketData.minimumTickSize,
              minIncentiveSize: marketData.minIncentiveSize,
              maxIncentiveSpread: marketData.maxIncentiveSpread,
              secondsDelay: marketData.secondsDelay,
              icon: marketData.icon,
              fpmm: marketData.fpmm,
              createdAt: new Date(),
              updatedAt: new Date(),
              lastSyncedAt: new Date()
            })
            .onConflictDoUpdate({
              target: polymarketMarketsTable.conditionId,
              set: {
                questionId: marketData.questionId,
                marketSlug: marketData.marketSlug,
                question: marketData.question,
                category: marketData.category,
                endDateIso: marketData.endDateIso,
                gameStartTime: marketData.gameStartTime,
                active: marketData.active,
                closed: marketData.closed,
                minimumOrderSize: marketData.minimumOrderSize,
                minimumTickSize: marketData.minimumTickSize,
                minIncentiveSize: marketData.minIncentiveSize,
                maxIncentiveSpread: marketData.maxIncentiveSpread,
                secondsDelay: marketData.secondsDelay,
                icon: marketData.icon,
                fpmm: marketData.fpmm,
                lastSyncedAt: new Date(),
                updatedAt: new Date()
              }
            });
          
          logger.info(`Successfully inserted/updated market: ${marketData.conditionId}`);
        } catch (insertError) {
          logger.error(`Database insertion failed for market ${marketData.conditionId}:`, {
            error: insertError,
            marketData: {
              conditionId: marketData.conditionId,
              question: marketData.question?.substring(0, 50) + '...',
              category: marketData.category,
              active: marketData.active,
              closed: marketData.closed
            }
          });
          
          // Log the specific SQL error details
          if (insertError instanceof Error) {
            logger.error('SQL Error details:', {
              message: insertError.message,
              name: insertError.name,
              stack: insertError.stack?.split('\n').slice(0, 5)
            });
          }
          
          throw insertError;
        }

        // Sync tokens
        if (market.tokens && Array.isArray(market.tokens)) {
          for (const token of market.tokens) {
            const tokenData = {
              tokenId: token.token_id,
              conditionId: market.condition_id,
              outcome: token.outcome,
            };

            const tokenUuid = randomUUID();
            await tx.insert(polymarketTokensTable)
              .values({
                id: tokenUuid,
                tokenId: tokenData.tokenId,
                conditionId: tokenData.conditionId,
                outcome: tokenData.outcome,
                createdAt: new Date(),
                updatedAt: new Date()
              })
              .onConflictDoUpdate({
                target: polymarketTokensTable.tokenId,
                set: {
                  conditionId: tokenData.conditionId,
                  outcome: tokenData.outcome,
                  updatedAt: new Date()
                }
              });
          }
        }

        // Sync rewards if available
        if (market.rewards) {
          const rewardData = {
            conditionId: market.condition_id,
            minSize: market.rewards.min_size ? String(market.rewards.min_size) : null,
            maxSpread: market.rewards.max_spread ? String(market.rewards.max_spread) : null,
            eventStartDate: market.rewards.event_start_date || null,
            eventEndDate: market.rewards.event_end_date || null,
            inGameMultiplier: market.rewards.in_game_multiplier ? String(market.rewards.in_game_multiplier) : null,
            rewardEpoch: market.rewards.reward_epoch || null,
          };

          const rewardUuid = randomUUID();
          await tx.insert(polymarketRewardsTable)
            .values({
              id: rewardUuid,
              conditionId: rewardData.conditionId,
              minSize: rewardData.minSize,
              maxSpread: rewardData.maxSpread,
              eventStartDate: rewardData.eventStartDate,
              eventEndDate: rewardData.eventEndDate,
              inGameMultiplier: rewardData.inGameMultiplier,
              rewardEpoch: rewardData.rewardEpoch,
              createdAt: new Date(),
              updatedAt: new Date()
            })
            .onConflictDoUpdate({
              target: polymarketRewardsTable.conditionId,
              set: {
                minSize: rewardData.minSize,
                maxSpread: rewardData.maxSpread,
                eventStartDate: rewardData.eventStartDate,
                eventEndDate: rewardData.eventEndDate,
                inGameMultiplier: rewardData.inGameMultiplier,
                rewardEpoch: rewardData.rewardEpoch,
                updatedAt: new Date()
              }
            });
        }
      });

    } catch (error) {
      logger.error(`Failed to sync market ${market.condition_id} to database:`, error);
      
      // If database sync fails, log the market data for manual inspection
      logger.info(`Market data that failed to sync:`, {
        condition_id: market.condition_id,
        question_id: market.question_id,
        market_slug: market.market_slug,
        question: market.question?.substring(0, 100),
        category: market.category,
        active: market.active,
        closed: market.closed,
        end_date_iso: market.end_date_iso
      });
      
      // Don't throw error to prevent stopping the entire sync process
      logger.warn(`Continuing sync process despite database error for market ${market.condition_id}`);
    }
  }

  /**
   * Create a sync status record
   */
  private async createSyncStatus(syncType: string): Promise<string> {
    const db = (this.runtime as any).db;
    if (!db) {
      throw new Error('Database not available');
    }

    try {
      // First create with minimal data
      const result = await db
        .insert(polymarketSyncStatusTable)
        .values({
          syncType: `markets_${syncType}`,
        })
        .returning({ id: polymarketSyncStatusTable.id });

      const syncId = result[0].id;

      // Then update to set status to running
      await db
        .update(polymarketSyncStatusTable)
        .set({
          syncStatus: 'running',
          metadata: {
            startTime: new Date().toISOString(),
            maxPages: this.MAX_PAGES,
          },
        })
        .where(eq(polymarketSyncStatusTable.id, syncId));

      return syncId;
    } catch (error) {
      logger.error('Failed to create sync status record:', error);
      throw error;
    }
  }

  /**
   * Update sync status record
   */
  private async updateSyncStatus(
    id: string,
    status: 'success' | 'error',
    errorMessage: string | null,
    recordsProcessed: number
  ): Promise<void> {
    const db = (this.runtime as any).db;
    if (!db) {
      throw new Error('Database not available');
    }

    await db
      .update(polymarketSyncStatusTable)
      .set({
        syncStatus: status,
        errorMessage,
        recordsProcessed,
        lastSyncAt: new Date(),
        metadata: {
          endTime: new Date().toISOString(),
          status,
          recordsProcessed,
        },
        updatedAt: new Date(),
      })
      .where(eq(polymarketSyncStatusTable.id, id));
  }

  /**
   * Get the last successful sync information
   */
  async getLastSync(): Promise<{ lastSyncAt: Date; recordsProcessed: number } | null> {
    const db = (this.runtime as any).db;
    if (!db) {
      return null;
    }

    try {
      const result = await db
        .select({
          lastSyncAt: polymarketSyncStatusTable.lastSyncAt,
          recordsProcessed: polymarketSyncStatusTable.recordsProcessed,
        })
        .from(polymarketSyncStatusTable)
        .where(
          and(
            eq(polymarketSyncStatusTable.syncStatus, 'success'),
            eq(polymarketSyncStatusTable.syncType, 'markets_scheduled')
          )
        )
        .orderBy(polymarketSyncStatusTable.lastSyncAt)
        .limit(1);

      return result[0] || null;
    } catch (error) {
      logger.error('Failed to get last sync info:', error);
      return null;
    }
  }

  /**
   * Force a manual sync (useful for testing or admin actions)
   */
  async forceSync(): Promise<void> {
    await this.performSync('manual');
  }

  /**
   * Wait for database to become available
   */
  private async waitForDatabase(): Promise<void> {
    const maxRetries = 10;
    const retryDelay = 1000; // 1 second
    
    for (let i = 0; i < maxRetries; i++) {
      const db = (this.runtime as any).db;
      if (db) {
        logger.info('Database is available for market sync service');
        return;
      }
      
      logger.info(`Waiting for database to become available (attempt ${i + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
    
    throw new Error('Database did not become available within timeout');
  }

  /**
   * Test database connection and log available properties
   */
  async testDatabaseConnection(): Promise<void> {
    logger.info('Testing database connection...');
    
    // Check different possible database access patterns
    const runtime = this.runtime as any;
    
    logger.info('Runtime properties:', {
      hasDatabase: !!runtime.database,
      hasDatabaseAdapter: !!runtime.databaseAdapter,
      hasDb: !!runtime.db,
      runtimeKeys: Object.keys(runtime).filter(k => k.toLowerCase().includes('db') || k.toLowerCase().includes('data'))
    });
    
    if (runtime.databaseAdapter) {
      logger.info('DatabaseAdapter properties:', {
        hasDb: !!runtime.databaseAdapter.db,
        adapterKeys: Object.keys(runtime.databaseAdapter)
      });
    }
    
    const db = runtime.db;
    if (db) {
      logger.info('Database connection test successful');
    } else {
      throw new Error('Database connection test failed - no database found');
    }
  }
}