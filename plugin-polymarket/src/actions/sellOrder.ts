import {
  type Action,
  type ActionResult,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
} from '@elizaos/core';
import { callLLMWithTimeout } from '../utils/llmHelpers';
import { initializeClobClient } from '../utils/clobClient';
import { orderTemplate } from '../templates';
import { OrderSide, OrderType } from '../types';
import { contentToActionResult, createErrorResult } from '../utils/actionHelpers';
import { findMarketByName } from '../utils/marketLookup';
import { ClobClient, Side } from '@polymarket/clob-client';

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
  name: 'SELL_ORDER',
  similes: [
    'SELL_ORDER',
    'SELL_TOKEN',
    'SELL_POSITION',
    'CLOSE_POSITION',
    'TAKE_PROFIT',
    'EXIT_POSITION',
    'SELL_SHARES',
    'LIQUIDATE',
    'CASH_OUT',
    'REALIZE_GAINS',
  ],
  description: 'Sell existing Polymarket positions',

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    logger.info(`[sellOrderAction] Validate called for message: "${message.content?.text}"`);

    const clobApiUrl = runtime.getSetting('CLOB_API_URL');
    if (!clobApiUrl) {
      logger.warn('[sellOrderAction] CLOB_API_URL is required but not provided');
      return false;
    }

    logger.info('[sellOrderAction] Validation passed');
    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    logger.info('[sellOrderAction] Handler called!');

    const clobApiUrl = runtime.getSetting('CLOB_API_URL');
    if (!clobApiUrl) {
      return createErrorResult('CLOB_API_URL is required in configuration.');
    }

    let tokenId: string;
    let price: number;
    let size: number;
    let orderType: string = 'GTC';
    let feeRateBps: string = '0';

    try {
      // Use LLM to extract sell parameters
      const llmResult = await callLLMWithTimeout<SellOrderParams & { error?: string }>(
        runtime,
        state,
        orderTemplate, // Reuse existing template but for selling
        'sellOrderAction'
      );

      logger.info('[sellOrderAction] LLM result:', JSON.stringify(llmResult));

      if (llmResult?.error) {
        return createErrorResult('Required sell parameters not found');
      }

      tokenId = llmResult?.tokenId || '';
      price = llmResult?.price || 0;
      size = llmResult?.size || 1;
      orderType = llmResult?.orderType?.toLowerCase() || (price > 0 ? 'limit' : 'market');
      feeRateBps = llmResult?.feeRateBps || '0';

      // Convert order types
      if (orderType === 'limit') {
        orderType = 'GTC';
      } else if (orderType === 'market') {
        orderType = 'FOK';
        // For market sells, use aggressive pricing
        if (price <= 0) {
          price = 0.001; // Very low price to ensure quick fill
        }
      }

      // Handle market name lookup for selling
      if ((tokenId === 'MARKET_NAME_LOOKUP' || !tokenId || tokenId.length < 10) && llmResult?.marketName) {
        logger.info(`[sellOrderAction] Market name lookup requested: ${llmResult.marketName}`);
        
        try {
          const marketResult = await findMarketByName(runtime, llmResult.marketName);
          
          if (!marketResult) {
            const errorContent: Content = {
              text: `❌ **Market not found: "${llmResult.marketName}"**

I couldn't find an active market matching that name for selling.

**Please try:**
1. "Show my positions" to see your holdings
2. Be more specific with the market name
3. Use the exact token ID for selling`,
              actions: ['SELL_ORDER'],
              data: { error: 'Market not found', marketName: llmResult.marketName },
            };

            if (callback) {
              await callback(errorContent);
            }
            return contentToActionResult(errorContent);
          }

          // For selling, determine outcome from context or default to user's likely position
          const outcome = llmResult.outcome?.toUpperCase() || 'YES'; // Default to YES for selling
          const targetToken = marketResult.tokens.find(t => t.outcome.toUpperCase() === outcome);
          
          if (!targetToken) {
            const availableOutcomes = marketResult.tokens.map(t => t.outcome).join(', ');
            const errorContent: Content = {
              text: `❌ **Outcome not found for selling**

Market: "${marketResult.market.question}"
Available outcomes: ${availableOutcomes}
Requested outcome: ${outcome}

**Please specify which position to sell:**
- "Sell my YES position in [market name]"
- "Sell my NO position in [market name]"`,
              actions: ['SELL_ORDER'],
              data: { 
                error: 'Outcome not found',
                market: marketResult.market,
                availableOutcomes: marketResult.tokens.map(t => t.outcome),
                requestedOutcome: outcome,
              },
            };

            if (callback) {
              await callback(errorContent);
            }
            return contentToActionResult(errorContent);
          }

          tokenId = targetToken.token_id;
          logger.info(`[sellOrderAction] Resolved "${llmResult.marketName}" -> ${outcome} -> ${tokenId.slice(0, 12)}...`);

          if (callback) {
            const resolutionContent: Content = {
              text: `✅ **Market Resolved for Selling**

**Market**: ${marketResult.market.question}
**Position**: ${targetToken.outcome}
**Token ID**: ${tokenId.slice(0, 12)}...

Preparing sell order...`,
              actions: ['SELL_ORDER'],
              data: { 
                marketResolution: {
                  market: marketResult.market,
                  selectedToken: targetToken,
                  resolvedTokenId: tokenId,
                }
              },
            };
            await callback(resolutionContent);
          }

        } catch (lookupError) {
          logger.error(`[sellOrderAction] Market lookup failed:`, lookupError);
          return createErrorResult('Market lookup failed for selling');
        }
      }

      // Validate sell parameters
      if (!tokenId || size <= 0) {
        return createErrorResult('Invalid sell parameters');
      }
      
      if (orderType === 'GTC' && price <= 0) {
        return createErrorResult('Limit sell orders require a valid price');
      }

    } catch (error) {
      logger.warn('[sellOrderAction] LLM extraction failed, trying regex fallback');

      // Regex fallback for sell orders
      const text = message.content?.text || '';

      const tokenMatch = text.match(/(?:token|market|id)\s+([a-zA-Z0-9]+)|([0-9]{5,})/i);
      tokenId = tokenMatch?.[1] || tokenMatch?.[2] || '';

      const priceMatch = text.match(/(?:price|at|for)\s*\$?([0-9]*\.?[0-9]+)/i);
      price = priceMatch ? parseFloat(priceMatch[1]) : 0;

      const sizeMatch = text.match(
        /(?:size|amount|quantity|sell)\s*([0-9]*\.?[0-9]+)|([0-9]*\.?[0-9]+)\s*(?:shares|tokens)/i
      );
      size = sizeMatch ? parseFloat(sizeMatch[1] || sizeMatch[2]) : 1;

      const orderTypeMatch = text.match(/\b(GTC|FOK|GTD|FAK|limit|market)\b/i);
      if (orderTypeMatch) {
        const matched = orderTypeMatch[1].toUpperCase();
        orderType = matched === 'LIMIT' ? 'GTC' : matched === 'MARKET' ? 'FOK' : matched;
      } else {
        orderType = price > 0 ? 'GTC' : 'FOK';
      }

      if (orderType === 'FOK' && price <= 0) {
        price = 0.001; // Very aggressive sell price
      }

      if (!tokenId || size <= 0 || (orderType === 'GTC' && price <= 0)) {
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
          actions: ['SELL_ORDER'],
          data: { error: 'Invalid sell parameters' },
        };

        if (callback) {
          await callback(errorContent);
        }
        return createErrorResult('Please provide valid sell parameters');
      }
    }

    // Validate and normalize parameters
    if (price > 1.0) {
      price = price / 100; // Convert percentage to decimal
    }

    if (!['GTC', 'FOK', 'GTD', 'FAK'].includes(orderType)) {
      orderType = 'GTC';
    }

    try {
      // Initialize CLOB client with credentials
      const client = await initializeClobClient(runtime);

      // Create sell order arguments
      const orderArgs = {
        tokenID: tokenId,
        price,
        side: Side.SELL, // Always SELL for this action
        size,
        feeRateBps: parseFloat(feeRateBps),
      };

      logger.info(`[sellOrderAction] Creating sell order with args:`, orderArgs);

      if (callback) {
        const orderContent: Content = {
          text: `📋 **Creating Sell Order**

**Order Details:**
• **Token ID**: ${tokenId.slice(0, 12)}...
• **Type**: ${orderType === 'GTC' ? 'Limit' : 'Market'} Sell
• **Price**: $${price.toFixed(4)} (${(price * 100).toFixed(2)}%)
• **Size**: ${size} shares
• **Expected Proceeds**: $${(price * size).toFixed(2)}

Submitting sell order...`,
          actions: ['SELL_ORDER'],
          data: { orderArgs, orderType },
        };
        await callback(orderContent);
      }

      // Create and post the sell order
      const signedOrder = await client.createOrder(orderArgs);
      const orderResponse = await client.postOrder(signedOrder, orderType as OrderType);

      // Format response
      let responseText: string;
      let responseData: any;

      if (orderResponse.success) {
        const totalProceeds = (price * size).toFixed(4);

        responseText = `✅ **Sell Order Placed Successfully**

**Order Details:**
• **Type**: ${orderType === 'GTC' ? 'Limit' : 'Market'} sell order
• **Token ID**: ${tokenId.slice(0, 12)}...
• **Price**: $${price.toFixed(4)} (${(price * 100).toFixed(2)}%)
• **Size**: ${size} shares
• **Expected Proceeds**: $${totalProceeds}
• **Fee Rate**: ${feeRateBps} bps

**Order Response:**
• **Order ID**: ${orderResponse.orderId || 'Pending'}
• **Status**: ${orderResponse.status || 'submitted'}
${
  orderResponse.orderHashes && orderResponse.orderHashes.length > 0
    ? `• **Transaction Hash(es)**: ${orderResponse.orderHashes.join(', ')}`
    : ''
}

${
  orderResponse.status === 'matched'
    ? '🎉 Your sell order was immediately matched and executed!'
    : orderResponse.status === 'delayed'
      ? '⏳ Your sell order is subject to a matching delay.'
      : '📋 Your sell order has been placed and is waiting to be matched.'
}`;

        responseData = {
          success: true,
          orderDetails: {
            tokenId,
            side: 'SELL',
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

**Error**: ${orderResponse.errorMsg || 'Unknown error occurred'}

**Order Details Attempted:**
• **Token ID**: ${tokenId.slice(0, 12)}...
• **Price**: $${price.toFixed(4)}
• **Size**: ${size} shares
• **Order Type**: ${orderType}

Common issues with sell orders:
• You don't own enough tokens to sell
• Invalid price or size
• Market not active
• Network connectivity issues

**Check your positions** and try again with valid parameters.`;

        responseData = {
          success: false,
          error: orderResponse.errorMsg,
          orderDetails: {
            tokenId,
            side: 'SELL',
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
        actions: ['SELL_ORDER'],
        data: responseData,
      };

      if (callback) {
        await callback(responseContent);
      }

      return contentToActionResult(responseContent);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred while selling';
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
        actions: ['SELL_ORDER'],
        data: {
          error: errorMessage,
          orderDetails: { tokenId, side: 'SELL', price, size, orderType },
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
        name: '{{user1}}',
        content: {
          text: 'Sell 50 shares of my YES position in the election market at $0.75',
        },
      },
      {
        name: '{{user2}}',
        content: {
          text: "I'll place a limit sell order for your YES position at $0.75 per share...",
          action: 'SELL_ORDER',
        },
      },
    ],
    [
      {
        name: '{{user1}}',
        content: {
          text: 'Close my position in token 123456 at market price',
        },
      },
      {
        name: '{{user2}}',
        content: {
          text: "I'll place a market sell order to close your position immediately...",
          action: 'SELL_ORDER',
        },
      },
    ],
  ],
};