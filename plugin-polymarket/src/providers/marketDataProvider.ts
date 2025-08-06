import {
  type IAgentRuntime,
  type Memory,
  type State,
  type Provider,
  type ProviderResult,
  logger,
} from "@elizaos/core";
import { polymarketMarketsTable } from "../schema";
import { sql, and, desc } from "drizzle-orm";

export const marketDataProvider: Provider = {
  name: "POLYMARKET_MARKET_DATA",
  description: "Provides current active Polymarket markets from the database",
  
  get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<ProviderResult> => {
    try {
      const db = (runtime as any).db;
      if (!db) {
        logger.warn("[marketDataProvider] Database not available");
        return {
          text: "No market data available - database not connected",
          values: {},
          data: {},
        };
      }
      
      // Get top 5 active markets ending soon
      const markets: any[] = await db
        .select()
        .from(polymarketMarketsTable)
        .where(
          and(
            sql`${polymarketMarketsTable.active} = true`,
            sql`${polymarketMarketsTable.closed} = false`,
            sql`${polymarketMarketsTable.endDateIso} > NOW()`
          )
        )
        .orderBy(polymarketMarketsTable.endDateIso)
        .limit(5);
      
      if (markets.length === 0) {
        return {
          text: "No active markets found in database",
          values: {},
          data: {},
        };
      }
      
      const marketList = markets.map((market: any, index: number) => {
        const endDate = market.endDateIso ? new Date(market.endDateIso) : null;
        const daysUntilEnd = endDate 
          ? Math.floor((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : "unknown";
        
        return `${index + 1}. "${market.question}" (ends in ${daysUntilEnd} days, slug: ${market.marketSlug})`;
      }).join("\n");
      
      return {
        text: `Current active Polymarket markets (top 5 ending soon):\n${marketList}\n\nNote: Only reference markets that actually exist in the database. Do not make up markets.`,
        values: {
          marketCount: markets.length,
          markets: markets.map(m => ({
            question: m.question,
            slug: m.marketSlug,
            endDate: m.endDateIso,
          })),
        },
        data: { markets },
      };
      
    } catch (error) {
      logger.error("[marketDataProvider] Error fetching market data:", error);
      return {
        text: "Error fetching market data",
        values: {},
        data: {},
      };
    }
  },
};