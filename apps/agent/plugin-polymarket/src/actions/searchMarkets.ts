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
import { sql, like, or, and, desc } from "drizzle-orm";

export const searchMarketsAction: Action = {
  name: "SEARCH_POLYMARKET_MARKETS",
  description: "Search for prediction markets in the database by keywords, category, or get popular markets",
  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "what markets are there about Bitcoin?" },
      },
      {
        name: "{{assistant}}",
        content: { text: "I'll search for Bitcoin markets for you." },
      },
    ],
    [
      {
        name: "{{user}}",
        content: { text: "show me some popular markets" },
      },
      {
        name: "{{assistant}}",
        content: { text: "Let me find the most popular markets currently available." },
      },
    ],
    [
      {
        name: "{{user}}",
        content: { text: "tell me about some markets you like" },
      },
      {
        name: "{{assistant}}",
        content: { text: "I'll show you some interesting markets from the database." },
      },
    ],
    [
      {
        name: "{{user}}",
        content: { text: "what are the top election markets?" },
      },
      {
        name: "{{assistant}}",
        content: { text: "I'll search for election-related markets." },
      },
    ],
  ],
  
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    logger.info("[searchMarketsAction] Validate called for message:", message.content.text);
    
    // This action can be triggered by various market-related queries
    const marketKeywords = [
      "market", "markets", "prediction", "bet", "trade", "trading",
      "popular", "trending", "hot", "interesting", "active",
      "show", "tell", "what", "which", "find", "search", "look"
    ];
    
    const text = (message.content.text || "").toLowerCase();
    const hasMarketKeyword = marketKeywords.some(keyword => text.includes(keyword));
    
    if (hasMarketKeyword) {
      logger.info("[searchMarketsAction] Validation passed - market keywords found");
      return true;
    }
    
    logger.info("[searchMarketsAction] No market keywords found");
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
      logger.info("[searchMarketsAction] Handler called");
      
      const db = (runtime as any).db;
      if (!db) {
        throw new Error("Database not available");
      }
      
      const text = (message.content.text || "").toLowerCase();
      
      // Extract search terms
      let searchTerm = "";
      const searchPatterns = [
        /(?:markets? about|markets? for|markets? on) (.+?)(?:\?|$)/i,
        /(?:search for|find|show me) (.+?) markets?/i,
        /(.+?) markets?/i,
      ];
      
      for (const pattern of searchPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          searchTerm = match[1].trim();
          break;
        }
      }
      
      // Build query
      let query = db.select().from(polymarketMarketsTable);
      
      // Add search filter if we have a search term
      if (searchTerm && !["some", "popular", "hot", "trending", "interesting", "active", "favorite", "your"].includes(searchTerm)) {
        logger.info(`[searchMarketsAction] Searching for: "${searchTerm}"`);
        query = query.where(
          or(
            like(polymarketMarketsTable.question, `%${searchTerm}%`),
            like(polymarketMarketsTable.category, `%${searchTerm}%`)
          )
        );
      } else {
        logger.info("[searchMarketsAction] No specific search term, returning popular markets");
      }
      
      // Filter for active markets only
      query = query.where(
        and(
          sql`${polymarketMarketsTable.active} = true`,
          sql`${polymarketMarketsTable.closed} = false`
        )
      );
      
      // Order by end date (sooner ending markets first) and limit
      query = query
        .orderBy(polymarketMarketsTable.endDateIso)
        .limit(10);
      
      const markets: any[] = await query;
      
      if (markets.length === 0) {
        const noResultsContent: Content = {
          text: `Shit, I couldn't find any markets about "${searchTerm}". Try something else?`,
          action: "SEARCH_POLYMARKET_MARKETS",
        };
        
        if (callback) {
          await callback(noResultsContent);
        }
        
        return {
          success: false,
          data: {},
        };
      }
      
      // Format markets for response
      const formattedMarkets = markets.map((market: any, index: number) => {
        const endDate = market.endDateIso ? new Date(market.endDateIso) : null;
        const daysUntilEnd = endDate 
          ? Math.floor((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null;
        
        return {
          rank: index + 1,
          question: market.question,
          slug: market.marketSlug,
          conditionId: market.conditionId,
          category: market.category || "General",
          endDate: endDate?.toISOString().split('T')[0],
          daysUntilEnd,
          active: market.active,
        };
      });
      
      logger.info(`[searchMarketsAction] Found ${markets.length} markets`);
      
      // Create response text
      let responseText = searchTerm && !["some", "popular", "hot", "trending", "interesting", "active", "favorite", "your"].includes(searchTerm)
        ? `Found ${markets.length} markets about "${searchTerm}":\n\n`
        : `Here are some hot markets I'm watching:\n\n`;
      
      formattedMarkets.slice(0, 5).forEach((market, index) => {
        responseText += `${index + 1}. **${market.question}**\n`;
        responseText += `   📅 Ends: ${market.endDate} (${market.daysUntilEnd} days)\n`;
        responseText += `   🏷️ Category: ${market.category}\n`;
        responseText += `   🔗 ID: \`${market.conditionId}\`\n\n`;
      });
      
      responseText += `Which one catches your eye? Pick a number or ask for more details!`;
      
      const responseContent: Content = {
        text: responseText,
        action: "SEARCH_POLYMARKET_MARKETS",
        data: {
          markets: formattedMarkets,
          searchTerm: searchTerm || "popular/recent",
          totalResults: markets.length,
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
      logger.error("[searchMarketsAction] Error searching markets:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to search markets",
        data: {},
      };
    }
  },
};