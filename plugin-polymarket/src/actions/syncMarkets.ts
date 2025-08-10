import {
  type IAgentRuntime,
  type Memory,
  type State,
  type Action,
  type ActionResult,
  type Content,
  type HandlerCallback,
  logger,
} from "@elizaos/core";
import { MarketSyncService } from "../services/MarketSyncService";

export const syncMarketsAction: Action = {
  name: "SYNC_POLYMARKET_MARKETS",
  description: "Manually trigger a sync of Polymarket markets, optionally with a search term",
  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "sync F1 markets" },
      },
      {
        name: "{{assistant}}",
        content: { text: "I'll sync F1 markets from Polymarket." },
      },
    ],
    [
      {
        name: "{{user}}",
        content: { text: "update the market database" },
      },
      {
        name: "{{assistant}}",
        content: { text: "Starting market database sync..." },
      },
    ],
  ],
  
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    const text = (message.content.text || "").toLowerCase();
    const syncKeywords = ["sync", "update", "refresh", "fetch", "reload"];
    const marketKeywords = ["market", "markets", "database"];
    
    const hasSyncKeyword = syncKeywords.some(keyword => text.includes(keyword));
    const hasMarketKeyword = marketKeywords.some(keyword => text.includes(keyword));
    
    return hasSyncKeyword && hasMarketKeyword;
  },

  handler: async (
    runtime: IAgentRuntime, 
    message: Memory, 
    state?: State,
    options?: Record<string, any>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      logger.info("[syncMarketsAction] Starting manual market sync");
      
      const text = message.content.text || "";
      
      // Extract search term if any
      let searchTerm = "";
      const match = text.match(/sync\s+(.+?)\s+markets?/i);
      if (match) {
        searchTerm = match[1].trim();
      }
      
      // Get the sync service
      const syncService = runtime.getService("polymarket-sync") as MarketSyncService;
      
      if (!syncService) {
        throw new Error("Market sync service not available");
      }
      
      const responseContent: Content = {
        text: searchTerm 
          ? `🔄 Starting sync for ${searchTerm.toUpperCase()} markets... This may take a moment.`
          : `🔄 Starting full market database sync... This may take a moment.`,
        action: "SYNC_POLYMARKET_MARKETS",
        data: {
          searchTerm,
          status: "started",
        },
      };
      
      if (callback) {
        await callback(responseContent);
      }
      
      // Trigger sync
      await syncService.performSync("manual", searchTerm);
      
      // Get sync status for the response
      const syncStatus = await syncService.getSyncStatus();
      
      const successContent: Content = {
        text: searchTerm
          ? `✅ Successfully synced ${searchTerm.toUpperCase()} markets! Try searching again.`
          : `✅ Market database sync completed! Fresh markets are now available.\n\n📊 Sync Status:\n• Last sync: Just now\n• Next automatic sync: ${syncStatus.nextSyncTime ? syncStatus.nextSyncTime.toLocaleString() : 'In 24 hours'}\n• Sync interval: Daily (24 hours)`,
        action: "SYNC_POLYMARKET_MARKETS",
        data: {
          searchTerm,
          status: "completed",
          lastSyncTime: syncStatus.lastSyncTime,
          nextSyncTime: syncStatus.nextSyncTime,
          syncInterval: syncStatus.syncInterval,
        },
      };
      
      if (callback) {
        await callback(successContent);
      }
      
      return {
        success: true,
        data: successContent.data || {},
      };
      
    } catch (error) {
      logger.error("[syncMarketsAction] Error syncing markets:", error);
      
      const errorContent: Content = {
        text: `❌ Failed to sync markets: ${error instanceof Error ? error.message : "Unknown error"}`,
        action: "SYNC_POLYMARKET_MARKETS",
        data: {
          error: error instanceof Error ? error.message : "Unknown error",
          status: "failed",
        },
      };
      
      if (callback) {
        await callback(errorContent);
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to sync markets",
        data: errorContent.data || {},
      };
    }
  },
};