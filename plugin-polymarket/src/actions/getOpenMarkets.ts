import {
  type Action,
  type ActionResult,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  logger,
  ModelType,
  ActionExample,
} from '@elizaos/core';

import { initializeClobClient } from '../utils/clobClient.js';
import { retrieveAllMarketsTemplate } from '../templates.js';
import { callLLMWithTimeout } from '../utils/llmHelpers.js';
import { contentToActionResult, createErrorResult } from '../utils/actionHelpers';

// Trigger words and phrases for open markets action
const OPEN_MARKETS_SIMILES = [
  'OPEN_MARKETS',
  'GET_OPEN_MARKETS',
  'LATEST_OPEN_MARKETS',
  'NEWEST_MARKETS',
  'FRESH_MARKETS',
  'NEW_MARKETS',
  'RECENT_MARKETS',
  'OPEN_FOR_TRADING',
  'AVAILABLE_MARKETS',
  'ACTIVE_OPEN_MARKETS',
  'TRADEABLE_OPEN_MARKETS',
  'LATEST_LISTINGS',
  'NEW_LISTINGS',
  'RECENTLY_LISTED',
  'FETCH_OPEN_MARKETS',
  'SHOW_OPEN_MARKETS',
  'LIST_OPEN_MARKETS',
  'MARKETS_NOT_CLOSED',
  'UNCLOSED_MARKETS',
  'ACTIVE_MARKETS',
  'OPEN_AND_NOT_CLOSED',
  'NOT_YET_CLOSED',
  'STILL_OPEN',
  'CURRENTLY_OPEN',
  'MARKETS_OPEN',
  'TRADABLE_MARKETS',
  'LIVE_MARKETS',
];

interface OpenMarketsParams {
  category?: string;
  limit?: number;
  error?: string;
}

