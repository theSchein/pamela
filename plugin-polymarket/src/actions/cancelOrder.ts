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

interface CancelOrderParams {
  orderId?: string;
  tokenId?: string;
  marketId?: string;
  cancelAll?: boolean;
  error?: string;
}

/**
 * Cancel order action for Polymarket
 * Cancels specific orders by ID or cancels all orders for a market/token
 */
export const cancelOrderAction: Action = {
  name: "CANCEL_ORDER",
  similes: [
    "CANCEL_ORDER",
    "CANCEL_ORDERS",
    "REMOVE_ORDER",
    "DELETE_ORDER",
    "CANCEL_BID",
    "CANCEL_ASK",
    "STOP_ORDER",
    "WITHDRAW_ORDER",
    "CANCEL_ALL_ORDERS",
    "CANCEL_ALL",
    "CLEAR_ORDERS",
  ],
  description:
    "Cancel open orders on Polymarket by order ID, token ID, or cancel all orders",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    logger.info(
      `[cancelOrderAction] Validate called for message: "${message.content?.text}"`,
    );

    const clobApiUrl = runtime.getSetting("CLOB_API_URL");
    const privateKey =
      runtime.getSetting("WALLET_PRIVATE_KEY") ||
      runtime.getSetting("POLYMARKET_PRIVATE_KEY") ||
      runtime.getSetting("PRIVATE_KEY");

    if (!clobApiUrl) {
      logger.warn(
        "[cancelOrderAction] CLOB_API_URL is required but not provided",
      );
      return false;
    }

    if (!privateKey) {
      logger.warn(
        "[cancelOrderAction] Private key is required for order cancellation",
      );
      return false;
    }

    logger.info("[cancelOrderAction] Validation passed");
    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    logger.info("[cancelOrderAction] Handler called!");

    const clobApiUrl = runtime.getSetting("CLOB_API_URL");

    if (!clobApiUrl) {
      const errorMessage = "CLOB_API_URL is required in configuration.";
      logger.error(`[cancelOrderAction] Configuration error: ${errorMessage}`);
      return createErrorResult(errorMessage);
    }

    let orderId: string = "";
    let tokenId: string = "";
    let cancelAll: boolean = false;

    try {
      // Use LLM to extract parameters
      const llmResult = await callLLMWithTimeout<CancelOrderParams>(
        runtime,
        state,
        `Extract order cancellation parameters from the user's message.

User message: "{{recentMessages}}"

Determine what the user wants to cancel:
1. If they mention a specific order ID, extract it
2. If they mention a token ID or market, extract it  
3. If they say "cancel all" or "cancel all orders", set cancelAll to true
4. Look for order IDs (usually long hex strings or UUIDs)
5. Look for token IDs (very long numeric strings)

Return a JSON object with:
- orderId: specific order ID to cancel (if mentioned)
- tokenId: token ID to cancel all orders for (if mentioned)
- cancelAll: true if user wants to cancel all orders
- error: description if no clear cancellation target found

Examples:
"Cancel order 123abc" -> {"orderId": "123abc"}
"Cancel all orders for token 456def" -> {"tokenId": "456def"}
"Cancel all my orders" -> {"cancelAll": true}
"Cancel that order" -> {"error": "No specific order ID provided"}`,
        "cancelOrderAction",
      );

      logger.info("[cancelOrderAction] LLM result:", JSON.stringify(llmResult));

      if (llmResult?.error) {
        return createErrorResult(
          'Could not determine what to cancel. Please specify an order ID, token ID, or "cancel all orders".',
        );
      }

      orderId = llmResult?.orderId || "";
      tokenId = llmResult?.tokenId || "";
      cancelAll = llmResult?.cancelAll || false;
    } catch (error) {
      logger.warn(
        "[cancelOrderAction] LLM extraction failed, trying regex fallback",
      );

      // Fallback to regex extraction
      const text = message.content?.text || "";

      // Look for order IDs (hex strings, UUIDs)
      const orderIdMatch =
        text.match(/(?:order|id)\s+([a-f0-9-]{8,})/i) ||
        text.match(
          /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i,
        ) ||
        text.match(/0x[a-f0-9]{40,}/i);
      if (orderIdMatch) {
        orderId = orderIdMatch[1] || orderIdMatch[0];
      }

      // Look for token IDs (long numeric strings)
      const tokenIdMatch =
        text.match(/token\s+(\d{50,})/i) || text.match(/(\d{70,})/);
      if (tokenIdMatch) {
        tokenId = tokenIdMatch[1];
      }

      // Look for "cancel all" patterns
      const cancelAllMatch =
        text.match(/cancel\s+(all|everything)/i) ||
        text.match(/clear\s+(all|orders)/i);
      if (cancelAllMatch) {
        cancelAll = true;
      }

      if (!orderId && !tokenId && !cancelAll) {
        const errorMessage =
          'Please specify what to cancel: an order ID, token ID, or "cancel all orders"';

        const errorContent: Content = {
          text: `❌ **Cancellation Target Not Found**

Please specify what you want to cancel:

**Cancel Specific Order:**
• "Cancel order 123abc456def"
• "Remove order 0x789..."

**Cancel All Orders for Token:**
• "Cancel all orders for token 110911393..."
• "Clear orders for this token"

**Cancel All Orders:**
• "Cancel all my orders"
• "Cancel everything"
• "Clear all orders"

**Examples:**
• \`Cancel order a1b2c3d4\`
• \`Cancel all orders for token 123456789...\`
• \`Cancel all my orders\``,
          actions: ["CANCEL_ORDER"],
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

      // Check if we have API credentials for cancellation
      const hasApiKey = runtime.getSetting("CLOB_API_KEY");
      const hasApiSecret =
        runtime.getSetting("CLOB_API_SECRET") ||
        runtime.getSetting("CLOB_SECRET");
      const hasApiPassphrase =
        runtime.getSetting("CLOB_API_PASSPHRASE") ||
        runtime.getSetting("CLOB_PASS_PHRASE");

      if (!hasApiKey || !hasApiSecret || !hasApiPassphrase) {
        logger.info(
          `[cancelOrderAction] API credentials missing, attempting to derive them`,
        );

        if (callback) {
          const derivingContent: Content = {
            text: `🔑 **Deriving API Credentials for Cancellation**

Order cancellation requires L2 API credentials.
Generating credentials from wallet signature...`,
            actions: ["CANCEL_ORDER"],
            data: { step: "deriving_credentials" },
          };
          await callback(derivingContent);
        }

        try {
          const derivedCreds = await client.createOrDeriveApiKey();

          // Store the derived credentials in runtime
          await runtime.setSetting("CLOB_API_KEY", derivedCreds.key);
          await runtime.setSetting("CLOB_API_SECRET", derivedCreds.secret);
          await runtime.setSetting(
            "CLOB_API_PASSPHRASE",
            derivedCreds.passphrase,
          );

          logger.info(
            `[cancelOrderAction] Successfully derived API credentials for cancellation`,
          );
        } catch (deriveError) {
          logger.error(
            `[cancelOrderAction] Failed to derive API credentials:`,
            deriveError,
          );
          return createErrorResult(
            "Failed to derive API credentials needed for order cancellation",
          );
        }
      }

      // Reinitialize client with credentials
      const clientWithCreds = await initializeClobClient(runtime);

      if (callback) {
        const startContent: Content = {
          text: `🚫 **Cancelling Orders**

${orderId ? `**Target**: Specific order ${orderId.substring(0, 12)}...` : ""}
${tokenId ? `**Target**: All orders for token ${tokenId.substring(0, 12)}...` : ""}
${cancelAll ? `**Target**: All open orders` : ""}

Processing cancellation...`,
          actions: ["CANCEL_ORDER"],
          data: { orderId, tokenId, cancelAll },
        };
        await callback(startContent);
      }

      let cancellationResults: any[] = [];

      if (orderId) {
        // Cancel specific order
        logger.info(
          `[cancelOrderAction] Cancelling specific order: ${orderId}`,
        );

        try {
          const result = await clientWithCreds.cancelOrder({
            orderID: orderId,
          });
          cancellationResults.push({
            type: "specific",
            orderId,
            success: !!result,
            result,
          });
        } catch (cancelError) {
          logger.error(
            `[cancelOrderAction] Failed to cancel order ${orderId}:`,
            cancelError,
          );
          cancellationResults.push({
            type: "specific",
            orderId,
            success: false,
            error:
              cancelError instanceof Error
                ? cancelError.message
                : "Unknown error",
          });
        }
      } else if (tokenId) {
        // Cancel all orders for specific token
        logger.info(
          `[cancelOrderAction] Cancelling all orders for token: ${tokenId}`,
        );

        try {
          const result = await clientWithCreds.cancelOrders([tokenId]);
          cancellationResults.push({
            type: "token",
            tokenId,
            success: !!result,
            result,
          });
        } catch (cancelError) {
          logger.error(
            `[cancelOrderAction] Failed to cancel orders for token ${tokenId}:`,
            cancelError,
          );
          cancellationResults.push({
            type: "token",
            tokenId,
            success: false,
            error:
              cancelError instanceof Error
                ? cancelError.message
                : "Unknown error",
          });
        }
      } else if (cancelAll) {
        // Cancel all orders
        logger.info(`[cancelOrderAction] Cancelling all orders`);

        try {
          const result = await clientWithCreds.cancelAll();
          cancellationResults.push({
            type: "all",
            success: !!result,
            result,
          });
        } catch (cancelError) {
          logger.error(
            `[cancelOrderAction] Failed to cancel all orders:`,
            cancelError,
          );
          cancellationResults.push({
            type: "all",
            success: false,
            error:
              cancelError instanceof Error
                ? cancelError.message
                : "Unknown error",
          });
        }
      }

      // Format response
      const successfulCancellations = cancellationResults.filter(
        (r) => r.success,
      );
      const failedCancellations = cancellationResults.filter((r) => !r.success);

      let responseText = "";

      if (successfulCancellations.length > 0) {
        responseText += `✅ **Orders Cancelled Successfully**\n\n`;

        successfulCancellations.forEach((result, index) => {
          if (result.type === "specific") {
            responseText += `• **Order ${result.orderId.substring(0, 12)}...**: Cancelled\n`;
          } else if (result.type === "token") {
            responseText += `• **Token ${result.tokenId.substring(0, 12)}...**: All orders cancelled\n`;
          } else if (result.type === "all") {
            responseText += `• **All Orders**: Cancelled successfully\n`;
          }
        });
      }

      if (failedCancellations.length > 0) {
        responseText += `\n❌ **Cancellation Failures**\n\n`;

        failedCancellations.forEach((result) => {
          if (result.type === "specific") {
            responseText += `• **Order ${result.orderId.substring(0, 12)}...**: ${result.error}\n`;
          } else if (result.type === "token") {
            responseText += `• **Token ${result.tokenId.substring(0, 12)}...**: ${result.error}\n`;
          } else if (result.type === "all") {
            responseText += `• **All Orders**: ${result.error}\n`;
          }
        });
      }

      if (cancellationResults.length === 0) {
        responseText = `❌ **No Cancellation Performed**\n\nNo orders were found to cancel or cancellation parameters were invalid.`;
      }

      const responseContent: Content = {
        text: responseText,
        actions: ["CANCEL_ORDER"],
        data: {
          success: successfulCancellations.length > 0,
          cancelled: successfulCancellations.length,
          failed: failedCancellations.length,
          results: cancellationResults,
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
          : "Unknown error occurred while cancelling orders";
      logger.error(`[cancelOrderAction] Cancellation error:`, error);

      const errorContent: Content = {
        text: `❌ **Order Cancellation Failed**

**Error**: ${errorMessage}

This could be due to:
• Orders already filled or cancelled
• Invalid order IDs
• Network connectivity issues
• API authentication problems

Please check your order status and try again.`,
        actions: ["CANCEL_ORDER"],
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
          text: "Cancel order abc123def456",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll cancel that specific order for you...",
          action: "CANCEL_ORDER",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "Cancel all my orders",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll cancel all your open orders...",
          action: "CANCEL_ORDER",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "Cancel all orders for token 123456789012345678901234567890",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll cancel all orders for that token...",
          action: "CANCEL_ORDER",
        },
      },
    ],
  ],
};
