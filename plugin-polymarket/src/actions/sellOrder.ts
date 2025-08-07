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
import { orderTemplate } from "../templates";
import { OrderSide, OrderType } from "../types";
import {
  contentToActionResult,
  createErrorResult,
} from "../utils/actionHelpers";
import { findMarketByName } from "../utils/marketLookup";
import { ClobClient, Side } from "@polymarket/clob-client";

interface SellOrderParams {
  tokenId: string;
  price: number;
  size: number;
  orderType?: string;
  feeRateBps?: string;
  marketName?: string;
  outcome?: string;
}

/**
 * Streamlined sell order action for Polymarket
 * Simplified interface focused on selling existing positions
 */
export const sellOrderAction: Action = {
  name: "SELL_ORDER",
  similes: [
    "SELL_ORDER",
    "SELL_TOKEN",
    "SELL_POSITION",
    "CLOSE_POSITION",
    "TAKE_PROFIT",
    "EXIT_POSITION",
    "SELL_SHARES",
    "LIQUIDATE",
    "CASH_OUT",
    "REALIZE_GAINS",
  ],
  description: "Sell existing Polymarket positions",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    logger.info(
      `[sellOrderAction] Validate called for message: "${message.content?.text}"`,
    );

    const clobApiUrl = runtime.getSetting("CLOB_API_URL");
    if (!clobApiUrl) {
      logger.warn(
        "[sellOrderAction] CLOB_API_URL is required but not provided",
      );
      return false;
    }

    logger.info("[sellOrderAction] Validation passed");
    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    logger.info("[sellOrderAction] Handler called!");

    try {
      const clobApiUrl = runtime.getSetting("CLOB_API_URL");
      if (!clobApiUrl) {
        logger.error("[sellOrderAction] CLOB_API_URL not found");
        return createErrorResult("CLOB_API_URL is required in configuration.");
      }

      let tokenId: string;
      let price: number;
      let size: number;
      let orderType: string = "GTC";
      let feeRateBps: string = "0";

      try {
      // Use LLM to extract sell parameters
      const llmResult = await callLLMWithTimeout<
        SellOrderParams & { error?: string }
      >(
        runtime,
        state,
        orderTemplate, // Reuse existing template but for selling
        "sellOrderAction",
      );

      logger.info("[sellOrderAction] LLM result:", JSON.stringify(llmResult));

      if (llmResult?.error) {
        return createErrorResult("Required sell parameters not found");
      }

      tokenId = llmResult?.tokenId || "";
      price = llmResult?.price || 0;
      size = llmResult?.size || -1; // Default to -1 to fetch actual position
      orderType =
        llmResult?.orderType?.toLowerCase() || (price > 0 ? "limit" : "market");
      feeRateBps = llmResult?.feeRateBps || "0";
      
      logger.info(`[sellOrderAction] Extracted params: tokenId=${tokenId?.slice(0,20)}..., price=${price}, size=${size}, orderType=${orderType}`);

      // Convert order types
      logger.info(`[sellOrderAction] Converting order type: ${orderType}`);
      if (orderType === "limit") {
        orderType = "GTC";
      } else if (orderType === "market") {
        // Use FOK for market sells for immediate execution
        orderType = "FOK";
        // For market sells, we'll fetch the current price later
        if (price <= 0) {
          price = -1; // Flag to fetch market price
        }
      }
      logger.info(`[sellOrderAction] Order type after conversion: ${orderType}, price: ${price}`);

      // Handle market name lookup for selling
      if (
        (tokenId === "MARKET_NAME_LOOKUP" || !tokenId || tokenId.length < 10) &&
        llmResult?.marketName
      ) {
        logger.info(
          `[sellOrderAction] Market name lookup requested: ${llmResult.marketName}`,
        );

        try {
          const marketResult = await findMarketByName(
            runtime,
            llmResult.marketName,
          );

          if (!marketResult) {
            const errorContent: Content = {
              text: `❌ **Market not found: "${llmResult.marketName}"**

I couldn't find an active market matching that name for selling.

**Please try:**
1. "Show my positions" to see your holdings
2. Be more specific with the market name
3. Use the exact token ID for selling`,
              actions: ["SELL_ORDER"],
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

          // For selling, determine outcome from context or default to user's likely position
          const outcome = llmResult.outcome?.toUpperCase() || "YES"; // Default to YES for selling
          const targetToken = marketResult.tokens.find(
            (t) => t.outcome.toUpperCase() === outcome,
          );

          if (!targetToken) {
            const availableOutcomes = marketResult.tokens
              .map((t) => t.outcome)
              .join(", ");
            const errorContent: Content = {
              text: `❌ **Outcome not found for selling**

Market: "${marketResult.market.question}"
Available outcomes: ${availableOutcomes}
Requested outcome: ${outcome}

**Please specify which position to sell:**
- "Sell my YES position in [market name]"
- "Sell my NO position in [market name]"`,
              actions: ["SELL_ORDER"],
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

          tokenId = targetToken.token_id;
          logger.info(
            `[sellOrderAction] Resolved "${llmResult.marketName}" -> ${outcome} -> ${tokenId.slice(0, 12)}...`,
          );

          if (callback) {
            const resolutionContent: Content = {
              text: `✅ **Market Resolved for Selling**

**Market**: ${marketResult.market.question}
**Position**: ${targetToken.outcome}
**Token ID**: ${tokenId.slice(0, 12)}...

Preparing sell order...`,
              actions: ["SELL_ORDER"],
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
          logger.error(`[sellOrderAction] Market lookup failed:`, lookupError);
          return createErrorResult("Market lookup failed for selling");
        }
      }

      // Log before validation
      logger.info(`[sellOrderAction] Before validation - tokenId: ${tokenId?.slice(0,20)}..., size: ${size}, price: ${price}, orderType: ${orderType}`);
      
      // Validate sell parameters (allow size -1 as it means fetch actual position)
      if (!tokenId) {
        logger.error(`[sellOrderAction] No token ID provided`);
        return createErrorResult("Token ID is required");
      }

      // Don't validate size yet if it's -1 (will fetch actual position later)
      if (size !== -1 && size <= 0) {
        logger.error(`[sellOrderAction] Invalid size: ${size}`);
        return createErrorResult("Invalid sell size");
      }

      // Don't validate price for market orders that will fetch price later
      if (orderType === "GTC" && price <= 0 && price !== -1) {
        logger.error(`[sellOrderAction] GTC order with invalid price: ${price}`);
        return createErrorResult("Limit sell orders require a valid price");
      }
      
      // For FOK orders, price will be set later from market
      if (orderType === "FOK" && price <= 0) {
        price = -1; // Ensure we fetch market price
      }
      
      logger.info(`[sellOrderAction] Validation passed`);
    } catch (error) {
      logger.warn(
        "[sellOrderAction] LLM extraction failed, trying regex fallback",
      );

      // Regex fallback for sell orders
      const text = message.content?.text || "";

      const tokenMatch = text.match(
        /(?:token|market|id)\s+([a-zA-Z0-9]+)|([0-9]{5,})/i,
      );
      tokenId = tokenMatch?.[1] || tokenMatch?.[2] || "";

      const priceMatch = text.match(/(?:price|at|for)\s*\$?([0-9]*\.?[0-9]+)/i);
      price = priceMatch ? parseFloat(priceMatch[1]) : 0;

      const sizeMatch = text.match(
        /(?:size|amount|quantity|sell)\s*([0-9]*\.?[0-9]+)|([0-9]*\.?[0-9]+)\s*(?:shares|tokens)/i,
      );
      // Check for "all" keyword
      if (text.toLowerCase().includes("all")) {
        size = -1; // Flag to fetch actual position size
      } else {
        size = sizeMatch ? parseFloat(sizeMatch[1] || sizeMatch[2]) : -1; // Default to -1 to fetch position
      }
      
      // Ensure minimum size of 5 tokens if a specific size was given
      if (size > 0 && size < 5) {
        size = 5; // Polymarket minimum
      }

      const orderTypeMatch = text.match(/\b(GTC|FOK|GTD|FAK|limit|market)\b/i);
      if (orderTypeMatch) {
        const matched = orderTypeMatch[1].toUpperCase();
        orderType =
          matched === "LIMIT" ? "GTC" : matched === "MARKET" ? "FOK" : matched;
      } else {
        orderType = price > 0 ? "GTC" : "FOK";
      }

      if (orderType === "FOK" && price <= 0) {
        price = -1; // Flag to fetch market price later
      }

      if (!tokenId || size <= 0 || (orderType === "GTC" && price <= 0)) {
        const errorContent: Content = {
          text: `❌ **Error**: Please provide valid sell parameters.

**Examples:**
• "Sell 50 shares of token 123456 at $0.75"
• "Sell my YES position in 'Election 2024' at market price"
• "Close 100 shares of 789012 with limit order at $0.60"

**Required:**
- Token ID or market name
- Size (number of shares to sell)
- Price (for limit orders)

**Sell Types:**
- Limit: "at $0.50" (specific price)
- Market: "at market price" (immediate sale)`,
          actions: ["SELL_ORDER"],
          data: { error: "Invalid sell parameters" },
        };

        if (callback) {
          await callback(errorContent);
        }
        return createErrorResult("Please provide valid sell parameters");
      }
    }

    // Validate and normalize parameters
    if (price > 1.0) {
      price = price / 100; // Convert percentage to decimal
    }

    if (!["GTC", "FOK", "GTD", "FAK"].includes(orderType)) {
      orderType = "GTC";
    }

    try {
      // Check if we have API credentials, if not try to derive them
      logger.info(`[sellOrderAction] Checking for API credentials`);

      const hasApiKey = runtime.getSetting("CLOB_API_KEY");
      const hasApiSecret =
        runtime.getSetting("CLOB_API_SECRET") ||
        runtime.getSetting("CLOB_SECRET");
      const hasApiPassphrase =
        runtime.getSetting("CLOB_API_PASSPHRASE") ||
        runtime.getSetting("CLOB_PASS_PHRASE");

      if (!hasApiKey || !hasApiSecret || !hasApiPassphrase) {
        logger.info(
          `[sellOrderAction] API credentials missing, attempting to derive them`,
        );

        if (callback) {
          const derivingContent: Content = {
            text: `🔑 **Deriving API Credentials**

**Status**: Generating L2 API credentials from wallet
• **Method**: deriveApiKey() from wallet signature
• **Purpose**: Enable sell order posting to Polymarket

Deriving credentials...`,
            actions: ["SELL_ORDER"],
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
            `[sellOrderAction] Successfully derived and stored API credentials`,
          );

          if (callback) {
            const successContent: Content = {
              text: `✅ **API Credentials Derived Successfully**

**Credential Details:**
• **API Key**: ${derivedCreds.key}
• **Status**: ✅ Ready for Trading
• **Method**: Wallet-derived L2 credentials

Reinitializing client with credentials...`,
              actions: ["SELL_ORDER"],
              data: { credentialsReady: true, apiKey: derivedCreds.key },
            };
            await callback(successContent);
          }
        } catch (deriveError) {
          logger.error(
            `[sellOrderAction] Failed to derive API credentials:`,
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
            actions: ["SELL_ORDER"],
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
            "Failed to derive API credentials for sell order posting",
          );
        }
      } else {
        logger.info(`[sellOrderAction] API credentials already available`);
      }

      // Now initialize client with credentials
      const client = await initializeClobClient(runtime);

      // Check if we need to get the actual position size
      const needsPositionFetch = size <= 0 || size === -1 || message.content?.text?.toLowerCase().includes("all");
      logger.info(`[sellOrderAction] Needs position fetch: ${needsPositionFetch} (size=${size}, includes 'all'=${message.content?.text?.toLowerCase().includes("all")})`);
      
      if (needsPositionFetch) {
        logger.info(
          `[sellOrderAction] Fetching actual position size for token: ${tokenId?.slice(0,20)}...`,
        );

        try {
          // Get wallet address from the client
          const walletAddress = (client as any).wallet?.address || (client as any).signer?.address;
          
          if (walletAddress) {
            // Fetch positions from public API
            const positionsUrl = `https://data-api.polymarket.com/positions?sizeThreshold=0.01&limit=50&user=${walletAddress}`;
            const positionsResponse = await fetch(positionsUrl);
            
            if (positionsResponse.ok) {
              const positionsData = await positionsResponse.json() as any;
              const positions = Array.isArray(positionsData) ? positionsData : positionsData.positions || [];
              
              // Find the position for this token
              const position = positions.find((pos: any) => {
                const posTokenId = pos.asset || pos.tokenId || pos.token_id;
                return posTokenId === tokenId;
              });
              
              if (position) {
                const actualSize = parseFloat(position.size || position.position_size || "0");
                if (actualSize > 0) {
                  size = actualSize;
                  logger.info(
                    `[sellOrderAction] Found position size: ${size} shares`,
                  );
                  
                  // Check if position is below minimum
                  if (size < 5) {
                    return createErrorResult(
                      `Your position of ${size.toFixed(2)} shares is below Polymarket's minimum order size of 5 shares. Cannot sell.`
                    );
                  }
                  
                  if (callback) {
                    const sizeContent: Content = {
                      text: `📊 **Position Found**
• **Current Holdings**: ${size} shares
• **Selling**: ALL (${size} shares)`,
                      actions: ["SELL_ORDER"],
                      data: { positionSize: size },
                    };
                    await callback(sizeContent);
                  }
                } else {
                  return createErrorResult("No position found to sell");
                }
              } else {
                return createErrorResult("You don't have any position in this token to sell");
              }
            }
          }
        } catch (posError) {
          logger.error(
            `[sellOrderAction] Failed to fetch position size:`,
            posError,
          );
          // Continue with size = 5 (minimum) if we can't fetch the actual size
          if (size <= 0) size = 5;
        }
      }

      // If market order with no price, fetch current best bid
      if (price === -1) {
        logger.info(
          `[sellOrderAction] Fetching market price for token: ${tokenId}`,
        );

        try {
          // Use the price endpoint for accurate current prices
          const priceUrl = `${runtime.getSetting("CLOB_API_URL")}/price?token_id=${tokenId}&side=sell`;
          const priceResponse = await fetch(priceUrl);
          
          if (!priceResponse.ok) {
            throw new Error(`Failed to fetch price: ${priceResponse.statusText}`);
          }
          
          const priceData = await priceResponse.json() as { price: string };
          const currentSellPrice = parseFloat(priceData.price);
          
          // Also fetch the full order book to check liquidity
          const bookUrl = `${runtime.getSetting("CLOB_API_URL")}/book?token_id=${tokenId}`;
          const bookResponse = await fetch(bookUrl);
          
          if (!bookResponse.ok) {
            throw new Error(`Failed to fetch order book: ${bookResponse.statusText}`);
          }
          
          const bookData = await bookResponse.json() as any;
          
          // Find the highest bid (what buyers will pay)
          const sortedBids = bookData.bids.sort((a: any, b: any) => parseFloat(b.price) - parseFloat(a.price));
          
          if (sortedBids && sortedBids.length > 0) {
            const bestBid = parseFloat(sortedBids[0].price);
            const bidLiquidity = parseFloat(sortedBids[0].size);
            
            // Calculate total liquidity across multiple price levels
            let totalLiquidity = 0;
            let depthInfo = [];
            let liquidityAtPrices = [];
            for (let i = 0; i < Math.min(5, sortedBids.length); i++) {
              const bid = sortedBids[i];
              const bidPrice = parseFloat(bid.price);
              const bidSize = parseFloat(bid.size);
              totalLiquidity += bidSize;
              depthInfo.push(`  ${i+1}. $${bidPrice.toFixed(4)} (${(bidPrice * 100).toFixed(2)}%) - ${bidSize.toFixed(0)} shares`);
              liquidityAtPrices.push({ price: bidPrice, size: bidSize, cumulative: totalLiquidity });
            }
            
            // Check if we have enough liquidity for FOK order
            const hasGoodLiquidity = bidLiquidity >= size;
            const hasAnyLiquidity = totalLiquidity >= size;
            
            // For FOK orders with insufficient liquidity, warn the user
            if (orderType === "FOK" && !hasGoodLiquidity) {
              logger.warn(
                `[sellOrderAction] Insufficient liquidity for FOK order - Need: ${size}, Available at best bid: ${bidLiquidity}, Total top 5: ${totalLiquidity}`,
              );
              
              const liquidityContent: Content = {
                text: `⚠️ **Insufficient Liquidity for Market Order (FOK)**

**Your Order**: Sell ${size} shares
**Order Type**: Fill-or-Kill (FOK) - Must execute completely or not at all

**Current Order Book (Buy Side)**:
${depthInfo.join('\n')}

**Liquidity Analysis**:
• **Available at Best Bid**: ${bidLiquidity.toFixed(0)} shares at $${bestBid.toFixed(4)}
• **Your Order Size**: ${size} shares
• **Shortfall**: ${(size - bidLiquidity).toFixed(0)} shares
• **Total Available (top 5 levels)**: ${totalLiquidity.toFixed(0)} shares

**Why FOK Failed**: FOK orders must be completely filled at a single price level. There are only ${bidLiquidity.toFixed(0)} shares available at the best bid of $${bestBid.toFixed(4)}, but you're trying to sell ${size} shares.

**Recommended Actions**:
1. **Use a Limit Order (GTC)**: "Sell ${size} shares at $${bestBid.toFixed(4)} limit"
   - Will wait for buyers to appear
   
2. **Reduce Size to Available**: "Sell ${Math.floor(bidLiquidity)} shares at market"
   - Will execute immediately
   
3. **Split Your Order**: 
   - "Sell ${Math.floor(bidLiquidity)} shares at market" (immediate)
   - "Sell ${(size - Math.floor(bidLiquidity)).toFixed(0)} shares at $${bestBid.toFixed(4)} limit" (wait for buyers)

Would you like to proceed with one of these alternatives?`,
                actions: ["SELL_ORDER"],
                data: { 
                  insufficientLiquidity: true,
                  orderSize: size,
                  availableLiquidity: bidLiquidity,
                  totalLiquidity,
                  bestBid,
                  orderBook: liquidityAtPrices
                },
              };
              
              if (callback) {
                await callback(liquidityContent);
              }
              
              return createErrorResult(
                `Insufficient liquidity: Only ${bidLiquidity.toFixed(0)} shares available at best bid, but you're trying to sell ${size} shares with FOK order. Try a limit order or reduce size.`
              );
            }
            
            // Set price for immediate execution
            // FOK orders should match the best bid when there's sufficient liquidity
            // Only apply discount if liquidity is low or for GTC orders
            const marketDiscount = orderType === "FOK" && hasGoodLiquidity ? 1.0 : (orderType === "FOK" ? 0.995 : 0.98);
            price = Math.max(0.01, Math.min(0.99, bestBid * marketDiscount));
            
            logger.info(
              `[sellOrderAction] Market price fetched - Current sell price: ${currentSellPrice}, Best bid: ${bestBid}, Liquidity: ${bidLiquidity}, Sell at: ${price}`,
            );

            if (callback) {
              const discountPercent = ((1 - marketDiscount) * 100).toFixed(1);
              const priceContent: Content = {
                text: `📊 **Market Price & Liquidity Check**

**Order Book Analysis**:
${depthInfo.slice(0, 3).join('\n')}

**Your Order**:
• **Size**: ${size} shares to sell
• **Type**: ${orderType === "FOK" ? "Market (Fill-Or-Kill)" : "Limit (GTC)"}
• **Liquidity Check**: ${hasGoodLiquidity ? "✅ Sufficient" : "⚠️ Limited"} (${bidLiquidity.toFixed(0)} shares available at best bid)

**Execution Price**:
• **Best Bid**: $${bestBid.toFixed(4)} (${(bestBid * 100).toFixed(2)}%)
• **Your Sell Price**: $${price.toFixed(4)} (${(price * 100).toFixed(2)}%)
${marketDiscount === 1.0 
  ? `• **Status**: ✅ Selling at exact bid price (sufficient liquidity)`
  : `• **Discount**: ${discountPercent}% for ${orderType === "FOK" ? "immediate market execution" : "quick execution"}`}

**Expected Proceeds**: $${(price * size).toFixed(2)}

Submitting order...`,
                actions: ["SELL_ORDER"],
                data: { currentSellPrice, bestBid, sellPrice: price, orderType, bidLiquidity, hasGoodLiquidity, orderBook: liquidityAtPrices },
              };
              await callback(priceContent);
            }
          } else {
            // No bids available
            return createErrorResult(
              "No buyers found in the market. Cannot execute market sell order.",
            );
          }
        } catch (priceError) {
          logger.error(
            `[sellOrderAction] Failed to fetch market price:`,
            priceError,
          );
          return createErrorResult(
            "Failed to fetch current market price. Please try a limit order with a specific price.",
          );
        }
      }

      // Create sell order arguments
      const orderArgs = {
        tokenID: tokenId,
        price,
        side: Side.SELL, // Always SELL for this action
        size,
        feeRateBps: parseFloat(feeRateBps),
      };

      logger.info(
        `[sellOrderAction] Creating sell order with args:`,
        orderArgs,
      );

      if (callback) {
        const orderContent: Content = {
          text: `📋 **Creating Sell Order**

**Order Details:**
• **Token ID**: ${tokenId.slice(0, 12)}...
• **Type**: ${orderType === "FOK" ? "Market (Fill-Or-Kill)" : "Limit (GTC)"} Sell
• **Price**: $${price.toFixed(4)} (${(price * 100).toFixed(2)}%)
• **Size**: ${size} shares
• **Expected Proceeds**: $${(price * size).toFixed(2)}

Submitting sell order...`,
          actions: ["SELL_ORDER"],
          data: { orderArgs, orderType },
        };
        await callback(orderContent);
      }

      // Create and post the sell order
      const signedOrder = await client.createOrder(orderArgs);
      const orderResponse = await client.postOrder(
        signedOrder,
        orderType as OrderType,
      );

      // Format response
      let responseText: string;
      let responseData: any;

      if (orderResponse.success) {
        const totalProceeds = (price * size).toFixed(4);

        responseText = `✅ **Sell Order Placed Successfully**

**Order Details:**
• **Type**: ${orderType === "FOK" ? "Market (immediate)" : "Limit"} sell order
• **Token ID**: ${tokenId.slice(0, 12)}...
• **Price**: $${price.toFixed(4)} (${(price * 100).toFixed(2)}%)
• **Size**: ${size} shares
• **Expected Proceeds**: $${totalProceeds}
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
    ? "🎉 Your sell order was immediately matched and executed!"
    : orderResponse.status === "delayed"
      ? "⏳ Your sell order is subject to a matching delay."
      : "📋 Your sell order has been placed and is waiting to be matched."
}`;

        responseData = {
          success: true,
          orderDetails: {
            tokenId,
            side: "SELL",
            price,
            size,
            orderType,
            feeRateBps,
            totalProceeds,
          },
          orderResponse,
          timestamp: new Date().toISOString(),
        };
      } else {
        responseText = `❌ **Sell Order Failed**

**Error**: ${orderResponse.errorMsg || "Unknown error occurred"}

**Order Details Attempted:**
• **Token ID**: ${tokenId.slice(0, 12)}...
• **Price**: $${price.toFixed(4)}
• **Size**: ${size} shares
• **Order Type**: ${orderType}

${
  orderResponse.errorMsg?.includes("FOK orders are fully filled or killed")
    ? `**Note**: The market order (FOK) couldn't find enough liquidity at the specified price.

**Suggestions:**
• Try a limit order instead: "Sell 62 shares at $0.98 limit"
• Use a higher discount for market orders
• Check the order book depth for available liquidity`
    : `Common issues with sell orders:
• You don't own enough tokens to sell
• Invalid price or size
• Market not active
• Network connectivity issues`
}

**Check your positions** and try again with adjusted parameters.`;

        responseData = {
          success: false,
          error: orderResponse.errorMsg,
          orderDetails: {
            tokenId,
            side: "SELL",
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
        actions: ["SELL_ORDER"],
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
          : "Unknown error occurred while selling";
      logger.error(`[sellOrderAction] Sell order error:`, error);

      const errorContent: Content = {
        text: `❌ **Sell Order Error**

**Error**: ${errorMessage}

**Order Details:**
• **Token ID**: ${tokenId.slice(0, 12)}...
• **Price**: $${price.toFixed(4)}
• **Size**: ${size} shares

Please check:
• You own enough tokens to sell
• Token ID is valid and active
• Price and size are within acceptable ranges
• Network connection is stable
• Approvals are set for selling`,
        actions: ["SELL_ORDER"],
        data: {
          error: errorMessage,
          orderDetails: { tokenId, side: "SELL", price, size, orderType },
        },
      };

      if (callback) {
        await callback(errorContent);
      }
      return createErrorResult(errorMessage);
    }
    } catch (outerError) {
      logger.error(`[sellOrderAction] Outer handler error:`, outerError);
      const errorMessage = outerError instanceof Error ? outerError.message : "Unknown error in sell handler";
      
      const errorContent: Content = {
        text: `❌ **Sell Order Handler Error**\n\n**Error**: ${errorMessage}\n\nThis is an unexpected error. Please try again or contact support.`,
        actions: ["SELL_ORDER"],
        data: {
          error: errorMessage,
          handlerError: true,
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
          text: "Sell 50 shares of my YES position in the election market at $0.75",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll place a limit sell order for your YES position at $0.75 per share...",
          action: "SELL_ORDER",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "Close my position in token 123456 at market price",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll place a market sell order to close your position immediately...",
          action: "SELL_ORDER",
        },
      },
    ],
  ],
};
