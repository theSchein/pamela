import {
  type Action,
  type ActionResult,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
  ModelType,
  composePromptFromState,
} from "@elizaos/core";
import { callLLMWithTimeout } from "../utils/llmHelpers";
import { initializeClobClient } from "../utils/clobClient";
import { orderTemplate } from "../templates";
import { OrderSide, OrderType } from "../types";
import {
  contentToActionResult,
  createErrorResult,
} from "../utils/actionHelpers";
import {
  checkUSDCBalance,
  checkPolymarketBalance,
  formatBalanceInfo,
  getMaxPositionSize,
} from "../utils/balanceChecker";
import { findMarketByName } from "../utils/marketLookup";
import { ClobClient, Side } from "@polymarket/clob-client";
import { ethers } from "ethers";

interface PlaceOrderParams {
  tokenId: string;
  side: string;
  price: number;
  size: number;
  orderType?: string;
  feeRateBps?: string;
  marketName?: string;
  outcome?: string; // YES/NO for outcome-based trading
}

/**
 * Place order action for Polymarket
 * Creates and places both limit and market orders
 */
export const placeOrderAction: Action = {
  name: "PLACE_ORDER",
  similes: [
    "CREATE_ORDER",
    "PLACE_ORDER",
    "BUY_TOKEN",
    "SELL_TOKEN",
    "LIMIT_ORDER",
    "MARKET_ORDER",
    "TRADE",
    "ORDER",
    "BUY",
    "SELL",
    "PURCHASE",
    "PLACE_BUY",
    "PLACE_SELL",
    "CREATE_BUY_ORDER",
    "CREATE_SELL_ORDER",
    "SUBMIT_ORDER",
    "EXECUTE_ORDER",
    "MAKE_ORDER",
    "PLACE_TRADE",
  ],
  description: "Create and place limit or market orders on Polymarket",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    logger.info(
      `[placeOrderAction] Validate called for message: "${message.content?.text}"`,
    );

    const clobApiUrl = runtime.getSetting("CLOB_API_URL");

    if (!clobApiUrl) {
      logger.warn(
        "[placeOrderAction] CLOB_API_URL is required but not provided",
      );
      return false;
    }

    logger.info("[placeOrderAction] Validation passed");
    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    logger.info("[placeOrderAction] Handler called!");

    const clobApiUrl = runtime.getSetting("CLOB_API_URL");

    if (!clobApiUrl) {
      const errorMessage = "CLOB_API_URL is required in configuration.";
      logger.error(`[placeOrderAction] Configuration error: ${errorMessage}`);
      const errorContent: Content = {
        text: errorMessage,
        actions: ["PLACE_ORDER"],
        data: { error: errorMessage },
      };

      if (callback) {
        await callback(errorContent);
      }
      return createErrorResult(errorMessage);
    }

    let tokenId: string;
    let side: string;
    let price: number;
    let size: number;
    let orderType: string = "GTC"; // Default to Good Till Cancelled
    let feeRateBps: string = "0"; // Default fee

    try {
      // Use LLM to extract parameters
      const llmResult = await callLLMWithTimeout<
        PlaceOrderParams & { error?: string }
      >(runtime, state, orderTemplate, "placeOrderAction");

      logger.info("[placeOrderAction] LLM result:", JSON.stringify(llmResult));

      if (llmResult?.error) {
        return createErrorResult("Required order parameters not found");
      }

      tokenId = llmResult?.tokenId || "";
      side = llmResult?.side?.toUpperCase() || "";
      price = llmResult?.price || 0;
      size = llmResult?.size || 1; // Default to 1 share if not specified
      orderType =
        llmResult?.orderType?.toLowerCase() || (price > 0 ? "limit" : "market");
      feeRateBps = llmResult?.feeRateBps || "0";

      // Convert order types to CLOB client format
      if (orderType === "limit") {
        orderType = "GTC"; // Good Till Cancelled
      } else if (orderType === "market") {
        orderType = "FOK"; // Fill Or Kill (market order)
        // For market orders, we need to get the current market price
        if (price <= 0) {
          // We'll set a reasonable price for market orders - this will be updated later
          price = side === "BUY" ? 0.999 : 0.001; // Aggressive pricing for market orders
        }
      }

      // Handle market name lookup - try to resolve to token ID
      if (
        (tokenId === "MARKET_NAME_LOOKUP" || !tokenId || tokenId.length < 10) &&
        llmResult?.marketName
      ) {
        logger.info(
          `[placeOrderAction] Market name lookup requested: ${llmResult.marketName}`,
        );

        try {
          const marketResult = await findMarketByName(
            runtime,
            llmResult.marketName,
          );

          if (!marketResult) {
            const errorContent: Content = {
              text: `❌ **Market not found: "${llmResult.marketName}"**

I couldn't find an active market matching that name.

**Please try:**
1. "Show me open markets" to see available markets
2. Be more specific with the market name
3. Use quotes around the exact market name

**Example:**
- "Show me open markets"
- "Buy YES in 'Macron out in 2025?'" 
- "Trade on the Chiefs vs Raiders market"`,
              actions: ["POLYMARKET_GET_OPEN_MARKETS"],
              data: {
                error: "Market not found",
                marketName: llmResult.marketName,
              },
            };

            if (callback) {
              await callback(errorContent);
            }
            return contentToActionResult(errorContent);
          }

          // Determine which token to use based on outcome (YES/NO)
          const outcome =
            llmResult.outcome?.toUpperCase() || side.toUpperCase() === "BUY"
              ? "YES"
              : "NO";
          const targetToken = marketResult.tokens.find(
            (t) => t.outcome.toUpperCase() === outcome,
          );

          if (!targetToken) {
            const availableOutcomes = marketResult.tokens
              .map((t) => t.outcome)
              .join(", ");
            const errorContent: Content = {
              text: `❌ **Outcome not found in market**

Market: "${marketResult.market.question}"
Available outcomes: ${availableOutcomes}
Requested outcome: ${outcome}

**Please specify:**
- "Buy YES in [market name]"
- "Buy NO in [market name]"
- Or use the exact outcome names listed above`,
              actions: ["POLYMARKET_PLACE_ORDER"],
              data: {
                error: "Outcome not found",
                market: marketResult.market,
                availableOutcomes: marketResult.tokens.map((t) => t.outcome),
                requestedOutcome: outcome,
              },
            };

            if (callback) {
              await callback(errorContent);
            }
            return contentToActionResult(errorContent);
          }

          // Success! Update tokenId with resolved token
          tokenId = targetToken.token_id;
          logger.info(
            `[placeOrderAction] Resolved "${llmResult.marketName}" -> ${outcome} -> ${tokenId.slice(0, 12)}...`,
          );

          // Show market resolution to user
          if (callback) {
            const resolutionContent: Content = {
              text: `✅ **Market Resolved**

**Market**: ${marketResult.market.question}
**Outcome**: ${targetToken.outcome}
**Token ID**: ${tokenId.slice(0, 12)}...

Proceeding with order verification...`,
              actions: ["POLYMARKET_PLACE_ORDER"],
              data: {
                marketResolution: {
                  market: marketResult.market,
                  selectedToken: targetToken,
                  resolvedTokenId: tokenId,
                },
              },
            };
            await callback(resolutionContent);
          }
        } catch (lookupError) {
          logger.error(`[placeOrderAction] Market lookup failed:`, lookupError);
          const errorContent: Content = {
            text: `❌ **Market lookup failed**

Error finding market: "${llmResult.marketName}"

This could be due to:
• Database connectivity issues
• Market not synchronized
• Invalid market name

**Please try:**
- "Show me open markets" to browse available markets
- Use more specific market names
- Check spelling and try again`,
            actions: ["POLYMARKET_GET_OPEN_MARKETS"],
            data: {
              error: "Market lookup failed",
              marketName: llmResult.marketName,
              lookupError:
                lookupError instanceof Error
                  ? lookupError.message
                  : "Unknown error",
            },
          };

          if (callback) {
            await callback(errorContent);
          }
          return createErrorResult("Market lookup failed");
        }
      }

      // Updated validation - price can be 0 for market orders
      if (!tokenId || !side || size <= 0) {
        return createErrorResult("Invalid order parameters");
      }

      // For market orders without explicit price, price will be set later
      if (orderType === "GTC" && price <= 0) {
        return createErrorResult("Limit orders require a valid price");
      }
    } catch (error) {
      logger.warn(
        "[placeOrderAction] LLM extraction failed, trying regex fallback",
      );

      // Fallback to regex extraction
      const text = message.content?.text || "";

      // Extract token ID
      const tokenMatch = text.match(
        /(?:token|market|id)\s+([a-zA-Z0-9]+)|([0-9]{5,})/i,
      );
      tokenId = tokenMatch?.[1] || tokenMatch?.[2] || "";

      // Extract side
      const sideMatch = text.match(/\b(buy|sell|long|short)\b/i);
      side = sideMatch?.[1]?.toUpperCase() || "BUY";

      // Extract price
      const priceMatch = text.match(/(?:price|at|for)\s*\$?([0-9]*\.?[0-9]+)/i);
      price = priceMatch ? parseFloat(priceMatch[1]) : 0;

      // Extract size
      const sizeMatch = text.match(
        /(?:size|amount|quantity)\s*([0-9]*\.?[0-9]+)|([0-9]*\.?[0-9]+)\s*(?:shares|tokens)/i,
      );
      size = sizeMatch ? parseFloat(sizeMatch[1] || sizeMatch[2]) : 1; // Default to 1 share

      // Extract order type
      const orderTypeMatch = text.match(/\b(GTC|FOK|GTD|FAK|limit|market)\b/i);
      if (orderTypeMatch) {
        const matched = orderTypeMatch[1].toUpperCase();
        orderType =
          matched === "LIMIT" ? "GTC" : matched === "MARKET" ? "FOK" : matched;
      } else {
        // Default to market order if no price specified
        orderType = price > 0 ? "GTC" : "FOK";
      }

      // Set market order pricing if no price given
      if (orderType === "FOK" && price <= 0) {
        price = side === "BUY" ? 0.999 : 0.001; // Aggressive pricing for market orders
      }

      if (!tokenId || size <= 0 || (orderType === "GTC" && price <= 0)) {
        const errorMessage =
          "Please provide valid order parameters: token ID, price, and size.";
        logger.error(`[placeOrderAction] Parameter extraction failed`);

        const errorContent: Content = {
          text: `❌ **Error**: ${errorMessage}

Please provide order details in your request. Examples:
• "Buy 100 tokens of 123456 at $0.50 limit order"
• "Sell 50 shares of token 789012 at $0.75"
• "Place market order to buy 25 tokens of 456789"

**Required parameters:**
- Token ID (market identifier)
- Side (buy/sell)
- Price (in USD, 0-1.0 for prediction markets)
- Size (number of shares)

**Optional parameters:**
- Order type (GTC/limit, FOK/market, GTD, FAK)
- Fee rate (in basis points)`,
          actions: ["PLACE_ORDER"],
          data: { error: errorMessage },
        };

        if (callback) {
          await callback(errorContent);
        }
        return createErrorResult(errorMessage);
      }
    }

    // Validate parameters
    if (!["BUY", "SELL"].includes(side)) {
      side = "BUY"; // Default to buy
    }

    if (price > 1.0) {
      price = price / 100; // Convert percentage to decimal if needed
    }

    if (!["GTC", "FOK", "GTD", "FAK"].includes(orderType)) {
      orderType = "GTC"; // Default to GTC
    }

    // Calculate total order value
    const totalValue = price * size;

    // Check Polymarket trading balance before placing order
    logger.info(
      `[placeOrderAction] Checking Polymarket trading balance for order value: $${totalValue.toFixed(2)}`,
    );

    try {
      const balanceInfo = await checkPolymarketBalance(
        runtime,
        totalValue.toString(),
      );

      if (!balanceInfo.hasEnoughBalance) {
        const balanceDisplay = formatBalanceInfo(balanceInfo);
        const errorContent: Content = {
          text: `${balanceDisplay}

**Order Details:**
• **Token ID**: ${tokenId}
• **Side**: ${side}
• **Price**: $${price.toFixed(4)} (${(price * 100).toFixed(2)}%)
• **Size**: ${size} shares
• **Total Value**: $${totalValue.toFixed(2)}

Please add more USDC to your wallet and try again.`,
          actions: ["POLYMARKET_PLACE_ORDER"],
          data: {
            error: "Insufficient USDC balance",
            balanceInfo,
            orderDetails: { tokenId, side, price, size, totalValue },
          },
        };

        if (callback) {
          await callback(errorContent);
        }
        return createErrorResult("Insufficient USDC balance for order");
      }

      // Check position size limits
      const maxPositionSize = await getMaxPositionSize(runtime);
      if (totalValue > maxPositionSize) {
        const errorContent: Content = {
          text: `❌ **Order Exceeds Position Limit**

**Position Limit Check:**
• **Max Position Size**: $${maxPositionSize.toFixed(2)}
• **Requested Order**: $${totalValue.toFixed(2)}
• **Excess Amount**: $${(totalValue - maxPositionSize).toFixed(2)}

**Order Details:**
• **Token ID**: ${tokenId}
• **Side**: ${side}
• **Price**: $${price.toFixed(4)}
• **Size**: ${size} shares

Please reduce your order size to stay within the configured limit.`,
          actions: ["POLYMARKET_PLACE_ORDER"],
          data: {
            error: "Order exceeds position limit",
            maxPositionSize,
            requestedAmount: totalValue,
            orderDetails: { tokenId, side, price, size },
          },
        };

        if (callback) {
          await callback(errorContent);
        }
        return createErrorResult("Order exceeds maximum position size limit");
      }

      // Display successful balance check
      logger.info(
        `[placeOrderAction] Balance check passed. Proceeding with order.`,
      );
      const balanceDisplay = formatBalanceInfo(balanceInfo);

      if (callback) {
        const balanceContent: Content = {
          text: `${balanceDisplay}

**Proceeding with Order:**
• **Token ID**: ${tokenId}
• **Side**: ${side}
• **Price**: $${price.toFixed(4)} (${(price * 100).toFixed(2)}%)
• **Size**: ${size} shares
• **Total Value**: $${totalValue.toFixed(2)}

Creating order...`,
          actions: ["POLYMARKET_PLACE_ORDER"],
          data: {
            balanceInfo,
            orderDetails: { tokenId, side, price, size, totalValue },
          },
        };
        await callback(balanceContent);
      }
    } catch (balanceError) {
      logger.error(`[placeOrderAction] Balance check failed:`, balanceError);
      const errorContent: Content = {
        text: `❌ **Balance Check Failed**

Unable to verify wallet balance before placing order. This could be due to:
• Network connectivity issues
• RPC provider problems  
• Wallet configuration errors

**Order Details:**
• **Token ID**: ${tokenId}
• **Side**: ${side}
• **Price**: $${price.toFixed(4)}
• **Size**: ${size} shares
• **Total Value**: $${totalValue.toFixed(2)}

Please check your wallet configuration and try again.`,
        actions: ["POLYMARKET_PLACE_ORDER"],
        data: {
          error: "Balance check failed",
          balanceError:
            balanceError instanceof Error
              ? balanceError.message
              : "Unknown error",
          orderDetails: { tokenId, side, price, size, totalValue },
        },
      };

      if (callback) {
        await callback(errorContent);
      }
      return createErrorResult(
        "Failed to verify wallet balance before order placement",
      );
    }

    try {
      // Check if we have API credentials, if not try to derive them
      logger.info(`[placeOrderAction] Checking for API credentials`);

      const hasApiKey = runtime.getSetting("CLOB_API_KEY");
      const hasApiSecret =
        runtime.getSetting("CLOB_API_SECRET") ||
        runtime.getSetting("CLOB_SECRET");
      const hasApiPassphrase =
        runtime.getSetting("CLOB_API_PASSPHRASE") ||
        runtime.getSetting("CLOB_PASS_PHRASE");

      if (!hasApiKey || !hasApiSecret || !hasApiPassphrase) {
        logger.info(
          `[placeOrderAction] API credentials missing, attempting to derive them`,
        );

        if (callback) {
          const derivingContent: Content = {
            text: `🔑 **Deriving API Credentials**

**Status**: Generating L2 API credentials from wallet
• **Method**: deriveApiKey() from wallet signature
• **Purpose**: Enable order posting to Polymarket

Deriving credentials...`,
            actions: ["POLYMARKET_PLACE_ORDER"],
            data: { derivingCredentials: true },
          };
          await callback(derivingContent);
        }

        try {
          const client = await initializeClobClient(runtime);
          const derivedCreds = await client.createOrDeriveApiKey();

          // Store the derived credentials in runtime
          await runtime.setSetting("CLOB_API_KEY", derivedCreds.key);
          await runtime.setSetting("CLOB_API_SECRET", derivedCreds.secret);
          await runtime.setSetting(
            "CLOB_API_PASSPHRASE",
            derivedCreds.passphrase,
          );

          logger.info(
            `[placeOrderAction] Successfully derived and stored API credentials`,
          );

          if (callback) {
            const successContent: Content = {
              text: `✅ **API Credentials Derived Successfully**

**Credential Details:**
• **API Key**: ${derivedCreds.key}
• **Status**: ✅ Ready for Trading
• **Method**: Wallet-derived L2 credentials

Reinitializing client with credentials...`,
              actions: ["POLYMARKET_PLACE_ORDER"],
              data: { credentialsReady: true, apiKey: derivedCreds.key },
            };
            await callback(successContent);
          }
        } catch (deriveError) {
          logger.error(
            `[placeOrderAction] Failed to derive API credentials:`,
            deriveError,
          );
          const errorContent: Content = {
            text: `❌ **Failed to Derive API Credentials**

**Error**: ${deriveError instanceof Error ? deriveError.message : "Unknown error"}

This could be due to:
• Network connectivity issues
• Wallet signature problems
• Polymarket API issues

Please ensure your wallet is properly configured and try again.`,
            actions: ["POLYMARKET_PLACE_ORDER"],
            data: {
              error: "Failed to derive API credentials",
              deriveError:
                deriveError instanceof Error
                  ? deriveError.message
                  : "Unknown error",
            },
          };

          if (callback) {
            await callback(errorContent);
          }
          return createErrorResult(
            "Failed to derive API credentials for order posting",
          );
        }
      } else {
        logger.info(`[placeOrderAction] API credentials already available`);
      }

      // Now initialize client with credentials
      const client = await initializeClobClient(runtime);

      // Create order arguments matching the official ClobClient interface
      const orderArgs = {
        tokenID: tokenId, // Official package expects tokenID (capital ID)
        price,
        side: side === "BUY" ? Side.BUY : Side.SELL,
        size,
        feeRateBps: parseFloat(feeRateBps), // Convert to number
      };

      logger.info(`[placeOrderAction] Creating order with args:`, orderArgs);

      // Create the signed order with enhanced error handling
      let signedOrder: any;
      try {
        signedOrder = await client.createOrder(orderArgs);
        logger.info(`[placeOrderAction] Order created successfully`);
      } catch (createError) {
        logger.error(`[placeOrderAction] Error creating order:`, createError);

        // Check for specific error types
        if (createError instanceof Error) {
          if (createError.message.includes("minimum_tick_size")) {
            return createErrorResult(
              `Invalid market data: The market may not exist or be inactive. Please verify the token ID is correct and the market is active.`,
            );
          }
          if (createError.message.includes("undefined is not an object")) {
            return createErrorResult(
              `Market data unavailable: The token ID may be invalid or the market may be closed.`,
            );
          }
        }
        throw createError;
      }

      // Post the order with enhanced error handling
      let orderResponse: any;
      try {
        orderResponse = await client.postOrder(
          signedOrder,
          orderType as OrderType,
        );
        logger.info(`[placeOrderAction] Order posted successfully`);
      } catch (postError) {
        logger.error(`[placeOrderAction] Error posting order:`, postError);
        return createErrorResult(
          `Failed to submit order: ${postError instanceof Error ? postError.message : "Unknown error"}`,
        );
      }

      // Format response based on success
      let responseText: string;
      let responseData: any;

      if (orderResponse.success) {
        const sideText = side.toLowerCase();
        const orderTypeText =
          orderType === "GTC"
            ? "limit"
            : orderType === "FOK"
              ? "market"
              : orderType.toLowerCase();
        const totalValue = (price * size).toFixed(4);

        responseText = `✅ **Order Placed Successfully**

**Order Details:**
• **Type**: ${orderTypeText} ${sideText} order
• **Token ID**: ${tokenId}
• **Side**: ${sideText.toUpperCase()}
• **Price**: $${price.toFixed(4)} (${(price * 100).toFixed(2)}%)
• **Size**: ${size} shares
• **Total Value**: $${totalValue}
• **Fee Rate**: ${feeRateBps} bps

**Order Response:**
• **Order ID**: ${orderResponse.orderId || "Pending"}
• **Status**: ${orderResponse.status || "submitted"}
${
  orderResponse.orderHashes && orderResponse.orderHashes.length > 0
    ? `• **Transaction Hash(es)**: ${orderResponse.orderHashes.join(", ")}`
    : ""
}

${
  orderResponse.status === "matched"
    ? "🎉 Your order was immediately matched and executed!"
    : orderResponse.status === "delayed"
      ? "⏳ Your order is subject to a matching delay due to market conditions."
      : "📋 Your order has been placed and is waiting to be matched."
}`;

        responseData = {
          success: true,
          orderDetails: {
            tokenId,
            side,
            price,
            size,
            orderType,
            feeRateBps,
            totalValue,
          },
          orderResponse,
          timestamp: new Date().toISOString(),
        };
      } else {
        responseText = `❌ **Order Placement Failed**

**Error**: ${orderResponse.errorMsg || "Unknown error occurred"}

**Order Details Attempted:**
• **Token ID**: ${tokenId}
• **Side**: ${side}
• **Price**: $${price.toFixed(4)}
• **Size**: ${size} shares
• **Order Type**: ${orderType}

Please check your parameters and try again. Common issues:
• Insufficient balance or allowances
• Invalid price or size
• Market not active
• Network connectivity issues`;

        responseData = {
          success: false,
          error: orderResponse.errorMsg,
          orderDetails: {
            tokenId,
            side,
            price,
            size,
            orderType,
            feeRateBps,
          },
          timestamp: new Date().toISOString(),
        };
      }

      const responseContent: Content = {
        text: responseText,
        actions: ["POLYMARKET_PLACE_ORDER"],
        data: responseData,
      };

      if (callback) {
        await callback(responseContent);
      }

      return contentToActionResult(responseContent);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error occurred while placing order";
      logger.error(`[placeOrderAction] Order placement error:`, error);

      const errorContent: Content = {
        text: `❌ **Order Placement Error**

**Error**: ${errorMessage}

**Order Details:**
• **Token ID**: ${tokenId}
• **Side**: ${side}
• **Price**: $${price.toFixed(4)}
• **Size**: ${size} shares

Please check your configuration and try again. Make sure:
• CLOB_API_URL is properly configured
• Token ID is valid and active
• Price and size are within acceptable ranges
• Network connection is stable`,
        actions: ["POLYMARKET_PLACE_ORDER"],
        data: {
          error: errorMessage,
          orderDetails: { tokenId, side, price, size, orderType },
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
          text: "I want to buy 100 shares of token 52114319501245915516055106046884209969926127482827954674443846427813813222426 at $0.50 as a limit order via Polymarket",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll place a limit buy order for you via Polymarket. Creating order for 100 shares at $0.50...",
          action: "POLYMARKET_PLACE_ORDER",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "Place a market sell order for 50 tokens of 71321045679252212594626385532706912750332728571942532289631379312455583992563 via Polymarket",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll place a market sell order for you via Polymarket. This will execute immediately at the best available price...",
          action: "POLYMARKET_PLACE_ORDER",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "Create a GTC order to buy 25 shares at 0.75 for market 123456789 via Polymarket",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll create a Good-Till-Cancelled buy order for you at $0.75 per share via Polymarket...",
          action: "POLYMARKET_PLACE_ORDER",
        },
      },
    ],
  ],
};
