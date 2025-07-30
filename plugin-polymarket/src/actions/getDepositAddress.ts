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
  contentToActionResult,
  createErrorResult,
} from "../utils/actionHelpers";
import { getDepositAddress } from "../utils/depositManager";
import { checkUSDCBalance } from "../utils/balanceChecker";

/**
 * Get deposit address action for Polymarket
 * Shows user their Polymarket deposit address and current balances
 */
export const getDepositAddressAction: Action = {
  name: "GET_DEPOSIT_ADDRESS",
  similes: [
    "GET_POLYMARKET_ADDRESS",
    "DEPOSIT_ADDRESS",
    "WHERE_TO_DEPOSIT",
    "POLYMARKET_ADDRESS",
    "FUNDING_ADDRESS",
    "PROXY_WALLET_ADDRESS",
    "HOW_TO_DEPOSIT",
    "DEPOSIT_INFO",
    "FUND_INFO",
    "ACCOUNT_ADDRESS",
  ],
  description: "Get Polymarket deposit address and funding information",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    logger.info(
      `[getDepositAddressAction] Validate called for message: "${message.content?.text}"`,
    );

    // Check if wallet is configured
    const privateKey =
      runtime.getSetting("WALLET_PRIVATE_KEY") ||
      runtime.getSetting("PRIVATE_KEY") ||
      runtime.getSetting("POLYMARKET_PRIVATE_KEY");

    if (!privateKey) {
      logger.warn("[getDepositAddressAction] No wallet private key configured");
      return false;
    }

    // Check if message contains deposit address related terms
    const text = message.content?.text?.toLowerCase() || "";
    const addressKeywords = [
      "deposit",
      "address",
      "where",
      "send",
      "fund",
      "polymarket",
      "proxy",
      "wallet",
    ];

    const containsKeyword = addressKeywords.some((keyword) =>
      text.includes(keyword),
    );

    if (!containsKeyword) {
      logger.info(
        "[getDepositAddressAction] No deposit address keywords found",
      );
      return false;
    }

    logger.info("[getDepositAddressAction] Validation passed");
    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    logger.info("[getDepositAddressAction] Handler called!");

    try {
      // Get user's current wallet balance
      const walletBalance = await checkUSDCBalance(runtime, "0");

      // Get the Polymarket deposit address
      const depositAddress = await getDepositAddress(runtime);

      const responseText = `💰 **Polymarket Deposit Information**

**Your Deposit Address:**
\`${depositAddress}\`

**Current Balances:**
• **Wallet USDC**: $${parseFloat(walletBalance.usdcBalance).toFixed(2)}
• **Wallet Address**: ${walletBalance.address}

**How to Fund Your Polymarket Account:**

**Method 1: Use the Deposit Command**
• Type: "Deposit $50 to Polymarket"
• I'll automatically transfer USDC from your wallet

**Method 2: Manual Transfer**
• Send USDC (on Polygon network) to the deposit address above
• Funds will be available for trading once confirmed

**Important Notes:**
• ⚠️ Only send USDC on the **Polygon network**
• ⚠️ Do NOT send other tokens or use Ethereum network
• ✅ Deposits are usually confirmed within minutes
• ✅ Once deposited, funds are immediately available for trading

**Next Steps:**
1. Fund your account using one of the methods above
2. Use "check my balances" to verify deposit
3. Start trading with "show open markets"

*Your deposit address is unique to your wallet and safe to reuse.*`;

      const responseContent: Content = {
        text: responseText,
        actions: ["POLYMARKET_GET_DEPOSIT_ADDRESS"],
        data: {
          depositAddress,
          walletAddress: walletBalance.address,
          walletBalance: parseFloat(walletBalance.usdcBalance),
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
      logger.error(`[getDepositAddressAction] Error:`, error);

      const errorContent: Content = {
        text: `❌ **Unable to Get Deposit Address**

**Error**: ${errorMessage}

**This could be due to:**
• Wallet configuration issues
• Network connectivity problems
• Invalid private key format

**Please check:**
• Your wallet private key is correctly set
• Network connection is stable
• Try again in a few moments

*Contact support if the issue persists.*`,
        actions: ["POLYMARKET_GET_DEPOSIT_ADDRESS"],
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
          text: "What is my Polymarket deposit address?",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll get your Polymarket deposit address and show you how to fund your account...",
          action: "POLYMARKET_GET_DEPOSIT_ADDRESS",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "Where do I send USDC to fund my Polymarket account?",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "Let me show you your unique Polymarket deposit address and funding options...",
          action: "POLYMARKET_GET_DEPOSIT_ADDRESS",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "How do I deposit funds for trading?",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll provide your deposit address and explain all the ways to fund your Polymarket account...",
          action: "POLYMARKET_GET_DEPOSIT_ADDRESS",
        },
      },
    ],
  ],
};
