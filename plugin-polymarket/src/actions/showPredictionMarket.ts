/**
 * Show Prediction Market Action - Database First
 * Efficiently shows prediction markets from local database first, API fallback
 */

import {
  type Action,
  type ActionResult,
  type IAgentRuntime,
  type Memory,
  type HandlerCallback,
  logger,
  elizaLogger,
} from "@elizaos/core";
import { MarketDetailService } from "../services/MarketDetailService";

export const showPredictionMarketAction: Action = {
  name: "SHOW_PREDICTION_MARKET",
  similes: [
    "show me a prediction market",
    "show me prediction markets",
    "prediction market",
    "show market",
    "display market",
    "get market",
    "market info",
    "show me a market",
    "tell me about markets",
  ],
  description: "Show prediction markets from database (fast response)",
  examples: [
    [
      {
        name: "Human",
        content: {
          text: "show me a prediction market",
        },
      },
      {
        name: "Assistant",
        content: {
          text: "Here are some active prediction markets from our database.",
          action: "SHOW_PREDICTION_MARKET",
        },
      },
    ],
    [
      {
        name: "Human",
        content: {
          text: "show me prediction markets",
        },
      },
      {
        name: "Assistant",
        content: {
          text: "Let me show you current prediction markets.",
          action: "SHOW_PREDICTION_MARKET",
        },
      },
    ],
  ],
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    if (!message.content?.text) {
      return false;
    }

    const text = message.content.text.toLowerCase();

    // Simple and direct validation for "show me (a) prediction market(s)" queries
    const directMarketKeywords = [
      "show me a prediction market",
      "show me prediction markets",
      "show me a market",
      "show prediction market",
      "prediction market",
      "show market",
      "display market",
    ];

    // High priority match - direct requests for markets
    const isDirect = directMarketKeywords.some((keyword) =>
      text.includes(keyword),
    );
    if (isDirect) return true;

    // Secondary match - general market requests without search intent
    const hasMarketWord = text.includes("market");
    const hasShowWord =
      text.includes("show") || text.includes("get") || text.includes("display");
    const noSearchIntent =
      !text.includes("search") &&
      !text.includes("find") &&
      !text.includes("about");

    return hasMarketWord && hasShowWord && noSearchIntent;
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: any,
    options: any,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    elizaLogger.info(
      "[showPredictionMarketAction] Handler called - using database-first approach",
    );

    try {
      const marketDetailService = runtime.getService<MarketDetailService>(
        "polymarket-market-detail",
      );

      if (!marketDetailService) {
        const errorMessage = "Market detail service not available";
        elizaLogger.error(errorMessage);
        if (callback) {
          callback({
            text: errorMessage,
            success: false,
          });
        }
        return { text: errorMessage, success: false };
      }

      // Use database-first approach - get popular markets (already filters for current markets)
      elizaLogger.info("Fetching markets from database...");
      const markets = await marketDetailService.getPopularMarkets(undefined, 5);

      if (markets.length === 0) {
        const fallbackMsg = `No active prediction markets found in our database yet. This could mean:\n\n• The market sync service is still running\n• Database is being populated with current markets\n• No current markets match our filtering criteria\n\nTry again in a few moments, or ask me to search for specific topics like "election" or "crypto".`;

        if (callback) {
          callback({
            text: fallbackMsg,
            success: true,
          });
        }
        return { text: fallbackMsg, success: true };
      }

      // Format response with market information
      let response = `📊 **Here are ${markets.length} active prediction markets:**\n\n`;

      for (let i = 0; i < markets.length; i++) {
        const market = markets[i];
        const endDate = market.endDateIso
          ? new Date(market.endDateIso).toLocaleDateString()
          : "No end date";
        const category = market.category || "Uncategorized";

        response += `**${i + 1}. ${market.question}**\n`;
        response += `📊 Category: ${category}\n`;
        response += `📅 End Date: ${endDate}\n`;
        response += `✅ Status: Active\n`;

        if (i < markets.length - 1) {
          response += "\n---\n\n";
        }
      }

      response +=
        '\n\n💡 *Want to search for specific markets? Ask me to "find markets about [topic]" or "search for [keyword] markets".*';

      if (callback) {
        callback({
          text: response,
          success: true,
        });
      }

      return { text: response, success: true };
    } catch (error) {
      const errorMessage = `Error showing prediction markets: ${error instanceof Error ? error.message : "Unknown error"}`;
      elizaLogger.error(errorMessage, error);

      if (callback) {
        callback({
          text: errorMessage,
          success: false,
        });
      }

      return { text: errorMessage, success: false };
    }
  },
};
