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
import {
  checkUSDCBalance,
  checkPolymarketBalance,
  formatBalanceInfo,
  getMaxPositionSize,
} from "../utils/balanceChecker";
import {
  contentToActionResult,
  createErrorResult,
} from "../utils/actionHelpers";

/**
 * Get wallet balance action for Polymarket trading
 * Shows USDC balance, wallet address, and trading limits
 */
export const getWalletBalanceAction: Action = {
  name: "GET_WALLET_BALANCE",
  similes: [
    "CHECK_BALANCE",
    "WALLET_BALANCE",
    "MY_BALANCE",
    "SHOW_BALANCE",
    "ACCOUNT_BALANCE",
    "USDC_BALANCE",
    "HOW_MUCH_MONEY",
    "FUNDS_AVAILABLE",
    "TRADING_BALANCE",
    "AVAILABLE_FUNDS",
    "WALLET_INFO",
    "BALANCE_CHECK",
    "MONEY_CHECK",
    "PORTFOLIO_BALANCE",
    "ACCOUNT_INFO",
  ],
  description: "Check USDC balance and trading limits for Polymarket wallet",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    logger.info(
      `[getWalletBalanceAction] Validate called for message: "${message.content?.text}"`,
    );

    // This action doesn't require any specific validation beyond having a wallet configured
    const privateKey =
      runtime.getSetting("WALLET_PRIVATE_KEY") ||
      runtime.getSetting("PRIVATE_KEY") ||
      runtime.getSetting("POLYMARKET_PRIVATE_KEY") ||
      runtime.getSetting("EVM_PRIVATE_KEY");

    if (!privateKey) {
      logger.warn("[getWalletBalanceAction] No wallet private key configured");
      return false;
    }

    logger.info("[getWalletBalanceAction] Validation passed");
    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    logger.info("[getWalletBalanceAction] Handler called!");

    try {
      // Check Polymarket trading balance (actual available USDC for trading)
      const balanceInfo = await checkPolymarketBalance(runtime, "0");

      // Calculate maximum position size using the same balance info (avoid second RPC call)
      const currentBalance = parseFloat(balanceInfo.usdcBalance);
      const configuredMaxPosition = parseFloat(
        runtime.getSetting("MAX_POSITION_SIZE") || "100",
      );
      const minConfidenceThreshold = parseFloat(
        runtime.getSetting("MIN_CONFIDENCE_THRESHOLD") || "0.7",
      );
      const maxPositionSize = Math.min(
        currentBalance * minConfidenceThreshold,
        configuredMaxPosition,
      );

      // Get additional configuration settings
      const tradingEnabled = runtime.getSetting("TRADING_ENABLED") !== "false";

      // Log the balance calculation for debugging
      logger.info(`[getWalletBalanceAction] Balance calculation:`, {
        walletBalance: balanceInfo.usdcBalance,
        configuredMax: configuredMaxPosition,
        confidenceThreshold: minConfidenceThreshold,
        calculatedMax: maxPositionSize,
      });

      // Format balance display
      const balanceDisplay = parseFloat(balanceInfo.usdcBalance).toFixed(2);
      const availableForTrading = Math.min(
        parseFloat(balanceInfo.usdcBalance),
        maxPositionSize,
      ).toFixed(2);

      const responseText = `💰 **Polymarket Trading Balance**

**Account Details:**
• **Address**: ${balanceInfo.address}
• **Trading Balance**: $${balanceDisplay}
• **Network**: Polygon (Chain ID: 137)
• **Balance Type**: Polymarket CLOB Available Funds

**Trading Limits:**
• **Max Position Size**: $${configuredMaxPosition.toFixed(2)}
• **Available for Trading**: $${availableForTrading}
• **Confidence Threshold**: ${(minConfidenceThreshold * 100).toFixed(0)}%
• **Trading Status**: ${tradingEnabled ? "✅ Enabled" : "❌ Disabled"}

**Risk Management:**
• **Effective Limit**: $${maxPositionSize.toFixed(2)}
• **Safety Buffer**: ${(minConfidenceThreshold * 100).toFixed(0)}% of balance
• **Reserved Funds**: $${Math.max(0, parseFloat(balanceInfo.usdcBalance) - maxPositionSize).toFixed(2)}

${
  parseFloat(balanceInfo.usdcBalance) > 0
    ? "✅ **Ready for Trading** - You have USDC available in your Polymarket account."
    : "⚠️  **No Trading Balance** - You need to deposit USDC into your Polymarket account to trade."
}

*Use "show open markets" to see available trading opportunities.*`;

      const responseContent: Content = {
        text: responseText,
        actions: ["POLYMARKET_GET_WALLET_BALANCE"],
        data: {
          balanceInfo,
          tradingLimits: {
            maxPositionSize,
            configuredMaxPosition,
            minConfidenceThreshold,
            tradingEnabled,
          },
          timestamp: new Date().toISOString(),
        },
      };

      if (callback) {
        await callback(responseContent);
      }

      return contentToActionResult(responseContent);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      logger.error(`[getWalletBalanceAction] Balance check error:`, error);

      const errorContent: Content = {
        text: `❌ **Wallet Balance Check Failed**

**Error**: ${errorMessage}

This could be due to:
• Network connectivity issues
• Invalid wallet configuration
• RPC provider problems
• Insufficient permissions

**Please check:**
• Your wallet private key is correctly configured
• Network connection is stable
• Polygon RPC endpoints are accessible

Try again in a moment or check your configuration.`,
        actions: ["POLYMARKET_GET_WALLET_BALANCE"],
        data: {
          error: errorMessage,
          timestamp: new Date().toISOString(),
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
          text: "What is my wallet balance?",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll check your USDC balance and trading limits for you...",
          action: "POLYMARKET_GET_WALLET_BALANCE",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "How much money do I have available for trading?",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "Let me check your available funds and trading limits...",
          action: "POLYMARKET_GET_WALLET_BALANCE",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "Show me my account balance and trading info",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll display your wallet balance and all trading configuration details...",
          action: "POLYMARKET_GET_WALLET_BALANCE",
        },
      },
    ],
  ],
};
