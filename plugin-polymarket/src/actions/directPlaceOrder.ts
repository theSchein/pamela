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
import { initializeClobClient } from '../utils/clobClient';
import { OrderSide, OrderType } from '../types';
import { contentToActionResult, createErrorResult } from '../utils/actionHelpers';
import { checkPolymarketBalance, formatBalanceInfo } from '../utils/balanceChecker';
import { ClobClient, Side } from '@polymarket/clob-client';

interface DirectOrderParams {
  tokenId: string;
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
  orderType?: 'GTC' | 'FOK' | 'GTD' | 'FAK';
}

// Polymarket minimum order constants
const POLYMARKET_MIN_ORDER_VALUE = 1.0; // $1 minimum order value

/**
 * Direct order placement action that bypasses LLM and uses API parameters directly
 * Used for automated trading and testing scenarios
 */
export const directPlaceOrderAction: Action = {
  name: 'DIRECT_PLACE_ORDER',
  similes: [
    'DIRECT_ORDER',
    'API_ORDER',
    'BYPASS_ORDER',
    'AUTOMATED_ORDER',
  ],
  description: 'Place orders directly with API parameters, bypassing LLM extraction',

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    const clobApiUrl = runtime.getSetting('CLOB_API_URL');
    return !!clobApiUrl;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    logger.info('[directPlaceOrderAction] Direct order placement started');

    // Extract parameters from options or message
    const orderParams: DirectOrderParams = {
      tokenId: (options?.tokenId as string) || extractTokenId(message.content?.text || ''),
      side: (options?.side as 'BUY' | 'SELL') || extractSide(message.content?.text || ''),
      price: (typeof options?.price === 'number' ? options.price : extractPrice(message.content?.text || '')) || 0,
      size: (typeof options?.size === 'number' ? options.size : extractSize(message.content?.text || '')) || 0,
      orderType: (options?.orderType as 'GTC' | 'FOK') || 'GTC',
    };

    logger.info('[directPlaceOrderAction] Extracted parameters:', orderParams);

    // Validate required parameters
    if (!orderParams.tokenId || !orderParams.side || orderParams.price <= 0 || orderParams.size <= 0) {
      const errorMessage = 'Invalid order parameters. Required: tokenId, side, price > 0, size > 0';
      return createErrorResult(errorMessage);
    }

    // Calculate total order value
    const totalValue = orderParams.price * orderParams.size;

    // Check minimum order value (Polymarket requirement)
    if (totalValue < POLYMARKET_MIN_ORDER_VALUE) {
      const errorMessage = `Order value $${totalValue.toFixed(2)} is below Polymarket minimum of $${POLYMARKET_MIN_ORDER_VALUE}. Increase size or price.`;
      const errorContent: Content = {
        text: `❌ **Order Below Minimum Value**

**Current Order:**
• **Price**: $${orderParams.price.toFixed(4)} per share
• **Size**: ${orderParams.size} shares  
• **Total Value**: $${totalValue.toFixed(2)}

**Polymarket Requirement:**
• **Minimum Order**: $${POLYMARKET_MIN_ORDER_VALUE.toFixed(2)}
• **Shortfall**: $${(POLYMARKET_MIN_ORDER_VALUE - totalValue).toFixed(2)}

**Suggestions:**
• Increase size to ${Math.ceil(POLYMARKET_MIN_ORDER_VALUE / orderParams.price)} shares
• Or increase price to $${(POLYMARKET_MIN_ORDER_VALUE / orderParams.size).toFixed(4)} per share`,
        actions: ['DIRECT_PLACE_ORDER'],
        data: {
          error: 'Below minimum order value',
          currentValue: totalValue,
          minimumValue: POLYMARKET_MIN_ORDER_VALUE,
          orderParams,
        },
      };

      if (callback) {
        await callback(errorContent);
      }
      return contentToActionResult(errorContent);
    }

    try {
      // Check balance before placing order
      const balanceInfo = await checkPolymarketBalance(runtime, totalValue.toString());
      
      if (!balanceInfo.hasEnoughBalance) {
        const balanceDisplay = formatBalanceInfo(balanceInfo);
        const errorContent: Content = {
          text: `${balanceDisplay}

**Order Details:**
• **Token ID**: ${orderParams.tokenId}
• **Side**: ${orderParams.side}
• **Price**: $${orderParams.price.toFixed(4)}
• **Size**: ${orderParams.size} shares
• **Total Value**: $${totalValue.toFixed(2)}

Insufficient balance for order.`,
          actions: ['DIRECT_PLACE_ORDER'],
          data: {
            error: 'Insufficient balance',
            balanceInfo,
            orderDetails: orderParams,
          },
        };

        if (callback) {
          await callback(errorContent);
        }
        return contentToActionResult(errorContent);
      }

      // Initialize CLOB client
      const client = await initializeClobClient(runtime);

      // Check and derive API credentials if needed
      const hasApiKey = runtime.getSetting('CLOB_API_KEY');
      const hasApiSecret = runtime.getSetting('CLOB_API_SECRET') || runtime.getSetting('CLOB_SECRET');
      const hasApiPassphrase = runtime.getSetting('CLOB_API_PASSPHRASE') || runtime.getSetting('CLOB_PASS_PHRASE');
      
      if (!hasApiKey || !hasApiSecret || !hasApiPassphrase) {
        logger.info('[directPlaceOrderAction] Deriving API credentials');
        
        if (callback) {
          await callback({
            text: '🔑 Deriving API credentials for order placement...',
            actions: ['DIRECT_PLACE_ORDER'],
            data: { status: 'deriving_credentials' },
          });
        }

        const derivedCreds = await client.createOrDeriveApiKey();
        await runtime.setSetting('CLOB_API_KEY', derivedCreds.key);
        await runtime.setSetting('CLOB_API_SECRET', derivedCreds.secret);
        await runtime.setSetting('CLOB_API_PASSPHRASE', derivedCreds.passphrase);
        
        logger.info('[directPlaceOrderAction] API credentials derived successfully');
      }

      // Re-initialize client with credentials
      const authenticatedClient = await initializeClobClient(runtime);

      // Create order arguments
      const orderArgs = {
        tokenID: orderParams.tokenId,
        price: orderParams.price,
        side: orderParams.side === 'BUY' ? Side.BUY : Side.SELL,
        size: orderParams.size,
        feeRateBps: 0,
      };

      logger.info('[directPlaceOrderAction] Creating order with args:', orderArgs);

      if (callback) {
        await callback({
          text: `📋 **Creating Order**

**Order Details:**
• **Token ID**: ${orderParams.tokenId.slice(0, 20)}...
• **Side**: ${orderParams.side}
• **Price**: $${orderParams.price.toFixed(4)}
• **Size**: ${orderParams.size} shares
• **Total**: $${totalValue.toFixed(2)}

Creating signed order...`,
          actions: ['DIRECT_PLACE_ORDER'],
          data: { status: 'creating_order', orderDetails: orderParams },
        });
      }

      // Create the signed order
      const signedOrder = await authenticatedClient.createOrder(orderArgs);
      logger.info('[directPlaceOrderAction] Order created successfully');

      // Post the order
      const orderResponse = await authenticatedClient.postOrder(signedOrder, orderParams.orderType as OrderType);
      logger.info('[directPlaceOrderAction] Order posted successfully');

      // Format response
      let responseText: string;
      let responseData: any;

      if (orderResponse.success) {
        responseText = `✅ **Direct Order Placed Successfully**

**Order Details:**
• **Type**: ${orderParams.orderType.toLowerCase()} ${orderParams.side.toLowerCase()} order
• **Token ID**: ${orderParams.tokenId.slice(0, 20)}...
• **Price**: $${orderParams.price.toFixed(4)} (${(orderParams.price * 100).toFixed(2)}%)
• **Size**: ${orderParams.size} shares
• **Total Value**: $${totalValue.toFixed(2)}

**Order Response:**
• **Order ID**: ${orderResponse.orderId || 'Pending'}
• **Status**: ${orderResponse.status || 'submitted'}
${orderResponse.orderHashes && orderResponse.orderHashes.length > 0
  ? `• **Transaction Hash(es)**: ${orderResponse.orderHashes.join(', ')}`
  : ''
}

🎉 Direct order placement completed!`;

        responseData = {
          success: true,
          orderDetails: orderParams,
          orderResponse,
          totalValue,
          timestamp: new Date().toISOString(),
        };
      } else {
        responseText = `❌ **Direct Order Placement Failed**

**Error**: ${orderResponse.errorMsg || 'Unknown error'}

**Order Details:**
• **Token ID**: ${orderParams.tokenId.slice(0, 20)}...
• **Side**: ${orderParams.side}
• **Price**: $${orderParams.price.toFixed(4)}
• **Size**: ${orderParams.size} shares`;

        responseData = {
          success: false,
          error: orderResponse.errorMsg,
          orderDetails: orderParams,
          timestamp: new Date().toISOString(),
        };
      }

      const responseContent: Content = {
        text: responseText,
        actions: ['DIRECT_PLACE_ORDER'],
        data: responseData,
      };

      if (callback) {
        await callback(responseContent);
      }

      return contentToActionResult(responseContent);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[directPlaceOrderAction] Order placement failed:', error);

      const errorContent: Content = {
        text: `❌ **Direct Order Placement Error**

**Error**: ${errorMessage}

**Order Details:**
• **Token ID**: ${orderParams.tokenId.slice(0, 20)}...
• **Side**: ${orderParams.side}
• **Price**: $${orderParams.price.toFixed(4)}
• **Size**: ${orderParams.size} shares

Direct API order placement failed.`,
        actions: ['DIRECT_PLACE_ORDER'],
        data: {
          error: errorMessage,
          orderDetails: orderParams,
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
          text: 'Direct buy 5 shares of token 114304586861386186441621124384163963092522056897081085884483958561365015034812 at $0.12',
        },
      },
      {
        name: '{{user2}}',
        content: {
          text: "Placing direct order via API...",
          action: 'DIRECT_PLACE_ORDER',
        },
      },
    ],
  ],
};

// Helper functions for parameter extraction
function extractTokenId(text: string): string {
  const tokenMatch = text.match(/(?:token|id)\s+([0-9]{50,})/i);
  return tokenMatch?.[1] || '';
}

function extractSide(text: string): 'BUY' | 'SELL' {
  const buyMatch = text.match(/\b(buy|purchase|long)\b/i);
  const sellMatch = text.match(/\b(sell|short)\b/i);
  return buyMatch ? 'BUY' : sellMatch ? 'SELL' : 'BUY';
}

function extractPrice(text: string): number {
  const priceMatch = text.match(/(?:at|price)\s*\$?([0-9]*\.?[0-9]+)/i);
  return priceMatch ? parseFloat(priceMatch[1]) : 0;
}

function extractSize(text: string): number {
  const sizeMatch = text.match(/([0-9]*\.?[0-9]+)\s*(?:shares|tokens)/i);
  return sizeMatch ? parseFloat(sizeMatch[1]) : 0;
}