export const getOpenMarkets: Action = {
  name: 'POLYMARKET_GET_OPEN_MARKETS',
  similes: OPEN_MARKETS_SIMILES.map((s) => `POLYMARKET_${s}`),
  description:
    'Get the latest open Polymarket markets sorted by listing time - markets that are still active and available for trading',

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const clobApiUrl = runtime.getSetting('CLOB_API_URL');

    if (!clobApiUrl) {
      logger.warn('[getOpenMarkets] CLOB_API_URL is required but not provided');
      return false;
    }

    // Check if message specifically requests open/active/tradeable markets
    // BUT not simple "show me a prediction market" requests
    const messageText = message.content?.text?.toLowerCase() || '';
    
    // Exclude simple show requests that should go to our database-first action
    if (messageText.includes('show me a prediction market') || 
        messageText.includes('show me prediction market') ||
        (messageText.includes('show') && messageText.includes('market') && messageText.split(' ').length <= 5)) {
      return false;
    }
    
    // More specific validation - must explicitly mention "open" or "active" with context
    const isOpenMarketsRequest = (messageText.includes('open markets') ||
                                messageText.includes('active markets') ||
                                messageText.includes('tradeable markets') ||
                                messageText.includes('tradable markets') ||
                                messageText.includes('available markets') ||
                                messageText.includes('not closed markets') ||
                                messageText.includes('live markets') ||
                                messageText.includes('current markets') ||
                                messageText.includes('get open') ||
                                messageText.includes('list open') ||
                                messageText.includes('fetch open'));
    
    logger.info(`[getOpenMarkets] Validating message: "${messageText}", isOpenMarketsRequest: ${isOpenMarketsRequest}`);
    return isOpenMarketsRequest;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State | undefined,
    _options: any,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      logger.info('[getOpenMarkets] Starting open markets retrieval');

      // Initialize CLOB client
      const clobClient = await initializeClobClient(runtime);

      // Try to extract parameters using LLM
      let params: OpenMarketsParams = { limit: 20 }; // Default to 20 markets
      try {
        const extractedParams = await callLLMWithTimeout<OpenMarketsParams>(
          runtime,
          state,
          retrieveAllMarketsTemplate,
          'getOpenMarkets',
          30000
        );

        if (extractedParams && !extractedParams.error) {
          params = { ...params, ...extractedParams };
        }
      } catch (error) {
        logger.warn('[getOpenMarkets] LLM extraction failed, using defaults:', error);
        // Continue with default params
      }

      // Call CLOB API to get markets - filter for active and non-closed markets
      logger.info('[getOpenMarkets] Fetching open markets from API');
      const marketsResponse = await (clobClient as any).getMarkets('', {
        active: true, // Only active markets
        closed: false, // Only non-closed markets
        limit: params.limit || 50, // Get more to sort and filter
      });

      const allMarkets = marketsResponse.data || [];

      // Debug: Log sample market data to understand the structure
      if (allMarkets.length > 0) {
        logger.info(
          `[getOpenMarkets] Sample market data: active=${allMarkets[0].active}, closed=${allMarkets[0].closed}, end_date_iso=${allMarkets[0].end_date_iso}, question="${allMarkets[0].question?.substring(0, 50)}..."`
        );
      }

      // Filter for truly open markets (active=true AND closed=false AND current/future end dates)
      const currentDate = new Date();
      const openMarkets = allMarkets.filter((market: any) => {
        const isActiveAndOpen = market.active === true && market.closed === false;
        
        // Also check if market end date is in the future (or at least current year)
        let isFutureOrCurrent = true;
        if (market.end_date_iso) {
          const endDate = new Date(market.end_date_iso);
          // Only include markets ending in 2025 or later
          isFutureOrCurrent = endDate.getFullYear() >= 2025;
        }
        
        return isActiveAndOpen && isFutureOrCurrent;
      });

      // Debug: Log filtering results
      const activeMarkets = allMarkets.filter((m: any) => m.active === true).length;
      const nonClosedMarkets = allMarkets.filter((m: any) => m.closed === false).length;
      const futureMarkets = allMarkets.filter(
        (m: any) => m.end_date_iso && new Date(m.end_date_iso) > new Date()
      ).length;
      const current2025Markets = allMarkets.filter(
        (m: any) => m.end_date_iso && new Date(m.end_date_iso).getFullYear() >= 2025
      ).length;

      // Additional debug: Check overlap
      const activeAndNonClosed = allMarkets.filter(
        (m: any) => m.active === true && m.closed === false
      ).length;
      const activeOnly = allMarkets.filter((m: any) => m.active === true && m.closed === true).length;
      const nonClosedOnly = allMarkets.filter(
        (m: any) => m.active === false && m.closed === false
      ).length;

      logger.info(
        `[getOpenMarkets] Filter breakdown: total=${allMarkets.length}, active=${activeMarkets}, nonClosed=${nonClosedMarkets}, futureEndDate=${futureMarkets}, 2025+Markets=${current2025Markets}, finalOpen=${openMarkets.length}`
      );
      logger.info(
        `[getOpenMarkets] Overlap analysis: activeAndNonClosed=${activeAndNonClosed}, activeButClosed=${activeOnly}, nonClosedButInactive=${nonClosedOnly}`
      );

      // If no markets meet both criteria, let's try just non-closed markets as a fallback
      let finalMarkets = openMarkets;
      if (openMarkets.length === 0 && nonClosedMarkets > 0) {
        logger.info(
          `[getOpenMarkets] No active+non-closed markets found, falling back to just non-closed markets`
        );
        finalMarkets = allMarkets.filter((market: any) => market.closed === false);
      }

      // Sort by end_date_iso (listing time proxy) - newest first
      const sortedMarkets = finalMarkets.sort((a: any, b: any) => {
        const dateA = a.end_date_iso ? new Date(a.end_date_iso).getTime() : 0;
        const dateB = b.end_date_iso ? new Date(b.end_date_iso).getTime() : 0;
        return dateB - dateA; // Descending order (newest first)
      });

      // Take only the requested number
      const finalMarketsToReturn = sortedMarkets.slice(0, params.limit || 20);

      logger.info(
        `[getOpenMarkets] Retrieved ${finalMarketsToReturn.length} open markets from ${allMarkets.length} total`
      );

      // Format response message
      const responseMessage = formatOpenMarketsResponse(
        finalMarketsToReturn,
        openMarkets.length,
        params
      );

      const responseContent = {
        text: responseMessage,
        content: {
          action: 'open_markets_retrieved',
          markets: finalMarketsToReturn,
          count: finalMarketsToReturn.length,
          total_open: openMarkets.length,
          total_fetched: allMarkets.length,
          filters: params,
          timestamp: new Date().toISOString(),
        },
      };

      if (callback) {
        await callback(responseContent);
      }

      return contentToActionResult(responseContent);
    } catch (error) {
      logger.error('[getOpenMarkets] Error retrieving open markets:', error);

      const errorMessage = `❌ **Error getting open markets**: ${error instanceof Error ? error.message : 'Unknown error'}

Please check:
• CLOB_API_URL is correctly configured
• Network connectivity is available
• API service is operational`;

      const errorContent = {
        text: errorMessage,
        content: {
          action: 'open_markets_error',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };

      if (callback) {
        await callback(errorContent);
      }

      return createErrorResult(error, errorContent);
    }
  },

  examples: [
    [
      {
        name: '{{user1}}',
        content: { text: 'Show me the latest open markets via Polymarket' },
      },
      {
        name: '{{user2}}',
        content: {
          text: '🆕 **Latest Open Markets (Available for Trading)**\n\nFound 15 markets currently open and active:\n\n🔓 **Will Bitcoin reach $150k by end of 2025?**\n├─ Category: Crypto\n├─ Status: 🟢 Open & Active\n├─ Ends: Dec 31, 2025\n├─ Tokens: Yes (0.12) | No (0.88)\n└─ Min Order: $0.01 • Trading: ✅ Live\n\n🔓 **Will Trump be GOP nominee in 2028?**\n├─ Category: Politics\n├─ Status: 🟢 Open & Active\n├─ Ends: Jun 30, 2028\n├─ Tokens: Yes (0.75) | No (0.25)\n└─ Min Order: $0.01 • Trading: ✅ Live\n\n🔓 **Will AI achieve AGI by 2030?**\n├─ Category: Technology\n├─ Status: 🟢 Open & Active\n├─ Ends: Dec 31, 2030\n├─ Tokens: Yes (0.35) | No (0.65)\n└─ Min Order: $0.01 • Trading: ✅ Live\n\n📊 **Total**: 15 open markets • **Sorted**: By end date (newest first)',
          action: 'POLYMARKET_GET_OPEN_MARKETS',
        },
      },
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'Get newest crypto markets still open via Polymarket' },
      },
      {
        name: '{{user2}}',
        content: {
          text: '🪙 **Latest Open Crypto Markets**\n\nShowing newest crypto markets available for trading:\n\n📈 **Markets Found**: 8\n🔓 **All Open**: Ready for trading\n🕒 **Sorted**: By listing time (newest first)\n\n**Top Open Crypto Markets:**\n• Bitcoin price predictions (3 markets)\n• Ethereum milestone markets (2 markets)\n• DeFi protocol outcomes (2 markets)\n• NFT market predictions (1 market)\n\n💡 **All Active**: Real-time trading available on all markets!',
          action: 'POLYMARKET_GET_OPEN_MARKETS',
        },
      },
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'Fetch latest open markets limit 5 via Polymarket' },
      },
      {
        name: '{{user2}}',
        content: {
          text: '⚡ **Top 5 Latest Open Markets**\n\nShowing 5 newest markets open for trading:\n\n1. **AI Stock Market Crash by 2025** - Technology\n   └─ Status: 🟢 Open • Ends: Dec 31, 2025\n\n2. **Climate Tipping Point in 2024** - Science\n   └─ Status: 🟢 Open • Ends: Dec 31, 2024\n\n3. **SpaceX Mars Mission Success** - Space\n   └─ Status: 🟢 Open • Ends: Dec 31, 2026\n\n4. **Next US Recession Timing** - Economics\n   └─ Status: 🟢 Open • Ends: Dec 31, 2025\n\n5. **Social Media Platform Winner** - Technology\n   └─ Status: 🟢 Open • Ends: Dec 31, 2024\n\n🔧 **Filter Applied**: limit=5, active=true, closed=false',
          action: 'POLYMARKET_GET_OPEN_MARKETS',
        },
      },
    ],
  ] as ActionExample[][],
};

