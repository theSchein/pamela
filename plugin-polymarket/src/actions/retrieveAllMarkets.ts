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
import { initializeClobClient } from "../utils/clobClient";
import { retrieveAllMarketsTemplate } from "../templates";
import type { MarketFilters, Market } from "../types";
import {
  contentToActionResult,
  createErrorResult,
} from "../utils/actionHelpers";

/**
 * Retrieve all available markets action for Polymarket
 * Fetches the complete list of prediction markets from the CLOB
 */
export const retrieveAllMarketsAction: Action = {
  name: "POLYMARKET_GET_ALL_MARKETS",
  similes: [
    "LIST_MARKETS",
    "SHOW_MARKETS",
    "GET_MARKETS",
    "FETCH_MARKETS",
    "ALL_MARKETS",
    "AVAILABLE_MARKETS",
  ],
  description: "Retrieve all available prediction markets from Polymarket",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    const clobApiUrl = runtime.getSetting("CLOB_API_URL");

    if (!clobApiUrl) {
      logger.warn(
        "[retrieveAllMarketsAction] CLOB_API_URL is required but not provided",
      );
      return false;
    }

    // Only validate if message specifically asks for "all markets" or "complete list"
    const messageText = message.content?.text?.toLowerCase() || "";
    const isAllMarketsRequest =
      messageText.includes("all markets") ||
      messageText.includes("complete list") ||
      messageText.includes("every market") ||
      messageText.includes("full list");

    return isAllMarketsRequest;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    logger.info("[retrieveAllMarketsAction] Handler called!");

    const clobApiUrl = runtime.getSetting("CLOB_API_URL");

    if (!clobApiUrl) {
      const errorMessage = "CLOB_API_URL is required in configuration.";
      logger.error(
        `[retrieveAllMarketsAction] Configuration error: ${errorMessage}`,
      );
      const errorContent: Content = {
        text: errorMessage,
        actions: ["POLYMARKET_GET_ALL_MARKETS"],
        data: { error: errorMessage },
      };

      if (callback) {
        await callback(errorContent);
      }
      return createErrorResult(errorMessage);
    }

    let filterParams: MarketFilters = {};

    // Extract optional filter parameters using LLM
    try {
      const llmResult = await callLLMWithTimeout<
        MarketFilters & { error?: string }
      >(runtime, state, retrieveAllMarketsTemplate, "retrieveAllMarketsAction");

      if (llmResult?.error) {
        logger.info(
          "[retrieveAllMarketsAction] No specific filters requested, fetching all markets",
        );
        filterParams = {};
      } else {
        filterParams = {
          category: llmResult?.category,
          active: llmResult?.active,
          limit: llmResult?.limit,
        };
      }
    } catch (error) {
      logger.debug(
        "[retrieveAllMarketsAction] LLM parameter extraction failed, using defaults:",
        error,
      );
      filterParams = {};
    }

    try {
      // Initialize CLOB client
      const clobClient = await initializeClobClient(runtime);

      // Fetch markets with proper filtering for current markets
      const response = await (clobClient as any).getMarkets(
        filterParams?.next_cursor || "",
        {
          active: true, // Only active markets
          closed: false, // Only non-closed markets
          limit: filterParams?.limit || 50, // Default limit
        },
      );

      if (!response || !response.data) {
        return createErrorResult("Invalid response from CLOB API");
      }

      const allMarkets: Market[] = response.data;

      // Filter for active markets with good liquidity/volume for trading
      const currentDate = new Date();
      const markets = allMarkets.filter((market) => {
        // Basic active/open check
        const isActiveAndOpen =
          market.active === true && market.closed === false;

        // Check if market end date is in the future
        let isFutureMarket = true;
        if (market.end_date_iso) {
          const endDate = new Date(market.end_date_iso);
          isFutureMarket = endDate > currentDate;
        }

        // Check for reasonable liquidity/volume (indicates active trading)
        const hasLiquidity = market.liquidityNum && market.liquidityNum > 100; // At least $100 liquidity
        const hasVolume = market.volumeNum && market.volumeNum > 50; // At least $50 volume
        const hasTradingActivity = hasLiquidity || hasVolume;

        // Ensure market has tokens for trading
        const hasTokens = market.tokens && market.tokens.length >= 2;

        return (
          isActiveAndOpen && isFutureMarket && hasTradingActivity && hasTokens
        );
      });

      const marketCount = markets.length;
      logger.info(
        `[retrieveAllMarkets] Filtered from ${allMarkets.length} to ${marketCount} current markets`,
      );

      // Format response text
      let responseText = `📊 **Retrieved ${marketCount} Polymarket prediction markets**\n\n`;

      if (marketCount === 0) {
        responseText += "No markets found matching your criteria.";
      } else {
        // Show first few markets as preview
        const previewMarkets = markets.slice(0, 5);
        responseText += "**Sample Markets:**\n";

        previewMarkets.forEach((market: Market, index: number) => {
          responseText += `${index + 1}. **${market.question}**\n`;
          responseText += `   • Category: ${market.category || "N/A"}\n`;
          responseText += `   • Active: ${market.active ? "✅" : "❌"}\n`;
          responseText += `   • End Date: ${market.end_date_iso ? new Date(market.end_date_iso).toLocaleDateString() : "N/A"}\n\n`;
        });

        if (marketCount > 5) {
          responseText += `... and ${marketCount - 5} more markets\n\n`;
        }

        responseText += `**Summary:**\n`;
        responseText += `• Total Markets: ${marketCount}\n`;
        responseText += `• Data includes: question, category, tokens, rewards, and trading details\n`;

        if (response.next_cursor && response.next_cursor !== "LTE=") {
          responseText += `• More results available (paginated)\n`;
        }
      }

      const responseContent: Content = {
        text: responseText,
        actions: ["POLYMARKET_GET_ALL_MARKETS"],
        data: {
          markets,
          count: marketCount,
          total: response.count || marketCount,
          next_cursor: response.next_cursor,
          limit: response.limit,
          filters: filterParams,
        },
      };

      if (callback) {
        await callback(responseContent);
      }

      return contentToActionResult(responseContent);
    } catch (error) {
      logger.error("[retrieveAllMarketsAction] Error fetching markets:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error occurred while fetching markets";
      const errorContent: Content = {
        text: `❌ **Error retrieving markets**: ${errorMessage}

Please check:
• CLOB_API_URL is correctly configured
• Network connectivity is available
• Polymarket CLOB service is operational`,
        actions: ["POLYMARKET_GET_ALL_MARKETS"],
        data: {
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
      };

      if (callback) {
        await callback(errorContent);
      }
      return createErrorResult(error);
    }
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: {
          text: "Show me all available prediction markets via Polymarket",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll retrieve all available Polymarket prediction markets for you.",
          action: "POLYMARKET_GET_ALL_MARKETS",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "What markets can I trade on Polymarket?",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "Let me fetch the current list of available markets from Polymarket.",
          action: "POLYMARKET_GET_ALL_MARKETS",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "List all active prediction markets via Polymarket",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll get all the active prediction markets currently available via Polymarket.",
          action: "POLYMARKET_GET_ALL_MARKETS",
        },
      },
    ],
  ],
};
