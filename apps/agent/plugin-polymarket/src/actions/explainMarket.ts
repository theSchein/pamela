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
import { sql, like, and } from "drizzle-orm";

export const explainMarketAction: Action = {
  name: "EXPLAIN_MARKET",
  description: "Explain details about a specific market with current prices and Pamela's analysis",
  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "tell me more about the first one" },
      },
      {
        name: "{{assistant}}",
        content: { text: "Let me pull up the details on that market..." },
      },
    ],
    [
      {
        name: "{{user}}",
        content: { text: "what are the odds on the Russia market?" },
      },
      {
        name: "{{assistant}}",
        content: { text: "Let me check the current prices for you..." },
      },
    ],
  ],
  
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    logger.info("[explainMarketAction] Validate called");
    
    const explainKeywords = ["tell me more", "explain", "details", "odds", "price", "about", "first", "second", "third", "that one", "what are the"];
    const text = (message.content.text || "").toLowerCase();
    
    const hasExplainKeyword = explainKeywords.some(keyword => text.includes(keyword));
    
    if (hasExplainKeyword) {
      logger.info("[explainMarketAction] Validation passed");
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
      logger.info("[explainMarketAction] Handler called");
      
      const db = (runtime as any).db;
      if (!db) {
        throw new Error("Database not available");
      }
      
      const text = (message.content.text || "").toLowerCase();
      
      // Extract search term from the message
      let searchQuery = "";
      
      // Handle ordinal references (first, second, third)
      if (text.includes("first") || text.includes("1")) {
        // Get the first market from recent context
        const recentMarkets = await db
          .select()
          .from(polymarketMarketsTable)
          .where(sql`${polymarketMarketsTable.active} = true`)
          .orderBy(polymarketMarketsTable.endDateIso)
          .limit(3);
        
        if (recentMarkets.length > 0) {
          searchQuery = recentMarkets[0].question.split(' ').slice(0, 3).join(' ');
        }
      } else if (text.includes("second") || text.includes("2")) {
        const recentMarkets = await db
          .select()
          .from(polymarketMarketsTable)
          .where(sql`${polymarketMarketsTable.active} = true`)
          .orderBy(polymarketMarketsTable.endDateIso)
          .limit(3);
        
        if (recentMarkets.length > 1) {
          searchQuery = recentMarkets[1].question.split(' ').slice(0, 3).join(' ');
        }
      } else if (text.includes("third") || text.includes("3")) {
        const recentMarkets = await db
          .select()
          .from(polymarketMarketsTable)
          .where(sql`${polymarketMarketsTable.active} = true`)
          .orderBy(polymarketMarketsTable.endDateIso)
          .limit(3);
        
        if (recentMarkets.length > 2) {
          searchQuery = recentMarkets[2].question.split(' ').slice(0, 3).join(' ');
        }
      } else {
        // Extract keywords from the message
        const patterns = [
          /about (?:the )?(.+?)(?:\?|$| market)/i,
          /more (?:about|on) (.+?)(?:\?|$| market)/i,
          /odds (?:on|for) (.+?)(?:\?|$| market)/i,
        ];
        
        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            searchQuery = match[1].trim();
            break;
          }
        }
        
        // If no pattern matched, look for key terms
        if (!searchQuery) {
          const keyTerms = ["russia", "ukraine", "fed", "rate", "bitcoin", "ethereum", "trump", "election", "aaron", "rodgers"];
          for (const term of keyTerms) {
            if (text.includes(term)) {
              searchQuery = term;
              break;
            }
          }
        }
      }
      
      logger.info(`[explainMarketAction] Searching for: "${searchQuery}"`);
      
      // First try to find in our database
      let market: any = null;
      if (searchQuery) {
        const dbResults = await db
          .select()
          .from(polymarketMarketsTable)
          .where(
            and(
              sql`${polymarketMarketsTable.active} = true`,
              like(polymarketMarketsTable.question, `%${searchQuery}%`)
            )
          )
          .limit(1);
        
        if (dbResults.length > 0) {
          market = dbResults[0];
        }
      }
      
      // If not found in DB, search using Gamma API
      if (!market && searchQuery) {
        try {
          const gammaUrl = new URL('https://gamma-api.polymarket.com/markets');
          gammaUrl.searchParams.append('limit', '1');
          gammaUrl.searchParams.append('active', 'true');
          gammaUrl.searchParams.append('closed', 'false');
          
          // Search by keyword in slug (Gamma API doesn't have text search)
          const searchResponse = await fetch(gammaUrl.toString());
          if (searchResponse.ok) {
            const allMarkets = await searchResponse.json() as any[];
            
            // Find best match by searching in question text
            market = allMarkets.find((m: any) => 
              m.question?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              m.slug?.toLowerCase().includes(searchQuery.toLowerCase())
            );
          }
        } catch (error) {
          logger.warn("[explainMarketAction] Gamma API search failed:", error);
        }
      }
      
      if (!market) {
        const noMarketContent: Content = {
          text: "Shit, I can't find that specific market. Can you be more specific? Like 'the Russia market' or 'the Aaron Rodgers one'?",
          action: "EXPLAIN_MARKET",
        };
        
        if (callback) {
          await callback(noMarketContent);
        }
        
        return {
          success: false,
          data: {},
        };
      }
      
      // Now fetch real-time data for this market
      let priceData = {
        yesPrice: "0.50",
        noPrice: "0.50",
        volume: 0,
        liquidity: 0,
        spread: "0.00"
      };
      
      try {
        // Get market data from CLOB API
        const conditionId = market.conditionId || market.condition_id;
        if (conditionId) {
          const clobResponse = await fetch(
            `https://clob.polymarket.com/markets/${conditionId}`,
            {
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );
          
          if (clobResponse.ok) {
            const clobData = await clobResponse.json() as any;
            
            // Extract price data from tokens array
            if (clobData.tokens && clobData.tokens.length >= 2) {
              // Find YES and NO tokens by outcome
              const yesToken = clobData.tokens.find((t: any) => t.outcome === "Yes");
              const noToken = clobData.tokens.find((t: any) => t.outcome === "No");
              
              if (yesToken && yesToken.price !== undefined) {
                priceData.yesPrice = String(yesToken.price);
              }
              if (noToken && noToken.price !== undefined) {
                priceData.noPrice = String(noToken.price);
              }
            }
            
            // Get best bid/ask if available
            if (clobData.best_bid !== undefined && clobData.best_ask !== undefined) {
              priceData.spread = (parseFloat(clobData.best_ask) - parseFloat(clobData.best_bid)).toFixed(3);
            }
            
            // Volume and liquidity are not in CLOB response, will get from Gamma
          }
        }
        
        // Always try Gamma API for volume and liquidity data
        const gammaUrl = `https://gamma-api.polymarket.com/markets?condition_ids=${conditionId}`;
        try {
          const gammaResponse = await fetch(gammaUrl);
          
          if (gammaResponse.ok) {
            const gammaData = await gammaResponse.json() as any[];
            if (gammaData.length > 0) {
              const gammaMarket = gammaData[0];
              
              // If we didn't get prices from CLOB, try Gamma
              if (priceData.yesPrice === "0.50" && gammaMarket.outcomePrices) {
                const prices = JSON.parse(gammaMarket.outcomePrices);
                priceData.yesPrice = prices[0] || "0.50";
                priceData.noPrice = prices[1] || "0.50";
              }
              
              // Always get volume and liquidity from Gamma
              priceData.volume = parseFloat(gammaMarket.volumeNum || gammaMarket.volume || "0");
              priceData.liquidity = parseFloat(gammaMarket.liquidityNum || gammaMarket.liquidity || "0");
              
              // Get spread from Gamma if available
              if (gammaMarket.spread !== undefined && priceData.spread === "0.00") {
                priceData.spread = String(gammaMarket.spread);
              }
            }
          }
        } catch (error) {
          logger.warn("[explainMarketAction] Gamma API failed:", error);
        }
      } catch (error) {
        logger.warn("[explainMarketAction] Failed to fetch real-time prices:", error);
      }
      
      const endDate = market.endDateIso || market.end_date_iso || market.endDate 
        ? new Date(market.endDateIso || market.end_date_iso || market.endDate) 
        : null;
      const daysUntilEnd = endDate 
        ? Math.floor((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : "unknown";
      
      const responseText = `Alright, "${market.question}" - let me break this down with the REAL data:

📊 **Current Odds:**
YES: $${priceData.yesPrice} (${(parseFloat(priceData.yesPrice) * 100).toFixed(1)}%)
NO: $${priceData.noPrice} (${(parseFloat(priceData.noPrice) * 100).toFixed(1)}%)
${priceData.spread !== "0.00" ? `Spread: ${priceData.spread} (${(parseFloat(priceData.spread) * 100).toFixed(1)}%)` : ''}

💰 **Market Stats:**
Volume: $${priceData.volume.toLocaleString()}
Liquidity: $${priceData.liquidity.toLocaleString()}
Ends: ${endDate ? endDate.toLocaleDateString() : 'No end date'} (${daysUntilEnd} days left)

🎯 **My Analysis:**
${parseFloat(priceData.yesPrice) > 0.70 
  ? `Market's heavily favoring YES at ${(parseFloat(priceData.yesPrice) * 100).toFixed(0)}%. Unless you know something the market doesn't, the value might be on the NO side.`
  : parseFloat(priceData.yesPrice) < 0.30
  ? `NO is crushing it at ${(parseFloat(priceData.noPrice) * 100).toFixed(0)}%. Market seems pretty confident, but black swan events happen...`
  : `Pretty balanced market here. Could swing either way, which means opportunity if you've got an edge.`
}

${priceData.volume > 500000 
  ? "This market's HOT - big money is positioned. Follow the smart money or fade them?"
  : priceData.volume > 100000
  ? "Decent volume, market's fairly liquid. Good for getting in and out."
  : "Lower volume market - could see bigger swings on news."}

Want me to place a bet? Just say YES or NO and how much!`;
      
      const responseContent: Content = {
        text: responseText,
        action: "EXPLAIN_MARKET",
        data: {
          market: {
            question: market.question,
            slug: market.marketSlug || market.slug,
            conditionId: market.conditionId || market.condition_id,
            prices: { 
              yes: priceData.yesPrice, 
              no: priceData.noPrice 
            },
            volume: priceData.volume,
            liquidity: priceData.liquidity,
            daysUntilEnd,
          },
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
      logger.error("[explainMarketAction] Error:", error);
      
      const errorContent: Content = {
        text: "Fuck, something went wrong pulling those market details. Let me try again in a sec.",
        action: "EXPLAIN_MARKET",
      };
      
      if (callback) {
        await callback(errorContent);
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch market details",
        data: {},
      };
    }
  },
};