/**
 * Get Enhanced Market Info Action
 * Gets detailed information about a specific market combining local and live data
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
import { z } from "zod";

export const getEnhancedMarketInfoAction: Action = {
  name: "GET_ENHANCED_MARKET_INFO",
  similes: [
    "get market details",
    "market info",
    "market details",
    "tell me about this market",
    "what is this market about",
    "market information",
    "detailed market info",
  ],
  description:
    "Get detailed information about a specific market by condition_id",
  examples: [
    [
      {
        name: "Human",
        content: {
          text: "Tell me about market 0x1234567890abcdef",
        },
      },
      {
        name: "Assistant",
        content: {
          text: "Let me get the detailed information for that market.",
          action: "GET_ENHANCED_MARKET_INFO",
        },
      },
    ],
    [
      {
        name: "Human",
        content: {
          text: "What is market condition_id abc123 about?",
        },
      },
      {
        name: "Assistant",
        content: {
          text: "Fetching enhanced market details...",
          action: "GET_ENHANCED_MARKET_INFO",
        },
      },
    ],
  ],
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    if (!message.content?.text) {
      return false;
    }

    const text = message.content.text.toLowerCase();

    // Check for market detail keywords and presence of condition_id
    const hasMarketKeywords = [
      "market details",
      "market info",
      "tell me about",
      "what is",
      "market information",
      "detailed info",
    ].some((keyword) => text.includes(keyword));

    // Look for condition_id patterns (hex strings)
    const hasConditionId = /0x[a-f0-9]{16,}|[a-f0-9]{32,}/i.test(text);

    return hasMarketKeywords && hasConditionId;
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

      // Extract condition_id from the message
      const conditionIdMatch = messageText.match(/(?:0x)?([a-f0-9]{32,})/i);

      if (!conditionIdMatch) {
        const errorMsg =
          'Please provide a valid condition_id (32+ character hex string). Example: "Tell me about market 0x1234567890abcdef..."';
        if (callback) {
          callback({
            text: errorMsg,
            success: false,
          });
        }
        return { text: errorMsg, success: false };
      }

      let conditionId = conditionIdMatch[1];

      // Add 0x prefix if not present
      if (!conditionId.startsWith("0x")) {
        conditionId = "0x" + conditionId;
      }

      elizaLogger.info(
        `Getting enhanced market info for condition_id: ${conditionId}`,
      );

      // Get enhanced market information
      const marketInfo =
        await marketDetailService.getEnhancedMarketInfo(conditionId);

      if (!marketInfo.localData && !marketInfo.liveData) {
        const noMarketMsg = `No market found with condition_id: ${conditionId}`;
        if (callback) {
          callback({
            text: noMarketMsg,
            success: true,
          });
        }
        return { text: noMarketMsg, success: true };
      }

      // Format comprehensive response
      const liveMarket = marketInfo.liveData;
      const localMarket = marketInfo.localData;
      let response = `**Market Information**\n\n`;

      // Basic market info - handle both Market and PolymarketMarket types
      const question =
        liveMarket?.question || localMarket?.question || "Unknown";
      const marketSlug =
        liveMarket?.market_slug || localMarket?.marketSlug || "Unknown";
      const category =
        liveMarket?.category || localMarket?.category || "Uncategorized";
      const active =
        liveMarket?.active !== undefined
          ? liveMarket.active
          : localMarket?.active;
      const closed =
        liveMarket?.closed !== undefined ? liveMarket.closed : false;

      response += `📋 **Question:** ${question}\n`;
      response += `🔗 **Market Slug:** ${marketSlug}\n`;
      response += `📊 **Category:** ${category}\n`;
      response += `🎯 **Condition ID:** ${conditionId}\n`;
      response += `✅ **Status:** ${active ? "Active" : "Inactive"}\n`;
      response += `🔒 **Closed:** ${closed ? "Yes" : "No"}\n`;

      // Dates
      const endDateIso = liveMarket?.end_date_iso || localMarket?.endDateIso;
      if (endDateIso) {
        const endDate = new Date(endDateIso);
        response += `📅 **End Date:** ${endDate.toLocaleDateString()} at ${endDate.toLocaleTimeString()}\n`;
      }

      const gameStartTime =
        liveMarket?.game_start_time || localMarket?.gameStartTime;
      if (gameStartTime) {
        const startTime = new Date(gameStartTime);
        response += `🕐 **Game Start:** ${startTime.toLocaleDateString()} at ${startTime.toLocaleTimeString()}\n`;
      }

      // Trading parameters
      const minOrderSize =
        liveMarket?.minimum_order_size || localMarket?.minimumOrderSize;
      if (minOrderSize) {
        response += `💰 **Min Order Size:** ${minOrderSize}\n`;
      }

      const minTickSize =
        liveMarket?.minimum_tick_size || localMarket?.minimumTickSize;
      if (minTickSize) {
        response += `📏 **Min Tick Size:** ${minTickSize}\n`;
      }

      // Tokens
      if (marketInfo.tokens && marketInfo.tokens.length > 0) {
        response += `\n**🪙 Tokens:**\n`;
        marketInfo.tokens.forEach((token) => {
          response += `- ${token.outcome}: ${token.tokenId}\n`;
        });
      }

      // Data freshness indicator
      if (marketInfo.liveData && marketInfo.localData) {
        response += `\n✨ *This includes live data from the Polymarket API*`;
      } else if (marketInfo.liveData) {
        response += `\n🔴 *Live data only (not in local database)*`;
      } else {
        response += `\n💾 *Local database data only*`;
      }

      if (callback) {
        callback({
          text: response,
          success: true,
        });
      }

      return { text: response, success: true };
    } catch (error) {
      const errorMessage = `Error getting market info: ${error instanceof Error ? error.message : "Unknown error"}`;
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
