/**
 * Direct Order Module
 * 
 * Provides direct order placement functionality to the CLOB API, bypassing
 * LLM extraction. This module is used by the autonomous trading service
 * when all order parameters are already known programmatically.
 * 
 * Key features:
 * - Direct CLOB API integration without LLM parsing
 * - Client caching to avoid re-deriving API credentials
 * - Support for both BUY and SELL orders
 * - Configurable order types (GTC, IOC, etc.)
 * - Error handling with detailed feedback
 * 
 * This module is essential for autonomous trading as it allows the system
 * to place orders efficiently without the overhead of natural language
 * processing when we already have structured data.
 * 
 * Usage:
 * - Called by TradeExecutor when executing autonomous trades
 * - Can accept an existing CLOB client to avoid re-initialization
 * - Returns success status with order ID or error details
 */

import {
  elizaLogger,
  IAgentRuntime,
  UUID,
  Content,
  HandlerCallback,
} from "@elizaos/core";
import { initializeClobClient } from "../../../plugin-polymarket/src/utils/clobClient.js";
import { Side } from "@polymarket/clob-client";
import type { ClobClient } from "../../../plugin-polymarket/src/utils/clobClient.js";
import { DirectOrderParams } from "./types.js";

// Cache the CLOB client to avoid re-deriving API credentials on every order
let cachedClobClient: ClobClient | undefined = undefined;
let cacheKey: string | undefined = undefined;

/**
 * Place an order directly with the CLOB API, bypassing the LLM extraction
 * This is used by the autonomous trading service where we already have all parameters
 */
export async function placeDirectOrder(
  runtime: IAgentRuntime,
  params: DirectOrderParams,
  callback?: HandlerCallback,
  clobClient?: ClobClient, // Allow passing an existing client
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  try {
    elizaLogger.info("[placeDirectOrder] Placing order directly with CLOB API");
    elizaLogger.info(
      `[placeDirectOrder] Parameters: ${JSON.stringify(params)}`,
    );

    // Use provided client or get/create cached one
    let client = clobClient;
    if (!client) {
      const currentKey = runtime.agentId;
      if (cachedClobClient && cacheKey === currentKey) {
        elizaLogger.info("[placeDirectOrder] Using cached CLOB client");
        client = cachedClobClient;
      } else {
        elizaLogger.info("[placeDirectOrder] Initializing new CLOB client");
        client = await initializeClobClient(runtime);
        cachedClobClient = client;
        cacheKey = currentKey;
      }
    }

    if (!client) {
      const error = "Failed to initialize CLOB client";
      elizaLogger.error(`[placeDirectOrder] ${error}`);
      if (callback) {
        await callback({
          text: `❌ ${error}`,
          data: { error },
        } as Content);
      }
      return { success: false, error };
    }

    // Place the order using the same format as the placeOrder action
    const orderType = params.orderType || "GTC";

    elizaLogger.info(
      `[placeDirectOrder] Placing ${orderType} order: ${params.side} ${params.size} @ ${params.price} for token ${params.tokenId}`,
    );

    // Create order arguments matching the CLOB client interface
    const orderArgs = {
      tokenID: params.tokenId,
      price: params.price,
      size: params.size,
      side: params.side === "BUY" ? Side.BUY : Side.SELL,
      feeRateBps: 0,
    };

    // Create the signed order
    const signedOrder = await client.createOrder(orderArgs);

    // Post the order
    const resp = await client.postOrder(signedOrder, orderType as any);

    if (resp && resp.orderID) {
      elizaLogger.info(
        `[placeDirectOrder] Order placed successfully: ${resp.orderID}`,
      );

      if (callback) {
        await callback({
          text: `✅ Order placed successfully!\n\nOrder ID: ${resp.orderID}`,
          data: {
            orderId: resp.orderID,
            tokenId: params.tokenId,
            side: params.side,
            price: params.price,
            size: params.size,
          },
        } as Content);
      }

      return {
        success: true,
        orderId: resp.orderID,
      };
    } else {
      const error = "Order placement failed - no order ID returned";
      elizaLogger.error(`[placeDirectOrder] ${error}`);

      if (callback) {
        await callback({
          text: `❌ ${error}`,
          data: { error },
        } as Content);
      }

      return { success: false, error };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    elizaLogger.error(`[placeDirectOrder] Error placing order: ${errorMsg}`);

    if (callback) {
      await callback({
        text: `❌ Order placement failed: ${errorMsg}`,
        data: { error: errorMsg },
      } as Content);
    }

    return { success: false, error: errorMsg };
  }
}