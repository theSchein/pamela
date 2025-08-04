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

export const getMarketDataAction: Action = {
  name: "GET_MARKET_DATA",
  description: "Get real-time market data for a specific condition ID from Polymarket APIs",
  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "get data for 0x7f6e9f3aee46ac8031a9879ed7e9d94b082c3e0e76395e82f9e7d5c57362efd8" },
      },
      {
        name: "{{assistant}}",
        content: { text: "I'll fetch the current data for that market..." },
      },
    ],
  ],
  
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    const text = (message.content.text || "").toLowerCase();
    
    // Check if message contains a condition ID (0x followed by 64 hex chars)
    const hasConditionId = /0x[a-f0-9]{64}/i.test(message.content.text || "");
    
    // Or check for market data keywords
    const dataKeywords = ["get data", "market data", "fetch market", "show market", "market info"];
    const hasDataKeyword = dataKeywords.some(keyword => text.includes(keyword));
    
    return hasConditionId || hasDataKeyword;
  },

  handler: async (
    runtime: IAgentRuntime, 
    message: Memory, 
    state?: State,
    _options?: Record<string, any>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      logger.info("[getMarketDataAction] Handler called");
      
      const text = message.content.text || "";
      
      // Extract condition ID
      const conditionIdMatch = text.match(/0x[a-f0-9]{64}/i);
      if (!conditionIdMatch) {
        const errorContent: Content = {
          text: "I need a condition ID to fetch market data. It should look like: 0x7f6e9f3aee46ac8031a9879ed7e9d94b082c3e0e76395e82f9e7d5c57362efd8",
          action: "GET_MARKET_DATA",
        };
        
        if (callback) {
          await callback(errorContent);
        }
        
        return {
          success: false,
          data: {},
        };
      }
      
      const conditionId = conditionIdMatch[0];
      logger.info(`[getMarketDataAction] Fetching data for condition ID: ${conditionId}`);
      
      // Fetch from CLOB API
      let marketData: any = {};
      let priceData = {
        yesPrice: "N/A",
        noPrice: "N/A",
        spread: "N/A",
        volume: 0,
        liquidity: 0,
      };
      
      try {
        const clobResponse = await fetch(
          `https://clob.polymarket.com/markets/${conditionId}`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (clobResponse.ok) {
          marketData = await clobResponse.json();
          
          // Extract prices from tokens with proper handling for closed/active markets
          if (marketData.tokens && marketData.tokens.length >= 2) {
            const yesToken = marketData.tokens.find((t: any) => t.outcome === "Yes");
            const noToken = marketData.tokens.find((t: any) => t.outcome === "No");
            
            // Check if market is closed/resolved (prices will be 0/1)
            const isResolved = marketData.closed || !marketData.active || !marketData.accepting_orders;
            
            if (yesToken?.price !== undefined) {
              const price = typeof yesToken.price === 'number' ? yesToken.price : parseFloat(yesToken.price);
              if (isResolved && (price === 0 || price === 1)) {
                // For resolved markets, indicate the final outcome
                priceData.yesPrice = price === 1 ? "1.00" : "0.00";
              } else {
                // For active markets, use the actual trading price
                priceData.yesPrice = price.toFixed(3);
              }
            }
            if (noToken?.price !== undefined) {
              const price = typeof noToken.price === 'number' ? noToken.price : parseFloat(noToken.price);
              if (isResolved && (price === 0 || price === 1)) {
                // For resolved markets, indicate the final outcome
                priceData.noPrice = price === 1 ? "1.00" : "0.00";
              } else {
                // For active markets, use the actual trading price
                priceData.noPrice = price.toFixed(3);
              }
            }
          }
        }
      } catch (error) {
        logger.warn("[getMarketDataAction] CLOB API failed:", error);
      }
      
      // Fetch from Gamma API for additional data
      try {
        const gammaResponse = await fetch(
          `https://gamma-api.polymarket.com/markets?condition_ids=${conditionId}`
        );
        
        if (gammaResponse.ok) {
          const gammaData = await gammaResponse.json() as any[];
          if (gammaData.length > 0) {
            const gammaMarket = gammaData[0];
            
            // Get volume and liquidity
            priceData.volume = parseFloat(gammaMarket.volumeNum || gammaMarket.volume || "0");
            priceData.liquidity = parseFloat(gammaMarket.liquidityNum || gammaMarket.liquidity || "0");
            
            // Get spread if available
            if (gammaMarket.spread !== undefined) {
              priceData.spread = String(gammaMarket.spread);
            }
            
            // Use Gamma data to fill in missing market info
            if (!marketData.question && gammaMarket.question) {
              marketData.question = gammaMarket.question;
            }
          }
        }
      } catch (error) {
        logger.warn("[getMarketDataAction] Gamma API failed:", error);
      }
      
      if (!marketData.question) {
        const errorContent: Content = {
          text: `Couldn't find market data for condition ID: ${conditionId}. Make sure it's a valid Polymarket condition ID.`,
          action: "GET_MARKET_DATA",
        };
        
        if (callback) {
          await callback(errorContent);
        }
        
        return {
          success: false,
          data: {},
        };
      }
      
      // Format response
      const responseText = `📊 **Market Data for ${marketData.question}**

**Current Prices:**
• YES: $${priceData.yesPrice} (${(parseFloat(priceData.yesPrice) * 100).toFixed(1)}%)
• NO: $${priceData.noPrice} (${(parseFloat(priceData.noPrice) * 100).toFixed(1)}%)
${priceData.spread !== "N/A" ? `• Spread: ${priceData.spread}` : ''}

**Market Stats:**
• Volume: $${priceData.volume.toLocaleString()}
• Liquidity: $${priceData.liquidity.toLocaleString()}
• Active: ${marketData.active ? '✅' : '❌'}
• Accepting Orders: ${marketData.accepting_orders ? '✅' : '❌'}

**Details:**
• Condition ID: \`${conditionId}\`
• Market Slug: ${marketData.market_slug || 'N/A'}
• End Date: ${marketData.end_date_iso ? new Date(marketData.end_date_iso).toLocaleDateString() : 'N/A'}

To place an order: "buy YES" or "buy NO" with the amount you want to trade!`;
      
      const responseContent: Content = {
        text: responseText,
        action: "GET_MARKET_DATA",
        data: {
          conditionId,
          marketData,
          priceData,
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
      logger.error("[getMarketDataAction] Error:", error);
      
      const errorContent: Content = {
        text: "Failed to fetch market data. Please try again.",
        action: "GET_MARKET_DATA",
      };
      
      if (callback) {
        await callback(errorContent);
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch market data",
        data: {},
      };
    }
  },
};