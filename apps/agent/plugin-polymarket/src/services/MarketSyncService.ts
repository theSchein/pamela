/**
 * Market Sync Service for Polymarket Plugin
 * Handles periodic synchronization of market data from Polymarket API to local database
 */

import { type IAgentRuntime, logger, Service } from "@elizaos/core";
import { eq, and, sql, lt } from "drizzle-orm";
import { randomUUID } from "crypto";
import { initializeClobClient, type ClobClient } from "../utils/clobClient";
import {
  initializePolymarketTables,
  checkPolymarketTablesExist,
} from "../utils/databaseInit";
import {
  polymarketMarketsTable,
  polymarketTokensTable,
  polymarketRewardsTable,
  polymarketSyncStatusTable,
  type NewPolymarketMarket,
  type NewPolymarketToken,
  type NewPolymarketReward,
  type NewPolymarketSyncStatus,
} from "../schema";
import type { Market, MarketsResponse } from "../types";

/**
 * Service responsible for syncing Polymarket data with local database
 */
export class MarketSyncService extends Service {
  static serviceType = "polymarket-sync";
  capabilityDescription =
    "Syncs Polymarket market data to local database on a 12-hour schedule";

  private clobClient: ClobClient | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
  private readonly MAX_PAGES = 10; // Fetch up to 10 pages if needed for pagination
  private readonly PAGE_SIZE = 500; // Markets per page (Gamma API default)
  private readonly MAX_MARKETS = 5000; // Maximum markets to sync in one run
  private isRunning = false;

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  /**
   * Start the market sync service
   */
  static async start(runtime: IAgentRuntime): Promise<MarketSyncService> {
    logger.info("*** Starting Polymarket Market Sync Service ***");

    const service = new MarketSyncService(runtime);

    try {
      // Initialize CLOB client
      service.clobClient = await initializeClobClient(runtime);
      logger.info("Market sync service: CLOB client initialized");

      // Set up recurring sync every 12 hours (will handle database availability internally)
      service.setupRecurringSync();

      // Schedule initial sync after a delay to allow database initialization
      setTimeout(async () => {
        try {
          await service.testDatabaseConnection();
          await service.performSync("startup");
        } catch (error) {
          logger.warn(
            "Initial startup sync failed, will retry on next scheduled sync:",
            error,
          );
        }
      }, 5000); // Wait 5 seconds before first sync attempt

      logger.info("Market sync service started successfully");
      return service;
    } catch (error) {
      logger.error("Failed to start market sync service:", error);
      throw error;
    }
  }

  /**
   * Stop the market sync service
   */
  static async stop(runtime: IAgentRuntime): Promise<void> {
    logger.info("*** Stopping Polymarket Market Sync Service ***");

    const service = runtime.getService(
      MarketSyncService.serviceType,
    ) as MarketSyncService;
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

    logger.info("Market sync service stopped");
  }

  /**
   * Set up recurring sync every 12 hours
   */
  private setupRecurringSync(): void {
    this.syncInterval = setInterval(async () => {
      if (!this.isRunning) {
        await this.performSync("scheduled");
      }
    }, this.SYNC_INTERVAL_MS);

    logger.info(
      `Recurring market sync scheduled every ${this.SYNC_INTERVAL_MS / 1000 / 60 / 60} hours`,
    );
  }

