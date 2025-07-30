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
import {
  contentToActionResult,
  createErrorResult,
} from "../utils/actionHelpers";
import {
  depositUSDC,
  getDepositAddress,
  formatDepositInfo,
} from "../utils/depositManager";
import { checkUSDCBalance } from "../utils/balanceChecker";

interface DepositParams {
  amount: number;
  error?: string;
}

const depositTemplate = `You are an AI assistant. Your task is to extract deposit parameters from the user's message.

Review the recent messages:
<recent_messages>
{{recentMessages}}
</recent_messages>

Based on the conversation, identify:
- amount: The amount of USDC to deposit (required, as a number)

**Examples:**
- "Deposit $50 to Polymarket" → amount: 50
- "Fund my account with 25 USDC" → amount: 25
- "Add $100 to my trading balance" → amount: 100
- "Deposit 10.50" → amount: 10.5

**Pattern Recognition:**
- Look for dollar amounts like "$50", "25 USDC", "100 dollars"
- Common words: "deposit", "fund", "add", "transfer"
- Numbers followed by currency indicators

Respond with a JSON object containing the extracted values:
{
    "amount": number
}

If the amount cannot be determined, respond with:
{
    "error": "Amount not specified. Please specify how much USDC to deposit (e.g., 'deposit $50')."
}`;

/**
 * Deposit USDC action for Polymarket trading
 * Transfers USDC from wallet to Polymarket proxy wallet
 */