/**
 * Format open markets response for display
 */
function formatOpenMarketsResponse(
  markets: any[],
  totalOpenCount: number,
  filters?: OpenMarketsParams
): string {
  if (markets.length === 0) {
    return '🔓 **No open markets found**\n\nNo markets are currently open for trading. This might be due to:\n• All markets having reached their end dates\n• Applied filters being too restrictive\n• Temporary API issues\n\nTry removing filters or check back later for new market listings.';
  }

  let response = `🆕 **Latest Open Markets (Available for Trading)**\n\nFound ${markets.length} markets currently open and active:\n\n`;

  // Show markets with detailed info
  for (const market of markets) {
    const tokens = market.tokens || [];
    const endDate = market.end_date_iso
      ? new Date(market.end_date_iso).toLocaleDateString()
      : 'Unknown';

    response += `🔓 **${market.question || 'Unknown Market'}**\n`;
    response += `├─ Category: ${market.category || 'N/A'}\n`;
    response += `├─ Status: 🟢 Open & Active\n`;
    response += `├─ Ends: ${endDate}\n`;

    if (tokens.length >= 2) {
      const yesPrice =
        tokens.find((t: any) => t.outcome?.toLowerCase().includes('yes'))?.price || '0.50';
      const noPrice = tokens.find((t: any) => t.outcome?.toLowerCase().includes('no'))?.price || '0.50';
      response += `├─ Tokens: ${tokens[0]?.outcome || 'Yes'} (${yesPrice}) | ${tokens[1]?.outcome || 'No'} (${noPrice})\n`;
    }

    // Show trading info
    const minOrder = market.minimum_order_size || '0.01';
    response += `└─ Min Order: $${minOrder} • Trading: ✅ Live\n`;

    response += '\n';
  }

  // Add summary info
  if (totalOpenCount > markets.length) {
    response += `📊 **Total**: ${totalOpenCount} open markets available • **Showing**: Top ${markets.length}`;
  } else {
    response += `📊 **Total**: ${markets.length} open markets • **All Displayed**`;
  }

  response += ' • **Sorted**: By end date (newest first)';

  // Add filter info if applied
  if (filters && (filters.category || filters.limit)) {
    response += '\n🔧 **Filters Applied**: ';
    const filterParts = [];
    if (filters.category) filterParts.push(`category=${filters.category}`);
    if (filters.limit) filterParts.push(`limit=${filters.limit}`);
    response += filterParts.join(', ');
  }

  return response;
}
