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
import { OrderSide, OrderType } from "../types";
import {
  contentToActionResult,
  createErrorResult,
} from "../utils/actionHelpers";
import {
  checkPolymarketBalance,
  formatBalanceInfo,
} from "../utils/balanceChecker";
import { ClobClient, Side } from "@polymarket/clob-client";

interface DirectSellParams {
  tokenId: string;
  price: number;
  size: number;
  orderType?: "GTC" | "FOK" | "GTD" | "FAK";
  marketName?: string;
}

// Polymarket minimum order constants
const POLYMARKET_MIN_ORDER_VALUE = 1.0; // $1 minimum order value

/**
 * Direct sell order action that bypasses LLM and uses API parameters directly
 * Used for automated selling and portfolio management
 */
export const directSellOrderAction: Action = {
  name: "DIRECT_SELL_ORDER",
  similes: [
    "DIRECT_SELL",
    "API_SELL",
    "BYPASS_SELL",
    "AUTOMATED_SELL",
    "SELL_POSITION",
    "LIQUIDATE",
  ],
  description:
    "Sell orders directly with API parameters, bypassing LLM extraction",

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
    logger.info("[directSellOrderAction] Direct sell order started");

    // Extract parameters from options or message
    const sellParams: DirectSellParams = {
      tokenId:
        (options?.tokenId as string) ||
        extractTokenId(message.content?.text || ""),
      price:
        (typeof options?.price === "number"
          ? options.price
          : extractPrice(message.content?.text || "")) || 0,
      size:
        (typeof options?.size === "number"
          ? options.size
          : extractSize(message.content?.text || "")) || 0,
      orderType: (options?.orderType as "GTC" | "FOK") || "FOK", // Default to FOK (market order)
      marketName: options?.marketName as string,
    };

    logger.info(
      "[directSellOrderAction] Extracted sell parameters:",
      sellParams,
    );

    // Validate required parameters
    if (!sellParams.tokenId || sellParams.price <= 0 || sellParams.size <= 0) {
      const errorMessage =
        "Invalid sell parameters. Required: tokenId, price > 0, size > 0";
      return createErrorResult(errorMessage);
    }

    // Calculate total order value
    const totalValue = sellParams.price * sellParams.size;

    // Check minimum order value (Polymarket requirement)
    if (totalValue < POLYMARKET_MIN_ORDER_VALUE) {
      const errorMessage = `Sell order value $${totalValue.toFixed(2)} is below Polymarket minimum of $${POLYMARKET_MIN_ORDER_VALUE}. Increase size or price.`;
      const errorContent: Content = {
        text: `❌ **Sell Order Below Minimum Value**

**Current Sell Order:**
• **Price**: $${sellParams.price.toFixed(4)} per share
• **Size**: ${sellParams.size} shares  
• **Total Value**: $${totalValue.toFixed(2)}

**Polymarket Requirement:**
• **Minimum Order**: $${POLYMARKET_MIN_ORDER_VALUE.toFixed(2)}
• **Shortfall**: $${(POLYMARKET_MIN_ORDER_VALUE - totalValue).toFixed(2)}

**Suggestions:**
• Increase size to ${Math.ceil(POLYMARKET_MIN_ORDER_VALUE / sellParams.price)} shares
• Or increase price to $${(POLYMARKET_MIN_ORDER_VALUE / sellParams.size).toFixed(4)} per share`,
        actions: ["DIRECT_SELL_ORDER"],
        data: {
          error: "Below minimum order value",
          currentValue: totalValue,
          minimumValue: POLYMARKET_MIN_ORDER_VALUE,
          sellParams,
        },
      };

      if (callback) {
        await callback(errorContent);
      }
      return contentToActionResult(errorContent);
    }

    try {
      // Initialize CLOB client
      const client = await initializeClobClient(runtime);

      // For market orders (FOK), get orderbook to determine best execution price
      if (sellParams.orderType === "FOK") {
        logger.info(
          "[directSellOrderAction] Getting orderbook for market sell order",
        );

        try {
          const orderbook = await client.getOrderBook(sellParams.tokenId);

          if (orderbook && orderbook.bids && orderbook.bids.length > 0) {
            // For market sell, use best bid price (or slightly below to ensure fill)
            const bestBid = parseFloat(orderbook.bids[0].price);
            const marketSellPrice = Math.max(0.01, bestBid * 0.99); // 1% below best bid

            logger.info(
              `[directSellOrderAction] Market sell pricing: bestBid=${bestBid}, sellPrice=${marketSellPrice}`,
            );

            // Update price for market execution
            sellParams.price = marketSellPrice;

            if (callback) {
              await callback({
                text: `📊 **Orderbook Analysis for Market Sell**

**Current Market:**
• **Best Bid**: $${bestBid.toFixed(4)}
• **Market Sell Price**: $${marketSellPrice.toFixed(4)} (99% of best bid)
• **Expected Immediate Execution**: Yes

Proceeding with market sell order...`,
                actions: ["DIRECT_SELL_ORDER"],
                data: {
                  orderbook: { bestBid, marketSellPrice },
                  status: "orderbook_analyzed",
                },
              });
            }
          } else {
            logger.warn(
              "[directSellOrderAction] No bids in orderbook - using provided price",
            );

            if (callback) {
              await callback({
                text: `⚠️ **No Bids Available**

Using provided price of $${sellParams.price.toFixed(4)} for market sell.
Order may not execute immediately if price is too high.`,
                actions: ["DIRECT_SELL_ORDER"],
                data: { status: "no_bids_available" },
              });
            }
          }
        } catch (orderbookError) {
          logger.warn(
            "[directSellOrderAction] Failed to get orderbook:",
            orderbookError,
          );

          if (callback) {
            await callback({
              text: `⚠️ **Orderbook Unavailable**

Could not fetch current market prices. Using provided price of $${sellParams.price.toFixed(4)}.
Market sell may not execute if price is not competitive.`,
              actions: ["DIRECT_SELL_ORDER"],
              data: { status: "orderbook_error" },
            });
          }
        }
      }

      // Check and derive API credentials if needed
      const hasApiKey = runtime.getSetting("CLOB_API_KEY");
      const hasApiSecret =
        runtime.getSetting("CLOB_API_SECRET") ||
        runtime.getSetting("CLOB_SECRET");
      const hasApiPassphrase =
        runtime.getSetting("CLOB_API_PASSPHRASE") ||
        runtime.getSetting("CLOB_PASS_PHRASE");

      if (!hasApiKey || !hasApiSecret || !hasApiPassphrase) {
        logger.info("[directSellOrderAction] Deriving API credentials");

        if (callback) {
          await callback({
            text: "🔑 Deriving API credentials for sell order...",
            actions: ["DIRECT_SELL_ORDER"],
            data: { status: "deriving_credentials" },
          });
        }

        const derivedCreds = await client.createOrDeriveApiKey();
        await runtime.setSetting("CLOB_API_KEY", derivedCreds.key);
        await runtime.setSetting("CLOB_API_SECRET", derivedCreds.secret);
        await runtime.setSetting(
          "CLOB_API_PASSPHRASE",
          derivedCreds.passphrase,
        );

        logger.info(
          "[directSellOrderAction] API credentials derived successfully",
        );
      }

      // Re-initialize client with credentials
      const authenticatedClient = await initializeClobClient(runtime);

      // Get current balance for context (selling increases USDC balance)
      let currentBalance = "0";
      try {
        const balanceResponse = await authenticatedClient.getBalanceAllowance({
          asset_type: "COLLATERAL" as any,
        });
        currentBalance = (
          parseFloat(balanceResponse.balance || "0") / 1000000
        ).toFixed(6);
      } catch (balanceError) {
        logger.warn(
          "[directSellOrderAction] Failed to get current balance:",
          balanceError,
        );
      }

      // Create sell order arguments
      const orderArgs = {
        tokenID: sellParams.tokenId,
        price: sellParams.price,
        side: Side.SELL,
        size: sellParams.size,
        feeRateBps: 0,
      };

      logger.info(
        "[directSellOrderAction] Creating sell order with args:",
        orderArgs,
      );

      if (callback) {
        await callback({
          text: `📋 **Creating Sell Order**

**Sell Order Details:**
• **Token ID**: ${sellParams.tokenId.slice(0, 20)}...
• **Side**: SELL
• **Price**: $${sellParams.price.toFixed(4)}
• **Size**: ${sellParams.size} shares
• **Total**: $${totalValue.toFixed(2)} (expected proceeds)
• **Current Balance**: $${currentBalance}

Creating signed sell order...`,
          actions: ["DIRECT_SELL_ORDER"],
          data: { status: "creating_sell_order", sellDetails: sellParams },
        });
      }

      // Create the signed sell order
      const signedOrder = await authenticatedClient.createOrder(orderArgs);
      logger.info("[directSellOrderAction] Sell order created successfully");

      // Post the sell order
      const orderResponse = await authenticatedClient.postOrder(
        signedOrder,
        sellParams.orderType as OrderType,
      );
      logger.info("[directSellOrderAction] Sell order posted successfully");

      // Get updated balance to show proceeds
      let newBalance = currentBalance;
      try {
        // Wait a moment for order to process
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const balanceResponse = await authenticatedClient.getBalanceAllowance({
          asset_type: "COLLATERAL" as any,
        });
        newBalance = (
          parseFloat(balanceResponse.balance || "0") / 1000000
        ).toFixed(6);
      } catch (balanceError) {
        logger.warn(
          "[directSellOrderAction] Failed to get updated balance:",
          balanceError,
        );
      }

      // Format response
      let responseText: string;
      let responseData: any;

      if (orderResponse.success) {
        const balanceChange =
          parseFloat(newBalance) - parseFloat(currentBalance);
        const effectivePrice =
          balanceChange > 0
            ? balanceChange / sellParams.size
            : sellParams.price;

        responseText = `✅ **Direct Sell Order Placed Successfully**

**Sell Order Details:**
• **Type**: ${sellParams.orderType === "FOK" ? "market" : sellParams.orderType?.toLowerCase() || "FOK"} sell order
• **Token ID**: ${sellParams.tokenId.slice(0, 20)}...
• **Price**: $${sellParams.price.toFixed(4)} (${(sellParams.price * 100).toFixed(2)}%)
• **Size**: ${sellParams.size} shares
• **Expected Proceeds**: $${totalValue.toFixed(2)}

**Order Response:**
• **Order ID**: ${orderResponse.orderId || "Pending"}
• **Status**: ${orderResponse.status || "submitted"}
${
  orderResponse.orderHashes && orderResponse.orderHashes.length > 0
    ? `• **Transaction Hash(es)**: ${orderResponse.orderHashes.join(", ")}`
    : ""
}

**Balance Update:**
• **Previous Balance**: $${currentBalance}
• **Current Balance**: $${newBalance}
• **Change**: ${balanceChange >= 0 ? "+" : ""}$${balanceChange.toFixed(2)}
${balanceChange > 0 ? `• **Effective Price**: $${effectivePrice.toFixed(4)} per share` : ""}

${
  orderResponse.status === "matched"
    ? "🎉 Your market sell order was immediately executed! USDC added to account!"
    : orderResponse.status === "delayed"
      ? "⏳ Your sell order is subject to a matching delay due to market conditions."
      : sellParams.orderType === "FOK"
        ? "❌ Market sell order could not be filled immediately."
        : "📋 Your sell order has been placed and is waiting to be matched."
}`;

        responseData = {
          success: true,
          sellDetails: sellParams,
          orderResponse,
          totalValue,
          balanceChange,
          previousBalance: currentBalance,
          newBalance,
          timestamp: new Date().toISOString(),
        };
      } else {
        responseText = `❌ **Direct Sell Order Placement Failed**

**Error**: ${orderResponse.errorMsg || "Unknown error"}

**Sell Order Details Attempted:**
• **Token ID**: ${sellParams.tokenId.slice(0, 20)}...
• **Price**: $${sellParams.price.toFixed(4)}
• **Size**: ${sellParams.size} shares
• **Order Type**: ${sellParams.orderType}

Please check your parameters and try again. Common issues:
• Invalid token ID or market closed
• Insufficient position size to sell
• Price outside acceptable range
• Network connectivity issues`;

        responseData = {
          success: false,
          error: orderResponse.errorMsg,
          sellDetails: sellParams,
          timestamp: new Date().toISOString(),
        };
      }

      const responseContent: Content = {
        text: responseText,
        actions: ["DIRECT_SELL_ORDER"],
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
        "[directSellOrderAction] Sell order placement failed:",
        error,
      );

      const errorContent: Content = {
        text: `❌ **Direct Sell Order Error**

**Error**: ${errorMessage}

**Sell Order Details:**
• **Token ID**: ${sellParams.tokenId.slice(0, 20)}...
• **Price**: $${sellParams.price.toFixed(4)}
• **Size**: ${sellParams.size} shares

Direct API sell order placement failed. Common causes:
• You don't own enough shares to sell
• Market is closed or inactive
• API connectivity issues
• Invalid token or market parameters`,
        actions: ["DIRECT_SELL_ORDER"],
        data: {
          error: errorMessage,
          sellDetails: sellParams,
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
          text: "Direct sell 5 shares of token 114304586861386186441621124384163963092522056897081085884483958561365015034812 at $0.15",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "Placing direct sell order via API...",
          action: "DIRECT_SELL_ORDER",
        },
      },
    ],
  ],
};

// Helper functions for parameter extraction (same as buy order)
function extractTokenId(text: string): string {
  const tokenMatch = text.match(/(?:token|id)\s+([0-9]{50,})/i);
  return tokenMatch?.[1] || "";
}

function extractPrice(text: string): number {
  const priceMatch = text.match(/(?:at|price)\s*\$?([0-9]*\.?[0-9]+)/i);
  return priceMatch ? parseFloat(priceMatch[1]) : 0;
}

function extractSize(text: string): number {
  const sizeMatch = text.match(/([0-9]*\.?[0-9]+)\s*(?:shares|tokens)/i);
  return sizeMatch ? parseFloat(sizeMatch[1]) : 0;
}