export const depositUSDCAction: Action = {
  name: "DEPOSIT_USDC",
  similes: [
    "FUND_ACCOUNT",
    "ADD_FUNDS",
    "DEPOSIT_FUNDS",
    "TRANSFER_USDC",
    "ADD_USDC",
    "FUND_POLYMARKET",
    "DEPOSIT_TO_POLYMARKET",
    "ADD_MONEY",
    "FUND_TRADING",
    "DEPOSIT_MONEY",
    "TRANSFER_FUNDS",
    "ADD_BALANCE",
    "FUND_WALLET",
    "POLYMARKET_DEPOSIT",
  ],
  description: "Deposit USDC from wallet to Polymarket account for trading",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    logger.info(
      `[depositUSDCAction] Validate called for message: "${message.content?.text}"`,
    );

    // Check if wallet is configured
    const privateKey =
      runtime.getSetting("WALLET_PRIVATE_KEY") ||
      runtime.getSetting("PRIVATE_KEY") ||
      runtime.getSetting("POLYMARKET_PRIVATE_KEY");

    if (!privateKey) {
      logger.warn("[depositUSDCAction] No wallet private key configured");
      return false;
    }

    // Check if message contains deposit-related terms
    const text = message.content?.text?.toLowerCase() || "";
    const depositKeywords = [
      "deposit",
      "fund",
      "add",
      "transfer",
      "money",
      "usdc",
      "balance",
    ];

    const containsDepositKeyword = depositKeywords.some((keyword) =>
      text.includes(keyword),
    );

    if (!containsDepositKeyword) {
      logger.info("[depositUSDCAction] No deposit keywords found");
      return false;
    }

    logger.info("[depositUSDCAction] Validation passed");
    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    logger.info("[depositUSDCAction] Handler called!");

    try {
      // Use LLM to extract deposit amount
      const llmResult = await callLLMWithTimeout<DepositParams>(
        runtime,
        state,
        depositTemplate,
        "depositUSDCAction",
      );

      logger.info("[depositUSDCAction] LLM result:", JSON.stringify(llmResult));

      if (llmResult?.error) {
        const errorContent: Content = {
          text: `❌ **${llmResult.error}**

**How to deposit USDC:**
- "Deposit $50 to Polymarket"
- "Fund my account with 25 USDC" 
- "Add $100 to my trading balance"

**What happens when you deposit:**
1. USDC transfers from your wallet to your Polymarket account
2. Funds become available for trading on prediction markets
3. You can check your trading balance anytime

*Make sure you have enough USDC in your wallet before depositing.*`,
          actions: ["POLYMARKET_DEPOSIT_USDC"],
          data: { error: llmResult.error },
        };

        if (callback) {
          await callback(errorContent);
        }
        return contentToActionResult(errorContent);
      }

      const amount = llmResult?.amount || 0;

      if (amount <= 0) {
        return createErrorResult("Invalid deposit amount");
      }

      // Check wallet USDC balance before attempting deposit
      logger.info(
        `[depositUSDCAction] Checking wallet balance for deposit of $${amount}`,
      );

      const balanceInfo = await checkUSDCBalance(runtime, amount.toString());

      if (!balanceInfo.hasEnoughBalance) {
        const shortfall = (
          amount - parseFloat(balanceInfo.usdcBalance)
        ).toFixed(2);
        const errorContent: Content = {
          text: `❌ **Insufficient USDC Balance**

**Deposit Request:** $${amount.toFixed(2)}
**Wallet Balance:** $${parseFloat(balanceInfo.usdcBalance).toFixed(2)}
**Shortfall:** $${shortfall}

**To proceed:**
1. Add more USDC to your wallet: ${balanceInfo.address}
2. Try depositing a smaller amount: $${parseFloat(balanceInfo.usdcBalance).toFixed(2)} or less

Your wallet needs USDC before you can deposit to Polymarket.`,
          actions: ["POLYMARKET_DEPOSIT_USDC"],
          data: {
            error: "Insufficient balance",
            requested: amount,
            available: parseFloat(balanceInfo.usdcBalance),
            shortfall: parseFloat(shortfall),
          },
        };

        if (callback) {
          await callback(errorContent);
        }
        return contentToActionResult(errorContent);
      }

      // Show confirmation and initiate deposit
      if (callback) {
        const confirmationContent: Content = {
          text: `💰 **Initiating USDC Deposit**

**Deposit Details:**
• **Amount**: $${amount.toFixed(2)}
• **From**: ${balanceInfo.address}
• **Wallet Balance**: $${parseFloat(balanceInfo.usdcBalance).toFixed(2)}
• **Remaining After**: $${(parseFloat(balanceInfo.usdcBalance) - amount).toFixed(2)}

**Process:**
1. Calculating your Polymarket deposit address...
2. Transferring USDC to your Polymarket account...
3. Confirming transaction on Polygon network...

*This may take a few moments. Please wait...*`,
          actions: ["POLYMARKET_DEPOSIT_USDC"],
          data: {
            depositAmount: amount,
            walletBalance: parseFloat(balanceInfo.usdcBalance),
          },
        };
        await callback(confirmationContent);
      }

      // Execute the deposit
      logger.info(`[depositUSDCAction] Executing deposit of $${amount}`);
      const depositResult = await depositUSDC(runtime, amount.toString());

      // Format and return result
      const resultText = formatDepositInfo(depositResult);
      const responseContent: Content = {
        text: resultText,
        actions: ["POLYMARKET_DEPOSIT_USDC"],
        data: {
          success: depositResult.success,
          depositInfo: depositResult,
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
      logger.error(`[depositUSDCAction] Deposit error:`, error);

      const errorContent: Content = {
        text: `❌ **Deposit Error**

**Error**: ${errorMessage}

**Common Issues:**
• Network connectivity problems
• Insufficient gas for transaction
• Invalid wallet configuration
• RPC provider issues

**Please try:**
• Check your wallet configuration
• Ensure you have MATIC for gas fees
• Try again in a few moments
• Contact support if issue persists`,
        actions: ["POLYMARKET_DEPOSIT_USDC"],
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
          text: "Deposit $50 to my Polymarket account",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll deposit $50 USDC from your wallet to your Polymarket account. This will make the funds available for trading...",
          action: "POLYMARKET_DEPOSIT_USDC",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "Fund my account with 25 USDC for trading",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll transfer 25 USDC from your wallet to your Polymarket trading account...",
          action: "POLYMARKET_DEPOSIT_USDC",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "Add $100 to my trading balance",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll add $100 to your Polymarket trading balance by transferring USDC from your wallet...",
          action: "POLYMARKET_DEPOSIT_USDC",
        },
      },
    ],
  ],
};
