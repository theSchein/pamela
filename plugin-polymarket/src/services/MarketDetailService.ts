/**
 * Market Detail Service for Polymarket Plugin
 * Fetches detailed information for individual markets from the Polymarket API
 * and provides enhanced market data to users through conversational interface
 */

import { type IAgentRuntime, logger, Service } from "@elizaos/core";
import { eq, and, sql, like, or, gte } from "drizzle-orm";
import { initializeClobClient, type ClobClient } from "../utils/clobClient";
import {
  polymarketMarketsTable,
  polymarketTokensTable,
  type PolymarketMarket,
} from "../schema";
import type { Market } from "../types";

/**
 * Interface for market detail cache entry
 */
interface MarketDetailCache {
  conditionId: string;
  marketDetail: Market;
  fetchedAt: Date;
  expiresAt: Date;
}

/**
 * Service responsible for fetching detailed market information
 */
export class MarketDetailService extends Service {
  static serviceType = "polymarket-market-detail";
  capabilityDescription =
    "Fetches detailed market information from Polymarket API with smart caching";

  private clobClient: ClobClient | null = null;
  private marketCache: Map<string, MarketDetailCache> = new Map();
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes cache
  private readonly MAX_CACHE_SIZE = 100; // Maximum cached markets

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  /**
   * Start the market detail service
   */
  static async start(runtime: IAgentRuntime): Promise<MarketDetailService> {
    logger.info("*** Starting Polymarket Market Detail Service ***");

    const service = new MarketDetailService(runtime);

    try {
      // Initialize CLOB client
      service.clobClient = await initializeClobClient(runtime);
      logger.info("Market detail service: CLOB client initialized");

      logger.info("Market detail service started successfully");
      return service;
    } catch (error) {
      logger.error("Failed to start market detail service:", error);
      throw error;
    }
  }

  /**
   * Stop the market detail service
   */
  static async stop(runtime: IAgentRuntime): Promise<void> {
    logger.info("*** Stopping Polymarket Market Detail Service ***");

    const service = runtime.getService(
      MarketDetailService.serviceType,
    ) as MarketDetailService;
    if (service) {
      await service.stop();
    }
  }

  /**
   * Stop service instance
   */
  async stop(): Promise<void> {
    // Clear cache
    this.marketCache.clear();
    logger.info("Market detail service stopped");
  }

  /**
   * Get detailed information for a specific market by condition_id
   */
  async getMarketDetail(
    conditionId: string,
    useCache: boolean = true,
  ): Promise<Market | null> {
    try {
      // Check cache first if enabled
      if (useCache) {
        const cached = this.getFromCache(conditionId);
        if (cached) {
          logger.info(`Market detail cache hit for: ${conditionId}`);
          return cached.marketDetail;
        }
      }

      // Fetch from API
      if (!this.clobClient) {
        throw new Error("CLOB client not initialized");
      }

      logger.info(
        `Fetching market detail from API for condition_id: ${conditionId}`,
      );
      const marketDetail = await this.clobClient.getMarket(conditionId);

      if (!marketDetail) {
        logger.warn(`No market found for condition_id: ${conditionId}`);
        return null;
      }

      // Cache the result
      if (useCache) {
        this.cacheMarketDetail(conditionId, marketDetail);
      }

      logger.info(`Successfully fetched market detail for: ${conditionId}`);
      return marketDetail;
    } catch (error) {
      logger.error(`Failed to get market detail for ${conditionId}:`, error);
      throw error;
    }
  }

  /**
   * Search for markets in local database by question text
   */
  async searchMarkets(
    searchTerm: string,
    limit: number = 10,
  ): Promise<PolymarketMarket[]> {
    const db = (this.runtime as any).db;
    if (!db) {
      logger.warn("Database not available, returning empty results");
      return [];
    }

    try {
      // Ensure we have a valid search term and it's not too long
      if (!searchTerm || searchTerm.trim().length === 0) {
        logger.warn("Empty search term provided");
        return [];
      }

      const cleanSearchTerm = searchTerm.trim().toLowerCase();
      if (cleanSearchTerm.length > 100) {
        logger.warn(
          `Search term too long (${cleanSearchTerm.length} chars), truncating`,
        );
        const truncatedTerm = cleanSearchTerm.substring(0, 50);
        return this.searchMarkets(truncatedTerm, limit);
      }

      const searchPattern = `%${cleanSearchTerm}%`;

      // First try to check if table exists by doing a simple count
      try {
        const testQuery = await db
          .select()
          .from(polymarketMarketsTable)
          .where(eq(polymarketMarketsTable.active, true))
          .limit(1);

        logger.info(
          `Database connection test passed, found ${testQuery.length} active markets in sample`,
        );
      } catch (testError) {
        logger.error("Database table access failed:", testError);
        return [];
      }

      // Only show markets that are active and haven't ended yet
      const currentDate = new Date();
      // Use 1 hour buffer to exclude recently ended markets
      const minimumFutureDate = new Date(
        currentDate.getTime() + 60 * 60 * 1000,
      );

      const markets = await db
        .select()
        .from(polymarketMarketsTable)
        .where(
          and(
            eq(polymarketMarketsTable.active, true),
            eq(polymarketMarketsTable.closed, false),
            // Only include markets that end more than 1 hour from now
            or(
              sql`${polymarketMarketsTable.endDateIso} IS NULL`,
              sql`${polymarketMarketsTable.endDateIso} > ${minimumFutureDate}`,
            ),
            // Search criteria
            or(
              sql`LOWER(${polymarketMarketsTable.question}) LIKE ${searchPattern}`,
              sql`LOWER(${polymarketMarketsTable.category}) LIKE ${searchPattern}`,
              sql`LOWER(${polymarketMarketsTable.marketSlug}) LIKE ${searchPattern}`,
            ),
          ),
        )
        .limit(limit)
        .orderBy(sql`${polymarketMarketsTable.endDateIso} DESC`);

      logger.info(
        `Found ${markets.length} markets matching search term: "${searchTerm}"`,
      );
      return markets;
    } catch (error) {
      logger.error(`Failed to search markets for term "${searchTerm}":`, error);
      // Instead of throwing, return empty array for graceful degradation
      return [];
    }
  }

