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
import { callLLMWithTimeout } from "../utils/llmHelpers";
import { initializeClobClient } from "../utils/clobClient";
import {
  contentToActionResult,
  createErrorResult,
} from "../utils/actionHelpers";
import {
  extractOrderBookPrices,
  calculateTradingPrices,
  formatPrice,
} from "../utils/priceHelpers";

interface MarketPriceParams {
  tokenId?: string;
  error?: string;
}

interface PriceInfo {
  tokenId: string;
  bestBid: number;
  bestAsk: number;
  midPrice: number;
  spread: number;
  spreadPercent: number;
  recommendedBuyPrice: number;
  recommendedSellPrice: number;
  liquidityBid: number;
  liquidityAsk: number;
}

/**
 * Get current market price action for Polymarket tokens
 * Analyzes orderbook to provide realistic pricing for trades
 */
export const getMarketPriceAction: Action = {
  name: "GET_MARKET_PRICE",
  similes: [
    "GET_MARKET_PRICE",
    "GET_PRICE",
    "CHECK_PRICE",
    "MARKET_PRICE",
    "CURRENT_PRICE",
    "PRICE_CHECK",
    "GET_QUOTES",
    "PRICE_DISCOVERY",
    "MARKET_QUOTES",
    "BID_ASK_PRICE",
    "TRADING_PRICE",
  ],
  description:
    "Get current market price and trading recommendations for a Polymarket token",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    logger.info(
      `[getMarketPriceAction] Validate called for message: "${message.content?.text}"`,
    );

    const clobApiUrl = runtime.getSetting("CLOB_API_URL");

    if (!clobApiUrl) {
      logger.warn(
        "[getMarketPriceAction] CLOB_API_URL is required but not provided",
      );
      return false;
    }

    logger.info("[getMarketPriceAction] Validation passed");
    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    logger.info("[getMarketPriceAction] Handler called!");

    const clobApiUrl = runtime.getSetting("CLOB_API_URL");

    if (!clobApiUrl) {
      const errorMessage = "CLOB_API_URL is required in configuration.";
      logger.error(
        `[getMarketPriceAction] Configuration error: ${errorMessage}`,
      );
      return createErrorResult(errorMessage);
    }

    let tokenId = "";

    try {
      // Use LLM to extract token ID
      const llmResult = await callLLMWithTimeout<MarketPriceParams>(
        runtime,
        state,
        `Extract the token ID from the user's message for price checking.

User message: "{{recentMessages}}"

Look for:
1. Long numeric token IDs (70+ digits)
2. Hexadecimal token IDs (starting with 0x)
3. References to specific markets or tokens

Return a JSON object with:
- tokenId: the token ID to get pricing for
- error: description if no token ID found

Examples:
"Get price for token 123456789..." -> {"tokenId": "123456789..."}
"What's the current price of 0xabc..." -> {"tokenId": "0xabc..."}
"Check market price" -> {"error": "No specific token ID provided"}`,
        "getMarketPriceAction",
      );

      logger.info(
        "[getMarketPriceAction] LLM result:",
        JSON.stringify(llmResult),
      );

      if (llmResult?.error) {
        return createErrorResult(
          'Please specify a token ID to get pricing for. Example: "Get price for token 123456789..."',
        );
      }

      tokenId = llmResult?.tokenId || "";
    } catch (error) {
      logger.warn(
        "[getMarketPriceAction] LLM extraction failed, trying regex fallback",
      );

      // Fallback to regex extraction
      const text = message.content?.text || "";

      // Look for long numeric token IDs
      const tokenMatch =
        text.match(/(?:token|id)\s+(\d{50,})/i) || text.match(/(\d{70,})/);

      if (tokenMatch) {
        tokenId = tokenMatch[1];
      }

      if (!tokenId) {
        const errorMessage = "Please provide a token ID to get pricing for.";

        const errorContent: Content = {
          text: `❌ **Token ID Required**

Please specify a token ID to get current market pricing.

**Examples:**
• "Get price for token 110911393156699128240765920158928840337199547754402639514182164506911446042781"
• "Check market price for 123456789..."
• "What's the current price of token ABC123"

**Token ID Format:**
• Usually 70+ digit numbers for Polymarket
• Can be hexadecimal (starting with 0x)
• Found in market URLs or previous trading data`,
          actions: ["GET_MARKET_PRICE"],
          data: { error: errorMessage },
        };

        if (callback) {
          await callback(errorContent);
        }
        return createErrorResult(errorMessage);
      }
    }

    try {
      // Initialize CLOB client
      const client = await initializeClobClient(runtime);

      if (callback) {
        const startContent: Content = {
          text: `📊 **Getting Market Price**

**Token ID**: ${tokenId.substring(0, 20)}...
**Source**: Polymarket CLOB Orderbook

Analyzing current market conditions...`,
          actions: ["GET_MARKET_PRICE"],
          data: { tokenId, step: "fetching" },
        };
        await callback(startContent);
      }

      // Fetch order book data for both sides
      logger.info(
        `[getMarketPriceAction] Fetching orderbook for token: ${tokenId}`,
      );

      const [buyBook, sellBook] = await Promise.all([
        client.getOrderBooks([{ token_id: tokenId, side: "buy" as any }]),
        client.getOrderBooks([{ token_id: tokenId, side: "sell" as any }]),
      ]);

      if (
        !buyBook ||
        buyBook.length === 0 ||
        !sellBook ||
        sellBook.length === 0
      ) {
        return createErrorResult(
          `No orderbook data found for token ID: ${tokenId.substring(0, 20)}...`,
        );
      }

      const orderBook = {
        ...buyBook[0],
        bids: sellBook[0].bids, // bids are sells from the user's perspective
        asks: buyBook[0].asks, // asks are buys from the user's perspective
      };

      // Extract pricing information using utility functions
      const { bestBid, bestAsk, bidSize, askSize } = extractOrderBookPrices(orderBook);

      if (!bestBid && !bestAsk) {
        return createErrorResult(
          `No active pricing found for token ID: ${tokenId.substring(0, 20)}...`,
        );
      }

      // Use fallback values if one side is missing
      const safeBestBid = bestBid || 0;
      const safeBestAsk = bestAsk || 0;
      const bidLiquidity = bidSize || 0;
      const askLiquidity = askSize || 0;

      // Calculate derived pricing metrics using utility functions
      const {
        recommendedBuyPrice,
        recommendedSellPrice,
        midPrice,
        spread,
        spreadPercent,
      } = calculateTradingPrices(safeBestBid, safeBestAsk);

      const priceInfo: PriceInfo = {
        tokenId,
        bestBid: safeBestBid,
        bestAsk: safeBestAsk,
        midPrice,
        spread,
        spreadPercent,
        recommendedBuyPrice,
        recommendedSellPrice,
        liquidityBid: bidLiquidity,
        liquidityAsk: askLiquidity,
      };

      // Format response
      let responseText = `📊 **Market Price Analysis**\n\n`;

      responseText += `**Token Information:**\n`;
      responseText += `• Token ID: \`${tokenId.substring(0, 12)}...\`\n`;
      responseText += `• Market: ${orderBook.market || "Unknown"}\n\n`;

      responseText += `**Current Pricing:**\n`;
      if (safeBestBid > 0) {
        const bidFormatted = formatPrice(safeBestBid);
        responseText += `• **Best Bid**: ${bidFormatted.display} (${bidFormatted.cents}) - ${bidLiquidity.toFixed(0)} available\n`;
      } else {
        responseText += `• **Best Bid**: No bids available\n`;
      }

      if (safeBestAsk > 0) {
        const askFormatted = formatPrice(safeBestAsk);
        responseText += `• **Best Ask**: ${askFormatted.display} (${askFormatted.cents}) - ${askLiquidity.toFixed(0)} available\n`;
      } else {
        responseText += `• **Best Ask**: No asks available\n`;
      }

      if (safeBestBid > 0 && safeBestAsk > 0) {
        const midFormatted = formatPrice(midPrice);
        const spreadFormatted = formatPrice(spread);
        responseText += `• **Mid Price**: ${midFormatted.display} (${midFormatted.cents})\n`;
        responseText += `• **Spread**: ${spreadFormatted.display} (${spreadPercent.toFixed(2)}%)\n\n`;

        responseText += `**🎯 Trading Recommendations:**\n`;
        const buyFormatted = formatPrice(recommendedBuyPrice);
        const sellFormatted = formatPrice(recommendedSellPrice);
        responseText += `• **To Buy**: Use ${buyFormatted.display} (${buyFormatted.cents})\n`;
        responseText += `• **To Sell**: Use ${sellFormatted.display} (${sellFormatted.cents})\n\n`;

        // Market assessment
        if (spreadPercent < 2) {
          responseText += `📈 **Market Assessment**: Tight spread - liquid market\n`;
        } else if (spreadPercent < 5) {
          responseText += `📊 **Market Assessment**: Moderate spread - normal liquidity\n`;
        } else {
          responseText += `📉 **Market Assessment**: Wide spread - low liquidity\n`;
        }

        // Trading advice
        const minOrderValue = 5 * recommendedBuyPrice; // 5 tokens minimum
        responseText += `\n💡 **For 5 tokens (minimum):**\n`;
        responseText += `• **Buy Cost**: ~$${minOrderValue.toFixed(2)}\n`;
        responseText += `• **Sell Value**: ~$${(5 * recommendedSellPrice).toFixed(2)}\n`;
      }

      const responseContent: Content = {
        text: responseText,
        actions: ["GET_MARKET_PRICE"],
        data: {
          success: true,
          priceInfo,
          timestamp: new Date().toISOString(),
        },
      };

      if (callback) {
        await callback(responseContent);
      }

      return contentToActionResult(responseContent);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error occurred while fetching market price";
      logger.error(`[getMarketPriceAction] Price fetch error:`, error);

      const errorContent: Content = {
        text: `❌ **Market Price Fetch Failed**

**Error**: ${errorMessage}

This could be due to:
• Invalid or inactive token ID
• Network connectivity issues
• Market not currently active
• API rate limiting

**Token ID**: ${tokenId.substring(0, 20)}...

Please verify the token ID is correct and the market is active.`,
        actions: ["GET_MARKET_PRICE"],
        data: {
          error: errorMessage,
          tokenId,
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
          text: "Get current price for token 110911393156699128240765920158928840337199547754402639514182164506911446042781",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll get the current market price and trading recommendations for that token...",
          action: "GET_MARKET_PRICE",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "What is the current market price?",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I need a specific token ID to get pricing. Please provide the token ID you want to check.",
          action: "GET_MARKET_PRICE",
        },
      },
    ],
  ],
};
