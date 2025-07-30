/**
 * Get Popular Markets Action
 * Shows popular/trending markets by category
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

export const getPopularMarketsAction: Action = {
  name: "GET_POPULAR_MARKETS",
  similes: [
    "popular markets",
    "trending markets",
    "hot markets",
    "what markets are popular",
    "show me trending markets",
    "what are the popular bets",
    "top markets",
    "best markets",
  ],
  description: "Get popular and trending prediction markets",
  examples: [
    [
      {
        name: "Human",
        content: {
          text: "What are the popular markets right now?",
        },
      },
      {
        name: "Assistant",
        content: {
          text: "Let me show you the most popular prediction markets.",
          action: "GET_POPULAR_MARKETS",
        },
      },
    ],
    [
      {
        name: "Human",
        content: {
          text: "Show me trending markets in politics",
        },
      },
      {
        name: "Assistant",
        content: {
          text: "Fetching trending political markets...",
          action: "GET_POPULAR_MARKETS",
        },
      },
    ],
    [
      {
        name: "Human",
        content: {
          text: "What are the hot crypto markets?",
        },
      },
      {
        name: "Assistant",
        content: {
          text: "Looking up popular cryptocurrency prediction markets.",
          action: "GET_POPULAR_MARKETS",
        },
      },
    ],
  ],
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    if (!message.content?.text) {
      return false;
    }

    const text = message.content.text.toLowerCase();

    // Check for popular/trending keywords
    const popularKeywords = [
      "popular",
      "trending",
      "hot",
      "top",
      "best",
      "most active",
      "what are the",
      "show me",
      "popular markets",
      "trending markets",
    ];

    return (
      popularKeywords.some((keyword) => text.includes(keyword)) &&
      (text.includes("market") || text.includes("bet"))
    );
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: any,
    options: any,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
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

      const messageText = message.content?.text || "";

      // Try to extract category from message
      let category: string | undefined;
      const categoryKeywords = {
        politics: ["politic", "election", "government", "president"],
        crypto: ["crypto", "bitcoin", "ethereum", "blockchain", "defi"],
        sports: ["sport", "football", "basketball", "soccer", "nfl", "nba"],
        tech: [
          "tech",
          "technology",
          "ai",
          "artificial intelligence",
          "tech stock",
        ],
        economics: [
          "economic",
          "economy",
          "inflation",
          "fed",
          "gdp",
          "recession",
        ],
      };

      for (const [cat, keywords] of Object.entries(categoryKeywords)) {
        if (
          keywords.some((keyword) =>
            messageText.toLowerCase().includes(keyword),
          )
        ) {
          category = cat;
          break;
        }
      }

      elizaLogger.info(
        `Getting popular markets${category ? ` in category: ${category}` : ""}`,
      );

      // Get popular markets
      const markets = await marketDetailService.getPopularMarkets(category, 8);

      if (markets.length === 0) {
        const message = category
          ? `No active markets found in the ${category} category.`
          : "No active markets found.";

        if (callback) {
          callback({
            text: message,
            success: true,
          });
        }
        return { text: message, success: true };
      }

      // Format response
      let response = category
        ? `**Popular ${category.charAt(0).toUpperCase() + category.slice(1)} Markets** (${markets.length} found):\n\n`
        : `**Popular Markets** (${markets.length} found):\n\n`;

      for (let i = 0; i < markets.length; i++) {
        const market = markets[i];
        const endDate = market.endDateIso
          ? new Date(market.endDateIso).toLocaleDateString()
          : "No end date";
        const categoryLabel = market.category || "Uncategorized";

        response += `**${i + 1}. ${market.question}**\n`;
        response += `📊 Category: ${categoryLabel}\n`;
        response += `📅 End Date: ${endDate}\n`;
        response += `✅ Status: ${market.active ? "Active" : "Inactive"}\n`;

        if (i < markets.length - 1) {
          response += "\n---\n\n";
        }
      }

      // Add helpful footer
      response +=
        "\n\n💡 *Want details about a specific market? Ask me about it by name or provide its condition_id!*";

      if (callback) {
        callback({
          text: response,
          success: true,
        });
      }

      return { text: response, success: true };
    } catch (error) {
      const errorMessage = `Error getting popular markets: ${error instanceof Error ? error.message : "Unknown error"}`;
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
