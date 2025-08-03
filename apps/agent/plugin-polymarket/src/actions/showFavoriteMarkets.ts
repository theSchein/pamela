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
import { polymarketMarketsTable } from "../schema";
import { sql, and } from "drizzle-orm";

export const showFavoriteMarketsAction: Action = {
  name: "SHOW_FAVORITE_MARKETS",
  description: "Shows Pamela's favorite current prediction markets with her commentary",
  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "tell me about your favorite markets" },
      },
      {
        name: "{{assistant}}",
        content: { text: "Let me show you some hot markets I'm watching right now..." },
      },
    ],
    [
      {
        name: "{{user}}",
        content: { text: "what markets do you like" },
      },
      {
        name: "{{assistant}}",
        content: { text: "Here are my top picks from the current markets..." },
      },
    ],
  ],
  
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    logger.info("[showFavoriteMarketsAction] Validate called");
    
    const favoriteKeywords = ["favorite", "like", "top", "best", "hot", "watching", "picks"];
    const marketKeywords = ["market", "markets", "trade", "trading"];
    
    const text = (message.content.text || "").toLowerCase();
    const hasFavoriteKeyword = favoriteKeywords.some(keyword => text.includes(keyword));
    const hasMarketKeyword = marketKeywords.some(keyword => text.includes(keyword));
    
    if (hasFavoriteKeyword && hasMarketKeyword) {
      logger.info("[showFavoriteMarketsAction] Validation passed");
      return true;
    }
    
    return false;
  },

  handler: async (
    runtime: IAgentRuntime, 
    message: Memory, 
    state?: State,
    _options?: Record<string, any>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      logger.info("[showFavoriteMarketsAction] Handler called");
      
      const db = (runtime as any).db;
      if (!db) {
        throw new Error("Database not available");
      }
      
      // Get 5 active markets ending soon
      const markets: any[] = await db
        .select()
        .from(polymarketMarketsTable)
        .where(
          and(
            sql`${polymarketMarketsTable.active} = true`,
            sql`${polymarketMarketsTable.closed} = false`
          )
        )
        .orderBy(polymarketMarketsTable.endDateIso)
        .limit(5);
      
      if (markets.length === 0) {
        const noMarketsContent: Content = {
          text: "Damn, looks like the database is empty right now. No markets to show!",
          action: "SHOW_FAVORITE_MARKETS",
        };
        
        if (callback) {
          await callback(noMarketsContent);
        }
        
        return {
          success: false,
          data: {},
        };
      }
      
      // Format response with Pamela's personality
      const marketDescriptions = markets.slice(0, 3).map((market: any, index: number) => {
        const endDate = market.endDateIso ? new Date(market.endDateIso) : null;
        const daysUntilEnd = endDate 
          ? Math.floor((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : "unknown";
        
        // Add some personality to each market
        let commentary = "";
        if (index === 0) {
          commentary = "This one's spicy - ";
        } else if (index === 1) {
          commentary = "Also watching ";
        } else {
          commentary = "And check this out - ";
        }
        
        return `${index + 1}. ${commentary}"${market.question}" - ends in ${daysUntilEnd} days. The action's getting real on this one.`;
      }).join("\n\n");
      
      const responseText = `Oh man, let me tell you about some HOT markets I'm watching right now:\n\n${marketDescriptions}\n\nWhich one catches your eye? I've got positions in a couple of these already 😎`;
      
      const responseContent: Content = {
        text: responseText,
        action: "SHOW_FAVORITE_MARKETS",
        data: {
          markets: markets.slice(0, 3).map(m => ({
            question: m.question,
            slug: m.marketSlug,
            daysUntilEnd: m.endDateIso 
              ? Math.floor((new Date(m.endDateIso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null,
          })),
        },
      };
      
      if (callback) {
        await callback(responseContent);
      }
      
      return {
        success: true,
        data: responseContent.data || {},
      };
      
    } catch (error) {
      logger.error("[showFavoriteMarketsAction] Error:", error);
      
      const errorContent: Content = {
        text: "Shit, something went wrong pulling up the markets. Let me try again in a sec.",
        action: "SHOW_FAVORITE_MARKETS",
      };
      
      if (callback) {
        await callback(errorContent);
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch markets",
        data: {},
      };
    }
  },
};