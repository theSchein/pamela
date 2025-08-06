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
import { sql, like, or, and, desc, ilike } from "drizzle-orm";
import { callLLMWithTimeout } from "../utils/llmHelpers";
import { searchMarketsTemplate } from "../templates/searchMarketsTemplate";

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
    
    // Check for direct topic queries (e.g., "f1 markets", "bitcoin markets")
    const hasTopicMarket = /\b\w+\s+markets?\b/i.test(text);
    
    // Check for market keywords
    const hasMarketKeyword = marketKeywords.some(keyword => text.includes(keyword));
    
    if (hasMarketKeyword || hasTopicMarket) {
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
      
      const text = message.content.text || "";
      
      // Use LLM to extract search intent and terms
      let searchTerm = "";
      let searchType = "general";
      
      try {
        const llmExtraction = await callLLMWithTimeout<{
          searchType: string;
          searchTerm: string;
          confidence: number;
        }>(
          runtime,
          state,
          searchMarketsTemplate.replace("{{text}}", text),
          "searchMarketsAction",
          10000 // 10 second timeout
        );
        
        logger.info(`[searchMarketsAction] LLM extraction result:`, llmExtraction);
        
        if (llmExtraction && llmExtraction.confidence > 0.7) {
          searchType = llmExtraction.searchType || "general";
          searchTerm = llmExtraction.searchTerm || "";
        }
      } catch (error) {
        logger.warn(`[searchMarketsAction] LLM extraction failed, falling back to regex:`, error);
        // Fallback to simple regex extraction
        const match = text.toLowerCase().match(/(?:about|for|on)\s+(.+?)\s+markets?/i);
        if (match) {
          searchTerm = match[1].trim();
          searchType = "specific";
        }
      }
      
      // Build query
      let query = db.select().from(polymarketMarketsTable);
      
      // Log extracted search info
      logger.info(`[searchMarketsAction] Search type: "${searchType}", term: "${searchTerm}"`);
      
      
      // Add search filter based on search type
      const isSpecificSearch = searchType === "specific" || searchType === "category";
      
      // Build WHERE conditions
      const conditions: any[] = [
        sql`${polymarketMarketsTable.active} = true`,
        sql`${polymarketMarketsTable.closed} = false`
      ];
      
      if (isSpecificSearch && searchTerm) {
        logger.info(`[searchMarketsAction] Applying ${searchType} search for: "${searchTerm}"`);
        conditions.push(
          or(
            ilike(polymarketMarketsTable.question, `%${searchTerm}%`),
            ilike(polymarketMarketsTable.category, `%${searchTerm}%`)
          )
        );
      } else {
        logger.info(`[searchMarketsAction] Search type: ${searchType}, returning popular/trending markets`);
      }
      
      // Apply all conditions at once
      query = query.where(and(...conditions));
      
      // Order by end date (sooner ending markets first) and limit
      query = query
        .orderBy(polymarketMarketsTable.endDateIso)
        .limit(10);
      
      // Debug: Log the SQL query being executed
      logger.info(`[searchMarketsAction] Executing query with ${conditions.length} conditions`);
      
      const markets: any[] = await query;
      
      // Debug: Log first few results
      if (markets.length > 0) {
        logger.info(`[searchMarketsAction] First result: ${markets[0].question} (category: ${markets[0].category})`);
      }
      
      // If no results for specific search, try a broader search
      if (markets.length === 0 && isSpecificSearch) {
        logger.info(`[searchMarketsAction] No results for "${searchTerm}", checking all text fields`);
        
        // Try searching in more fields
        const broaderQuery = await db.select()
          .from(polymarketMarketsTable)
          .where(
            and(
              or(
                ilike(polymarketMarketsTable.question, `%${searchTerm}%`),
                ilike(polymarketMarketsTable.category, `%${searchTerm}%`)
              ),
              sql`${polymarketMarketsTable.active} = true`,
              sql`${polymarketMarketsTable.closed} = false`
            )
          )
          .orderBy(polymarketMarketsTable.endDateIso)
          .limit(10);
          
        if (broaderQuery.length > 0) {
          logger.info(`[searchMarketsAction] Found ${broaderQuery.length} markets in broader search`);
          markets.push(...broaderQuery);
        } else {
          // Get some sample markets to help debug
          const sampleMarkets = await db.select()
            .from(polymarketMarketsTable)
            .where(
              and(
                sql`${polymarketMarketsTable.active} = true`,
                sql`${polymarketMarketsTable.closed} = false`
              )
            )
            .limit(5);
            
          logger.info(`[searchMarketsAction] Still no results. Sample active markets: ${sampleMarkets.map((m: any) => m.question).join(', ')}`);
        }
      }
      
      if (markets.length === 0) {
        const noResultsContent: Content = {
          text: searchTerm 
            ? `No active markets found for "${searchTerm}". The database might not have any markets matching that term right now. Try a different search or ask me to show popular markets!`
            : `No active markets found at the moment. The market database might be updating.`,
          action: "SEARCH_POLYMARKET_MARKETS",
        };
        
        if (callback) {
          await callback(noResultsContent);
        }
        
        return {
          success: true,
          data: {
            markets: [],
            searchTerm: searchTerm || "popular/recent",
            totalResults: 0,
          },
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
      let responseText = isSpecificSearch
        ? `Found ${markets.length} ${searchTerm.toUpperCase()} markets:\n\n`
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