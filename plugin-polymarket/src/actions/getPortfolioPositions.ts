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
      // Initialize CLOB client
      const client = await initializeClobClient(runtime);

      if (callback) {
        await callback({
          text: "📊 **Retrieving Portfolio Positions**\n\nFetching your current holdings...",
          actions: ["GET_PORTFOLIO_POSITIONS"],
          data: { status: "fetching" },
        });
      }

      // Get positions from CLOB API
      let positions: any[] = [];
      let trades: any[] = [];
      let openOrders: any[] = [];

      try {
        // Try to get trade history to see executed orders
        logger.info("[getPortfolioPositions] Getting trade history...");
        const tradesResponse = await client.getTradesPaginated({});
        trades = Array.isArray(tradesResponse)
          ? tradesResponse
          : tradesResponse?.trades || [];
        logger.info(
          `[getPortfolioPositions] Retrieved ${trades.length} trades`,
        );
      } catch (tradesError) {
        logger.warn(
          "[getPortfolioPositions] Failed to get trades:",
          tradesError,
        );
      }

      try {
        // Get open orders
        logger.info("[getPortfolioPositions] Getting open orders...");
        const ordersResponse = await client.getOpenOrders({});
        openOrders = Array.isArray(ordersResponse)
          ? ordersResponse
          : ordersResponse || [];
        logger.info(
          `[getPortfolioPositions] Retrieved ${openOrders.length} open orders`,
        );
      } catch (ordersError) {
        logger.warn(
          "[getPortfolioPositions] Failed to get open orders:",
          ordersError,
        );
      }

      // Build positions from trades (this represents executed orders)
      const positionMap = new Map<string, any>();

      // Process completed trades to build positions
      for (const trade of trades) {
        const tokenId = trade.asset_id || trade.token_id;
        if (!tokenId) continue;

        const existing = positionMap.get(tokenId) || {
          tokenId: tokenId,
          marketConditionId: trade.market || "Unknown",
          outcome: trade.outcome || "Unknown",
          totalSize: 0,
          totalValue: 0,
          trades: [],
        };

        const size = parseFloat(trade.size || "0");
        const price = parseFloat(trade.price || "0");
        const value = size * price;

        if (trade.side === "BUY") {
          existing.totalSize += size;
          existing.totalValue += value;
        } else if (trade.side === "SELL") {
          existing.totalSize -= size;
          existing.totalValue -= value;
        }

        existing.trades.push(trade);
        positionMap.set(tokenId, existing);
      }

      // Convert to positions array, filtering out zero positions
      positions = Array.from(positionMap.values()).filter(
        (pos) => Math.abs(pos.totalSize) > 0.001,
      );

      // Process and format positions
      const processedPositions: PortfolioPosition[] = [];
      let totalValue = 0;

      for (const position of positions) {
        try {
          const avgPrice =
            position.totalSize > 0
              ? position.totalValue / position.totalSize
              : 0;

          const processed: PortfolioPosition = {
            tokenId: position.tokenId,
            marketConditionId: position.marketConditionId,
            outcome: position.outcome,
            size: position.totalSize.toFixed(6),
            value: position.totalValue.toFixed(6),
            averagePrice: avgPrice.toFixed(6),
            unrealizedPnl: undefined, // Would need current market price to calculate
            realizedPnl: undefined, // Would need to track sells vs buys
          };

          // Try to get market info for better display
          if (processed.marketConditionId !== "Unknown") {
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
          totalValue += position.totalValue;
        } catch (processError) {
          logger.warn(
            "[getPortfolioPositions] Error processing position:",
            processError,
          );
        }
      }

      // Get wallet balance for context
      let usdcBalance = "0";
      try {
        const balanceResponse = await client.getBalanceAllowance({
          asset_type: "COLLATERAL" as any,
        });
        usdcBalance = (
          parseFloat(balanceResponse.balance || "0") / 1000000
        ).toFixed(6);
      } catch (balanceError) {
        logger.warn(
          "[getPortfolioPositions] Failed to get balance:",
          balanceError,
        );
      }

      // Format response
      let responseText: string;
      let responseData: any;

      if (processedPositions.length === 0) {
        responseText = `📊 **Portfolio Positions**

**Current Holdings**: No active positions found

${
  openOrders.length > 0
    ? `**Open Orders**: ${openOrders.length} pending
${openOrders
  .slice(0, 5)
  .map(
    (order) =>
      `• ${order.side} ${order.size} @ $${order.price} (${order.status})`,
  )
  .join(
    "\n",
  )}${openOrders.length > 5 ? `\n• ... and ${openOrders.length - 5} more` : ""}

`
    : ""
}**Account Summary:**
• **Available USDC**: $${usdcBalance}
• **Total Positions**: 0
• **Position Value**: $0.00
• **Open Orders**: ${openOrders.length}
• **Total Trades**: ${trades.length}

${
  openOrders.length > 0
    ? "**Status**: You have pending orders that may execute soon."
    : trades.length > 0
      ? "**Status**: You have trading history but no current positions."
      : "**Status**: No positions detected. Place some orders to see holdings here."
}`;

        responseData = {
          success: true,
          positions: processedPositions,
          totalPositions: 0,
          totalValue: 0,
          usdcBalance,
          openOrders: openOrders.length,
          totalTrades: trades.length,
          rawTrades: trades.slice(0, 5), // Include some recent trades for debugging
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

            return `**${index + 1}. ${pos.outcome.toUpperCase()}** ${pos.marketQuestion ? `"${pos.marketQuestion}"` : `(${pos.tokenId.slice(0, 12)}...)`}
• **Size**: ${size.toFixed(2)} shares
• **Value**: $${value.toFixed(2)}
• **Avg Price**: $${avgPrice.toFixed(4)}
• **Token ID**: ${pos.tokenId.slice(0, 20)}...${pos.unrealizedPnl ? `\n• **Unrealized P&L**: $${parseFloat(pos.unrealizedPnl).toFixed(2)}` : ""}`;
          })
          .join("\n\n");

        responseText = `📊 **Portfolio Positions**

**Current Holdings**: ${processedPositions.length} position${processedPositions.length === 1 ? "" : "s"}

${positionsDisplay}

${
  openOrders.length > 0
    ? `**Open Orders**: ${openOrders.length} pending
${openOrders
  .slice(0, 3)
  .map(
    (order) =>
      `• ${order.side} ${order.size} @ $${order.price} (${order.status})`,
  )
  .join(
    "\n",
  )}${openOrders.length > 3 ? `\n• ... and ${openOrders.length - 3} more` : ""}

`
    : ""
}**Account Summary:**
• **Available USDC**: $${usdcBalance}
• **Total Positions**: ${processedPositions.length}
• **Position Value**: $${totalValue.toFixed(2)}
• **Open Orders**: ${openOrders.length}
• **Total Portfolio**: $${(parseFloat(usdcBalance) + totalValue).toFixed(2)}`;

        responseData = {
          success: true,
          positions: processedPositions,
          totalPositions: processedPositions.length,
          totalValue,
          usdcBalance,
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