  /**
   * Perform a complete sync of market data
   */
  async performSync(
    syncType: "startup" | "scheduled" | "manual",
    searchTerm?: string,
  ): Promise<void> {
    if (this.isRunning) {
      logger.warn("Sync already in progress, skipping...");
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    // Check database availability first
    const db = (this.runtime as any).db;
    if (!db) {
      logger.warn(
        `Database not available for ${syncType} sync, will retry later`,
      );
      this.isRunning = false;
      return;
    }

    try {
      logger.info(`Starting ${syncType} market sync...`);

      // Fetch active markets from Polymarket API
      const markets = searchTerm 
        ? await this.fetchFromGammaApi(searchTerm)
        : await this.fetchActiveMarkets();
      logger.info(`Fetched ${markets.length} active markets from API${searchTerm ? ` for search term: ${searchTerm}` : ''}`);

      // Sync markets to database
      let syncedCount = 0;
      const totalMarkets = markets.length;
      const logInterval = Math.max(100, Math.floor(totalMarkets / 10)); // Log progress every 10% or 100 markets
      
      for (let i = 0; i < markets.length; i++) {
        const market = markets[i];
        try {
          await this.syncMarketToDatabase(market);
          syncedCount++;
          
          // Log progress at intervals
          if ((i + 1) % logInterval === 0 || i === markets.length - 1) {
            const progress = ((i + 1) / totalMarkets * 100).toFixed(1);
            logger.info(`Sync progress: ${i + 1}/${totalMarkets} markets (${progress}%)`);
          }
        } catch (error) {
          logger.error(`Failed to sync market ${market.condition_id}:`, error);
        }
      }

      const duration = Date.now() - startTime;
      // Clean up old/expired markets from database
      try {
        await this.cleanupOldMarkets();
      } catch (cleanupError) {
        logger.error("Failed to cleanup old markets:", cleanupError);
      }

      logger.info(
        `Market sync completed: ${syncedCount}/${markets.length} markets synced in ${duration}ms`,
      );
    } catch (error) {
      logger.error("Market sync failed:", error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Fetch active markets from Gamma API with liquidity filtering
   * Only use markets with real trading activity ($10k+ liquidity)
   */
  private async fetchActiveMarkets(): Promise<Market[]> {
    logger.info("Fetching high-liquidity markets from Gamma API only...");

    const gammaMarkets = await this.fetchFromGammaApi();

    if (gammaMarkets.length > 0) {
      logger.info(
        `Gamma API provided ${gammaMarkets.length} liquid markets with $10k+ liquidity`,
      );
      return gammaMarkets;
    }

    logger.warn(
      "Gamma API returned no markets - this may indicate an API issue or no markets meet $10k liquidity threshold",
    );
    return [];
  }

  /**
   * Fetch markets from Gamma API with liquidity filtering
   */
  private async fetchFromGammaApi(searchTerm?: string): Promise<Market[]> {
    try {
      logger.info("Attempting to fetch from Gamma API...");

      const gammaUrl = "https://gamma-api.polymarket.com/markets";

      // Build query parameters for active markets with real volume (indicates actual trading)
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
      const params = new URLSearchParams({
        limit: String(this.MAX_MARKETS), // Fetch up to 5000 markets
        active: "true",
        volume_num_min: "100", // Lower threshold to catch more niche markets like F1
        closed: "false",
        end_date_min: today, // Only markets ending today or later
      });

      // Add search term if provided
      if (searchTerm) {
        params.append("search", searchTerm);
        logger.info(`Adding search term to Gamma API: ${searchTerm}`);
      }

      logger.info(`Gamma API query: ${gammaUrl}?${params.toString()}`);

      // Note: Gamma API may not support pagination, but we'll try to get as many as possible
      const response = await fetch(`${gammaUrl}?${params}`);

      if (!response.ok) {
        throw new Error(
          `Gamma API returned ${response.status}: ${response.statusText}`,
        );
      }

      const data: any = await response.json();
      // Gamma API returns array directly, not nested in data/markets field
      const markets = Array.isArray(data)
        ? data
        : data.markets || data.data || [];

      logger.info(`Gamma API returned ${markets.length} markets`);

      // Log first market to debug the transformation
      if (markets.length > 0) {
        const firstMarket = markets[0];
        logger.info(`Debug: First raw market from Gamma API:`, {
          conditionId: firstMarket.conditionId,
          question: firstMarket.question?.substring(0, 50),
          endDate: firstMarket.endDate,
          endDateIso: firstMarket.endDateIso,
          liquidity: firstMarket.liquidity,
          liquidityNum: firstMarket.liquidityNum,
          active: firstMarket.active,
          closed: firstMarket.closed,
        });
      }

      // Transform Gamma API format to match expected Market interface
      const transformedMarkets = markets.map((market: any) => {
        const transformed = {
          condition_id: market.conditionId,
          question_id: market.questionID || market.id,
          question: market.question,
          market_slug: market.slug,
          category: market.category || "General",
          end_date_iso: market.endDate || market.endDateIso,
          game_start_time: market.startDate || market.startDateIso,
          active: market.active,
          closed: market.closed,
          minimum_order_size: market.orderMinSize || null,
          minimum_tick_size: market.orderPriceMinTickSize || null,
          min_incentive_size: market.rewardsMinSize || null,
          max_incentive_spread: market.rewardsMaxSpread || null,
          seconds_delay: 0,
          icon: market.icon || market.image,
          fpmm: market.marketMakerAddress || null,
          tokens: market.clobTokenIds
            ? JSON.parse(market.clobTokenIds).map(
                (tokenId: string, index: number) => ({
                  token_id: tokenId,
                  outcome: market.outcomes
                    ? JSON.parse(market.outcomes)[index]
                    : `Outcome ${index + 1}`,
                }),
              )
            : [],
          rewards: market.rewardsMinSize
            ? {
                min_size: market.rewardsMinSize,
                max_spread: market.rewardsMaxSpread,
              }
            : null,
          // Add Gamma API specific fields
          liquidityNum: parseFloat(
            market.liquidity || market.liquidityNum || "0",
          ),
          volumeNum: parseFloat(market.volume || market.volumeNum || "0"),
        };

        // Log first transformed market for debugging
        if (market === markets[0]) {
          logger.info(`Debug: First transformed market:`, {
            condition_id: transformed.condition_id,
            question: transformed.question?.substring(0, 50),
            end_date_iso: transformed.end_date_iso,
            liquidityNum: transformed.liquidityNum,
            active: transformed.active,
            closed: transformed.closed,
          });
        }

        return transformed;
      });

      // Filter markets - with liquidity filtering, we can be less aggressive on dates
      const now = new Date();
      let filteredOutCount = 0;
      const filteredMarkets = transformedMarkets.filter(
        (market: any, index: number) => {
          // Keep markets with no end date (often perpetual/ongoing)
          if (!market.end_date_iso) {
            if (index < 3)
              logger.info(
                `Debug: Keeping market with no end date: "${market.question?.substring(0, 50)}"`,
              );
            return true;
          }

          // Only filter out markets that ended more than 24 hours ago
          const endDate = new Date(market.end_date_iso);
          const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          const shouldKeep = endDate > oneDayAgo;

          if (!shouldKeep) {
            filteredOutCount++;
            if (filteredOutCount <= 3) {
              const hoursAgo = Math.floor(
                (now.getTime() - endDate.getTime()) / (60 * 60 * 1000),
              );
              logger.info(
                `Debug: Filtering out old market: "${market.question?.substring(0, 50)}" (ended ${hoursAgo} hours ago)`,
              );
            }
          } else {
            if (index < 3) {
              const hoursFromNow = Math.floor(
                (endDate.getTime() - now.getTime()) / (60 * 60 * 1000),
              );
              logger.info(
                `Debug: Keeping future market: "${market.question?.substring(0, 50)}" (ends in ${hoursFromNow} hours)`,
              );
            }
          }

          return shouldKeep; // Much more permissive - liquidity filter is doing the heavy lifting
        },
      );

      logger.info(
        `Debug: Filtered out ${filteredOutCount} old markets, kept ${filteredMarkets.length} current markets`,
      );

      logger.info(
        `Gamma API: Transformed and filtered to ${filteredMarkets.length} current markets`,
      );

      // Log a few examples to verify the transformation
      if (filteredMarkets.length > 0) {
        const example = filteredMarkets[0];
        logger.info(
          `Example Gamma market: "${example.question?.substring(0, 50)}..." liquidity=$${example.liquidityNum?.toFixed(0)}`,
        );
      }

      return filteredMarkets;
    } catch (error) {
      logger.error("Failed to fetch from Gamma API:", error);
      return []; // Return empty array instead of throwing
    }
  }

  /**
   * Sync a single market to the database (upsert)
   */
  private async syncMarketToDatabase(market: Market): Promise<void> {
    const db = (this.runtime as any).db;
    if (!db) {
      throw new Error("Database not available");
    }

    // Check if tables exist and create them if they don't
    const tablesExist = await checkPolymarketTablesExist(db);
    if (!tablesExist) {
      logger.info(
        "Polymarket tables do not exist, attempting to create them...",
      );
      const initialized = await initializePolymarketTables(db);
      if (!initialized) {
        logger.error("Failed to initialize database tables, skipping sync");
        return;
      }
      logger.info("Database tables created successfully");
    }

    try {
      // Test database connection and table existence after initialization
      logger.info("Testing database connection and table existence...");
      const testResult = await db
        .select()
        .from(polymarketMarketsTable)
        .limit(1);
      logger.info(
        `Database test successful, found ${testResult.length} existing markets`,
      );
    } catch (dbTestError) {
      logger.error(
        "Database connection or table test failed after initialization:",
        dbTestError,
      );

      // Log more specific error info for database errors
      if (dbTestError instanceof Error) {
        logger.error("Database test error details:", {
          message: dbTestError.message,
          name: dbTestError.name,
        });
      }

      logger.warn("Database not ready for sync, skipping market sync");
      return; // Don't throw error, just skip sync
    }

    try {
      await db.transaction(async (tx: any) => {
        // Validate required fields
        if (
          !market.condition_id ||
          !market.question_id ||
          !market.question ||
          !market.market_slug
        ) {
          logger.warn(`Skipping market with missing required fields:`, {
            condition_id: market.condition_id,
            question_id: market.question_id,
            question: market.question?.substring(0, 50),
            market_slug: market.market_slug,
          });
          return;
        }

        // FINAL SAFETY CHECK: Reject markets from previous years or already ended
        if (market.end_date_iso) {
          const endDate = new Date(market.end_date_iso);
          const currentDate = new Date();
          const marketYear = endDate.getFullYear();
          const currentYear = currentDate.getFullYear();

          // Reject anything from previous years completely
          if (marketYear < currentYear) {
            logger.error(`🚫 BLOCKING OLD YEAR MARKET (${marketYear}):`, {
              condition_id: market.condition_id,
              question: market.question?.substring(0, 100),
              end_date: market.end_date_iso,
              market_year: marketYear,
              current_year: currentYear,
              market_active_flag: market.active,
              market_closed_flag: market.closed,
            });
            return;
          }

          // Also reject if already ended
          if (endDate <= currentDate) {
            const daysAgo = Math.floor(
              (currentDate.getTime() - endDate.getTime()) /
                (24 * 60 * 60 * 1000),
            );
            logger.error(
              `🚫 BLOCKING EXPIRED MARKET (ended ${daysAgo} days ago):`,
              {
                condition_id: market.condition_id,
                question: market.question?.substring(0, 100),
                end_date: market.end_date_iso,
                days_ago: daysAgo,
                current_time: currentDate.toISOString(),
                market_active_flag: market.active,
                market_closed_flag: market.closed,
              },
            );
            return;
          } else {
            const daysFromNow = Math.floor(
              (endDate.getTime() - currentDate.getTime()) /
                (24 * 60 * 60 * 1000),
            );
            logger.info(
              `✅ ALLOWING CURRENT MARKET: "${market.question?.substring(0, 50)}..." (ends ${daysFromNow} days from now)`,
            );
          }
        } else {
          // Market has no end date - log this case for debugging
          logger.warn(`⚠️  MARKET WITH NO END DATE:`, {
            condition_id: market.condition_id,
            question: market.question?.substring(0, 100),
            market_active_flag: market.active,
            market_closed_flag: market.closed,
          });
        }

        // Upsert market
        const marketData = {
          conditionId: market.condition_id,
          questionId: market.question_id,
          question: market.question,
          marketSlug: market.market_slug,
          category: market.category || null,
          endDateIso: market.end_date_iso
            ? new Date(market.end_date_iso)
            : null,
          gameStartTime: market.game_start_time
            ? new Date(market.game_start_time)
            : null,
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
          logger.info(
            `Attempting to insert market: ${marketData.conditionId} - "${marketData.question}"`,
          );

          // Generate UUID explicitly to avoid default value issues
          const marketUuid = randomUUID();

          await tx
            .insert(polymarketMarketsTable)
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
              lastSyncedAt: new Date(),
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
                updatedAt: new Date(),
              },
            });

          logger.info(
            `Successfully inserted/updated market: ${marketData.conditionId}`,
          );
        } catch (insertError) {
          logger.error(
            `Database insertion failed for market ${marketData.conditionId}:`,
            {
              error: insertError,
              marketData: {
                conditionId: marketData.conditionId,
                question: marketData.question?.substring(0, 50) + "...",
                category: marketData.category,
                active: marketData.active,
                closed: marketData.closed,
              },
            },
          );

          // Log the specific SQL error details
          if (insertError instanceof Error) {
            logger.error("SQL Error details:", {
              message: insertError.message,
              name: insertError.name,
              stack: insertError.stack?.split("\n").slice(0, 5),
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
            await tx
              .insert(polymarketTokensTable)
              .values({
                id: tokenUuid,
                tokenId: tokenData.tokenId,
                conditionId: tokenData.conditionId,
                outcome: tokenData.outcome,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: polymarketTokensTable.tokenId,
                set: {
                  conditionId: tokenData.conditionId,
                  outcome: tokenData.outcome,
                  updatedAt: new Date(),
                },
              });
          }
        }

        // Sync rewards if available
        if (market.rewards) {
          const rewardData = {
            conditionId: market.condition_id,
            minSize: market.rewards.min_size
              ? String(market.rewards.min_size)
              : null,
            maxSpread: market.rewards.max_spread
              ? String(market.rewards.max_spread)
              : null,
            eventStartDate: market.rewards.event_start_date || null,
            eventEndDate: market.rewards.event_end_date || null,
            inGameMultiplier: market.rewards.in_game_multiplier
              ? String(market.rewards.in_game_multiplier)
              : null,
            rewardEpoch: market.rewards.reward_epoch || null,
          };

          const rewardUuid = randomUUID();
          await tx
            .insert(polymarketRewardsTable)
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
              updatedAt: new Date(),
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
                updatedAt: new Date(),
              },
            });
        }
      });
    } catch (error) {
      logger.error(
        `Failed to sync market ${market.condition_id} to database:`,
        error,
      );

      // If database sync fails, log the market data for manual inspection
      logger.info(`Market data that failed to sync:`, {
        condition_id: market.condition_id,
        question_id: market.question_id,
        market_slug: market.market_slug,
        question: market.question?.substring(0, 100),
        category: market.category,
        active: market.active,
        closed: market.closed,
        end_date_iso: market.end_date_iso,
      });

      // Don't throw error to prevent stopping the entire sync process
      logger.warn(
        `Continuing sync process despite database error for market ${market.condition_id}`,
      );
    }
  }

