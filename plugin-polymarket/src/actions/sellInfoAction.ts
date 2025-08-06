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
} from "../utils/actionHelpers";

/**
 * Informational action explaining L2 requirements for selling
 */
export const sellInfoAction: Action = {
  name: "SELL_INFO",
  similes: [
    "SELL",
    "SELL_ORDER",
    "SELL_TOKEN",
    "SELL_POSITION",
    "CLOSE_POSITION",
    "EXIT_POSITION",
    "LIQUIDATE",
    "CASH_OUT",
  ],
  description: "Explains L2 requirements for selling on Polymarket",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    const sellKeywords = ["sell", "liquidate", "exit", "close position", "cash out"];
    return sellKeywords.some(keyword => text.includes(keyword));
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    logger.info("[sellInfoAction] Handler called - explaining L2 requirements");

    const responseContent: Content = {
      text: `⚠️ **Selling Requires L2 API Credentials**

Unfortunately, I cannot execute sell orders with only L1 (wallet-only) access.

**To sell your positions, you need:**
1. Polymarket API credentials (L2 access)
2. Generate API keys at: https://polymarket.com/settings/api-keys
3. Add credentials to your environment:
   - \`CLOB_API_KEY\`
   - \`CLOB_API_SECRET\`
   - \`CLOB_API_PASSPHRASE\`

**Alternative Options:**
• Use the Polymarket web interface to sell manually
• Trade through the official Polymarket app
• Consider holding until you can set up API access

**What I CAN do with L1 access:**
✅ Buy positions
✅ Check portfolio & balances
✅ View market prices
✅ Search markets
✅ Analyze opportunities

Would you like help with any of these available features instead?`,
      actions: ["SELL_INFO"],
      data: {
        requiresL2: true,
        availableWithL1: [
          "buying",
          "portfolio viewing",
          "market search",
          "price checking",
        ],
      },
    };

    if (callback) {
      await callback(responseContent);
    }

    return contentToActionResult(responseContent);
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: {
          text: "Sell my position in the election market",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I understand you want to sell, but selling requires L2 API credentials which aren't currently configured.",
          action: "SELL_INFO",
        },
      },
    ],
  ],
};