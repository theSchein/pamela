import {
  type Action,
  type ActionResult,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
} from "@elizaos/core";
import { initializeClobClient } from "../utils/clobClient";
import {
  contentToActionResult,
  createErrorResult,
} from "../utils/actionHelpers";

interface PortfolioPosition {
  tokenId: string;
  marketConditionId: string;
  marketQuestion?: string;
  outcome: string;
  size: string;
  value: string;
  averagePrice?: string;
  unrealizedPnl?: string;
  realizedPnl?: string;
}

/**
 * Get portfolio positions action for Polymarket
 * Shows all current holdings and their values
 */
export const getPortfolioPositionsAction: Action = {
  name: "GET_PORTFOLIO_POSITIONS",
  similes: [
    "GET_POSITIONS",
    "SHOW_PORTFOLIO",
    "MY_POSITIONS",
    "HOLDINGS",
    "PORTFOLIO",
    "POSITIONS",
    "CHECK_POSITIONS",
    "VIEW_PORTFOLIO",
    "SHOW_HOLDINGS",
  ],
  description: "Get current portfolio positions and holdings from Polymarket",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    const clobApiUrl = runtime.getSetting("CLOB_API_URL");
    return !!clobApiUrl;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    logger.info("[getPortfolioPositionsAction] Getting portfolio positions");

    try {
      // Initialize CLOB client to get wallet address
      const client = await initializeClobClient(runtime);
      
      // Get wallet address from the client
      const walletAddress = (client as any).wallet?.address || (client as any).signer?.address;
      
      if (!walletAddress) {
        throw new Error("Unable to determine wallet address from CLOB client");
      }

      logger.info(`[getPortfolioPositions] Using wallet address: ${walletAddress}`);

      if (callback) {
        await callback({
          text: "📊 **Retrieving Portfolio Positions**\n\nFetching your current holdings...",
          actions: ["GET_PORTFOLIO_POSITIONS"],
          data: { status: "fetching" },
        });
      }

      // Get positions from public data API
      let positions: any[] = [];
      let trades: any[] = [];

      try {
        // Use public data API to get positions directly
        logger.info("[getPortfolioPositions] Getting positions from public API...");
        const positionsUrl = `https://data-api.polymarket.com/positions?sizeThreshold=1&limit=50&sortDirection=DESC&user=${walletAddress}`;
        logger.info(`[getPortfolioPositions] Fetching from: ${positionsUrl}`);
        
        const positionsResponse = await fetch(positionsUrl);
        if (!positionsResponse.ok) {
          throw new Error(`Failed to fetch positions: ${positionsResponse.status} ${positionsResponse.statusText}`);
        }
        
        const positionsData = await positionsResponse.json() as any;
        positions = Array.isArray(positionsData) ? positionsData : positionsData.positions || [];
        logger.info(
          `[getPortfolioPositions] Retrieved ${positions.length} positions from public API`,
        );
      } catch (positionsError) {
        logger.warn(
          "[getPortfolioPositions] Failed to get positions from public API:",
          positionsError,
        );
        
        // Fallback to trades endpoint to calculate positions
        try {
          logger.info("[getPortfolioPositions] Falling back to trades endpoint...");
          const tradesUrl = `https://data-api.polymarket.com/trades?limit=100&takerOnly=true&user=${walletAddress}`;
          const tradesResponse = await fetch(tradesUrl);
          
          if (tradesResponse.ok) {
            const tradesData = await tradesResponse.json() as any;
            trades = Array.isArray(tradesData) ? tradesData : tradesData.trades || [];
            logger.info(
              `[getPortfolioPositions] Retrieved ${trades.length} trades from public API`,
            );
          }
        } catch (tradesError) {
          logger.warn(
            "[getPortfolioPositions] Failed to get trades from public API:",
            tradesError,
          );
        }
      }

      // Skip open orders - requires L2 auth
      // Open orders would require API credentials, so we skip this for L1-only mode

      // Process positions data
      let processedPositionsData: any[] = [];
      
      if (positions.length > 0) {
        // Direct positions from API
        processedPositionsData = positions;
      } else if (trades.length > 0) {
        // Build positions from trades as fallback
        const positionMap = new Map<string, any>();

        for (const trade of trades) {
          // Handle both public API format and CLOB API format
          const tokenId = trade.asset_id || trade.token_id || trade.tokenId;
          const side = trade.side || trade.takerSide;
          const size = parseFloat(trade.size || trade.takerAmount || "0");
          const price = parseFloat(trade.price || "0");
          const marketId = trade.market || trade.market_id || trade.conditionId || "Unknown";
          
          if (!tokenId) {
            logger.warn("[getPortfolioPositions] Trade missing token ID:", trade);
            continue;
          }

          const existing = positionMap.get(tokenId) || {
            tokenId: tokenId,
            conditionId: marketId,
            outcome: trade.outcome || "Unknown",
            size: 0,
            value: 0,
            trades: [],
          };

          const value = size * price;

          if (side === "BUY" || side === "buy") {
            existing.size += size;
            existing.value += value;
          } else if (side === "SELL" || side === "sell") {
            existing.size -= size;
            existing.value -= value;
          }

          existing.trades.push(trade);
          positionMap.set(tokenId, existing);
        }

        // Convert to positions array, filtering out zero positions
        processedPositionsData = Array.from(positionMap.values()).filter(
          (pos) => Math.abs(pos.size) > 0.001,
        );
      }

      // Process and format positions
      const processedPositions: PortfolioPosition[] = [];
      let totalValue = 0;

      for (const position of processedPositionsData) {
        try {
          // Log the raw position data to understand the API format
          if (processedPositionsData.indexOf(position) === 0) {
            logger.info("[getPortfolioPositions] Sample position data:", JSON.stringify(position, null, 2));
          }
          
          // Handle direct API positions format
          const tokenId = position.asset || position.tokenId || position.token_id || position.asset_id || position.assetId;
          const marketId = position.conditionId || position.condition_id || position.market || position.marketId || "Unknown";
          const size = parseFloat(position.size || position.position_size || position.positionSize || "0");
          const outcome = position.outcome || position.outcome_name || position.outcomeName || "Unknown";
          const currentPrice = parseFloat(position.curPrice || position.price || position.current_price || position.currentPrice || "0");
          const avgPrice = parseFloat(position.avgPrice || position.average_price || position.avg_price || position.averagePrice || "0");
          const value = parseFloat(position.currentValue || "0") || (size * currentPrice);
          const marketQuestion = position.title || position.question || position.market_question || position.marketQuestion || "";
          const unrealizedPnl = position.cashPnl !== undefined ? position.cashPnl.toString() : 
                               position.unrealizedPnl || position.unrealized_pnl || 
                               (avgPrice > 0 && currentPrice > 0 ? ((currentPrice - avgPrice) * size).toFixed(6) : undefined);
          const realizedPnl = position.realizedPnl !== undefined ? position.realizedPnl.toString() : 
                             position.realized_pnl;
          const percentPnl = position.percentPnl || 0;

          const processed: PortfolioPosition = {
            tokenId: tokenId,
            marketConditionId: marketId,
            outcome: outcome,
            size: size.toFixed(6),
            value: value.toFixed(6),
            averagePrice: avgPrice.toFixed(6),
            unrealizedPnl: unrealizedPnl,
            realizedPnl: realizedPnl,
            marketQuestion: marketQuestion,
          };

          // Try to get market info if not already present
          if (!processed.marketQuestion && processed.marketConditionId !== "Unknown") {
            try {
              const marketResponse = await fetch(
                `https://gamma-api.polymarket.com/markets?condition_ids=${processed.marketConditionId}`,
              );
              if (marketResponse.ok) {
                const marketData = (await marketResponse.json()) as any[];
                if (marketData.length > 0) {
                  processed.marketQuestion = marketData[0].question;
                }
              }
            } catch (marketError) {
              logger.warn(
                "[getPortfolioPositions] Failed to get market info:",
                marketError,
              );
            }
          }

          processedPositions.push(processed);
          totalValue += value;
        } catch (processError) {
          logger.warn(
            "[getPortfolioPositions] Error processing position:",
            processError,
          );
        }
      }

      // Skip wallet balance - not needed for portfolio display

      // Format response
      let responseText: string;
      let responseData: any;

      if (processedPositions.length === 0) {
        responseText = `📊 **Portfolio Positions**

**Current Holdings**: No active positions found

**Account Summary:**
• **Total Positions**: 0
• **Position Value**: $0.00
• **Total Trades**: ${trades.length}

**Status**: ${trades.length > 0 
  ? "You have trading history but no current positions." 
  : "No positions detected. Place some orders to see holdings here."}`;

        responseData = {
          success: true,
          positions: processedPositions,
          totalPositions: 0,
          totalValue: 0,
          totalTrades: trades.length,
          timestamp: new Date().toISOString(),
        };
      } else {
        // Format positions display
        const positionsDisplay = processedPositions
          .map((pos, index) => {
            const value = parseFloat(pos.value) || 0;
            const size = parseFloat(pos.size) || 0;
            const avgPrice = pos.averagePrice
              ? parseFloat(pos.averagePrice)
              : value / size;

            // Show full token ID - users need this for trading
            const tokenIdDisplay = pos.tokenId || "Unknown";
            const shortTokenId = pos.tokenId ? 
              (pos.tokenId.length > 30 ? `${pos.tokenId.slice(0, 30)}...` : pos.tokenId) : 
              "Unknown";

            const unrealizedPnl = parseFloat(pos.unrealizedPnl || "0");
            const pnlDisplay = unrealizedPnl !== 0 ? 
              `${unrealizedPnl >= 0 ? "+" : ""}$${Math.abs(unrealizedPnl).toFixed(2)}` : 
              "$0.00";
            const pnlPercentValue = avgPrice > 0 ? ((value / (size * avgPrice) - 1) * 100) : 0;
            const pnlPercentStr = pnlPercentValue.toFixed(1);

            return `**${index + 1}. ${(pos.outcome || "Unknown").toUpperCase()}** ${pos.marketQuestion ? `"${pos.marketQuestion}"` : `(${shortTokenId})`}
• **Size**: ${size.toFixed(2)} shares
• **Value**: $${value.toFixed(2)}
• **Avg Price**: $${avgPrice.toFixed(4)}
• **Current Price**: $${(value / size).toFixed(4)}
• **Unrealized P&L**: ${pnlDisplay} (${pnlPercentValue >= 0 ? "+" : ""}${pnlPercentStr}%)
• **Token ID**: ${tokenIdDisplay}`;
          })
          .join("\n\n");

        responseText = `📊 **Portfolio Positions**

**Current Holdings**: ${processedPositions.length} position${processedPositions.length === 1 ? "" : "s"}

${positionsDisplay}

**Account Summary:**
• **Total Positions**: ${processedPositions.length}
• **Position Value**: $${totalValue.toFixed(2)}`;

        responseData = {
          success: true,
          positions: processedPositions,
          totalPositions: processedPositions.length,
          totalValue,
          timestamp: new Date().toISOString(),
        };
      }

      const responseContent: Content = {
        text: responseText,
        actions: ["GET_PORTFOLIO_POSITIONS"],
        data: responseData,
      };

      if (callback) {
        await callback(responseContent);
      }

      return contentToActionResult(responseContent);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(
        "[getPortfolioPositionsAction] Error getting positions:",
        error,
      );

      const errorContent: Content = {
        text: `❌ **Portfolio Positions Error**

**Error**: ${errorMessage}

Unable to retrieve portfolio positions. This could be due to:
• API connectivity issues  
• Authentication problems
• Service unavailability

Please check your connection and try again.`,
        actions: ["GET_PORTFOLIO_POSITIONS"],
        data: {
          error: errorMessage,
          success: false,
        },
      };

      if (callback) {
        await callback(errorContent);
      }
      return createErrorResult(errorMessage);
    }
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: {
          text: "Show me my current portfolio positions",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll check your current Polymarket portfolio positions...",
          action: "GET_PORTFOLIO_POSITIONS",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "What are my holdings?",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "Let me get your current holdings and position values...",
          action: "GET_PORTFOLIO_POSITIONS",
        },
      },
    ],
  ],
};