  /**
   * Clean up old/expired markets from the database
   */
  private async cleanupOldMarkets(): Promise<void> {
    const db = (this.runtime as any).db;
    if (!db) {
      return;
    }

    try {
      const currentDate = new Date();
      // Delete markets that ended more than 30 days ago
      const cleanupThreshold = new Date(
        currentDate.getTime() - 30 * 24 * 60 * 60 * 1000,
      );

      const deletedCount = await db
        .delete(polymarketMarketsTable)
        .where(
          and(
            sql`${polymarketMarketsTable.endDateIso} IS NOT NULL`,
            lt(polymarketMarketsTable.endDateIso, cleanupThreshold),
          ),
        );

      if (deletedCount && deletedCount.rowCount > 0) {
        logger.info(
          `Cleaned up ${deletedCount.rowCount} old markets that ended before ${cleanupThreshold.toISOString()}`,
        );
      }
    } catch (error) {
      logger.error("Error during market cleanup:", error);
      throw error;
    }
  }

  /**
   * Create a sync status record
   */
  private async createSyncStatus(syncType: string): Promise<string> {
    const db = (this.runtime as any).db;
    if (!db) {
      throw new Error("Database not available");
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
          syncStatus: "running",
          metadata: {
            startTime: new Date().toISOString(),
            maxPages: this.MAX_PAGES,
          },
        })
        .where(eq(polymarketSyncStatusTable.id, syncId));