  /**
   * Get popular/trending markets (by category or recent activity)
   */
  async getPopularMarkets(
    category?: string,
    limit: number = 5,
  ): Promise<PolymarketMarket[]> {
    const db = (this.runtime as any).db;
    if (!db) {
      throw new Error("Database not available");
    }

    try {
      // Only show markets that are active and haven't ended yet
      const currentDate = new Date();
      // Use 1 hour buffer to exclude recently ended markets
      const minimumFutureDate = new Date(
        currentDate.getTime() + 60 * 60 * 1000,
      );

      const query = db
        .select()
        .from(polymarketMarketsTable)
        .where(
          and(
            eq(polymarketMarketsTable.active, true),
            eq(polymarketMarketsTable.closed, false),
            // Only include markets that end more than 1 hour from now
            or(
              sql`${polymarketMarketsTable.endDateIso} IS NULL`,
              sql`${polymarketMarketsTable.endDateIso} > ${minimumFutureDate}`,
            ),
            category ? eq(polymarketMarketsTable.category, category) : sql`1=1`,
          ),
        )
        .limit(limit)
        .orderBy(sql`${polymarketMarketsTable.endDateIso} DESC`);

      const markets = await query;

      logger.info(
        `Found ${markets.length} popular markets${category ? ` in category: ${category}` : ""}`,
      );
      return markets;
    } catch (error) {
      logger.error(`Failed to get popular markets:`, error);
      throw error;
    }
  }

  /**
   * Get market categories available in the database
   */
  async getMarketCategories(): Promise<string[]> {
    const db = (this.runtime as any).db;
    if (!db) {
      throw new Error("Database not available");
    }

    try {
      const result = await db
        .selectDistinct({ category: polymarketMarketsTable.category })
        .from(polymarketMarketsTable)
        .where(
          and(
            eq(polymarketMarketsTable.active, true),
            sql`${polymarketMarketsTable.category} IS NOT NULL`,
          ),
        )
        .orderBy(polymarketMarketsTable.category);

      const categories = result
        .map((row: any) => row.category)
        .filter(Boolean) as string[];

      logger.info(`Found ${categories.length} market categories`);
      return categories;
    } catch (error) {
      logger.error("Failed to get market categories:", error);
      throw error;
    }
  }

  /**
   * Get enhanced market information combining local data with fresh API data
   */
  async getEnhancedMarketInfo(conditionId: string): Promise<{
    localData: PolymarketMarket | null;
    liveData: Market | null;
    tokens: any[];
  }> {
    const db = (this.runtime as any).db;

    try {
      // Get local market data
      const localData = db
        ? await db
            .select()
            .from(polymarketMarketsTable)
            .where(eq(polymarketMarketsTable.conditionId, conditionId))
            .limit(1)
            .then((rows: any[]) => rows[0] || null)
        : null;

      // Get live API data
      const liveData = await this.getMarketDetail(conditionId);

      // Get tokens
      const tokens = db
        ? await db
            .select()
            .from(polymarketTokensTable)
            .where(eq(polymarketTokensTable.conditionId, conditionId))
        : [];

      return {
        localData,
        liveData,
        tokens,
      };
    } catch (error) {
      logger.error(
        `Failed to get enhanced market info for ${conditionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Format market information for user-friendly display
   */
  formatMarketInfo(
    localData: PolymarketMarket | null,
    liveData: Market | null,
  ): string {
    if (!localData && !liveData) {
      return "Market not found.";
    }

    // Handle both Market and PolymarketMarket types
    const question =
      liveData?.question || localData?.question || "Unknown question";
    const category =
      liveData?.category || localData?.category || "Uncategorized";
    const active =
      liveData?.active !== undefined ? liveData.active : localData?.active;

    // Handle different date property names
    const endDateIso = liveData?.end_date_iso || localData?.endDateIso;
    const endDate = endDateIso
      ? new Date(endDateIso).toLocaleDateString()
      : "No end date";

    let info = `**${question}**\n`;
    info += `📊 Category: ${category}\n`;
    info += `🔴 Status: ${active ? "Active" : "Inactive"}\n`;
    info += `📅 End Date: ${endDate}\n`;

    if (liveData) {
      info += `✨ *Live data from API*\n`;
    }

    return info;
  }

  /**
   * Cache market detail with expiration
   */
  private cacheMarketDetail(conditionId: string, marketDetail: Market): void {
    // Remove oldest entry if cache is full
    if (this.marketCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.marketCache.keys().next().value;
      if (oldestKey) {
        this.marketCache.delete(oldestKey);
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.CACHE_DURATION_MS);

    this.marketCache.set(conditionId, {
      conditionId,
      marketDetail,
      fetchedAt: now,
      expiresAt,
    });

    logger.debug(
      `Cached market detail for ${conditionId}, expires at ${expiresAt.toISOString()}`,
    );
  }

  /**
   * Get market detail from cache if valid
   */
  private getFromCache(conditionId: string): MarketDetailCache | null {
    const cached = this.marketCache.get(conditionId);

    if (!cached) {
      return null;
    }

    // Check if expired
    if (new Date() > cached.expiresAt) {
      this.marketCache.delete(conditionId);
      return null;
    }

    return cached;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.marketCache.size,
      maxSize: this.MAX_CACHE_SIZE,
    };
  }
}