      return syncId;
    } catch (error) {
      logger.error("Failed to create sync status record:", error);
      throw error;
    }
  }

  /**
   * Update sync status record
   */
  private async updateSyncStatus(
    id: string,
    status: "success" | "error",
    errorMessage: string | null,
    recordsProcessed: number,
  ): Promise<void> {
    const db = (this.runtime as any).db;
    if (!db) {
      throw new Error("Database not available");
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
  async getLastSync(): Promise<{
    lastSyncAt: Date;
    recordsProcessed: number;
  } | null> {
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
            eq(polymarketSyncStatusTable.syncStatus, "success"),
            eq(polymarketSyncStatusTable.syncType, "markets_scheduled"),
          ),
        )
        .orderBy(polymarketSyncStatusTable.lastSyncAt)
        .limit(1);

      return result[0] || null;
    } catch (error) {
      logger.error("Failed to get last sync info:", error);
      return null;
    }
  }

  /**
   * Force a manual sync (useful for testing or admin actions)
   */
  async forceSync(): Promise<void> {
    await this.performSync("manual");
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
        logger.info("Database is available for market sync service");
        return;
      }

      logger.info(
        `Waiting for database to become available (attempt ${i + 1}/${maxRetries})...`,
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }

    throw new Error("Database did not become available within timeout");
  }

  /**
   * Test database connection and log available properties
   */
  async testDatabaseConnection(): Promise<void> {
    logger.info("Testing database connection...");

    // Check different possible database access patterns
    const runtime = this.runtime as any;

    logger.info("Runtime properties:", {
      hasDatabase: !!runtime.database,
      hasDatabaseAdapter: !!runtime.databaseAdapter,
      hasDb: !!runtime.db,
      runtimeKeys: Object.keys(runtime).filter(
        (k) =>
          k.toLowerCase().includes("db") || k.toLowerCase().includes("data"),
      ),
    });

    if (runtime.databaseAdapter) {
      logger.info("DatabaseAdapter properties:", {
        hasDb: !!runtime.databaseAdapter.db,
        adapterKeys: Object.keys(runtime.databaseAdapter),
      });
    }

    const db = runtime.db;
    if (db) {
      logger.info("Database connection test successful");
    } else {
      throw new Error("Database connection test failed - no database found");
    }
  }
}
