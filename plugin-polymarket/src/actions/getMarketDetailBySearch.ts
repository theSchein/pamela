/**
 * Get Market Detail by Search Action
 * Allows users to search for markets and get detailed information
 */

import {
  type Action,
  type ActionResult,
  type IAgentRuntime,
  type Memory,
  type HandlerCallback,
  logger,
  elizaLogger,
} from '@elizaos/core';
import { MarketDetailService } from '../services/MarketDetailService';
import { z } from 'zod';

const searchRequestSchema = z.object({
  query: z.string().min(1, 'Search query cannot be empty'),
  limit: z.number().min(1).max(20).optional().default(5),
});

export const getMarketDetailBySearchAction: Action = {
  name: 'GET_MARKET_DETAIL_BY_SEARCH',
  similes: [
    'search markets',
    'find market',
    'look up market',
    'market search',
    'search polymarket',
    'find prediction market',
    'what markets are there about',
    'show me markets about',
  ],
  description: 'Search for prediction markets and get detailed information',
  examples: [
    [
      {
        name: 'Human',
        content: {
          text: 'What markets are there about the 2024 election?',
        },
      },
      {
        name: 'Assistant',
        content: {
          text: 'Let me search for 2024 election markets on Polymarket.',
          action: 'GET_MARKET_DETAIL_BY_SEARCH',
        },
      },
    ],
    [
      {
        name: 'Human',
        content: {
          text: 'Find markets about AI or artificial intelligence',
        },
      },
      {
        name: 'Assistant',
        content: {
          text: 'Searching for AI and artificial intelligence markets...',
          action: 'GET_MARKET_DETAIL_BY_SEARCH',
        },
      },
    ],
    [
      {
        name: 'Human',
        content: {
          text: 'Show me some crypto markets',
        },
      },
      {
        name: 'Assistant',
        content: {
          text: 'Let me find cryptocurrency-related prediction markets for you.',
          action: 'GET_MARKET_DETAIL_BY_SEARCH',
        },
      },
    ],
  ],
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    if (!message.content?.text) {
      return false;
    }

    const text = message.content.text.toLowerCase();
    
    // Check for search-related keywords
    const searchKeywords = [
      'search', 'find', 'look up', 'show me', 'what markets', 'markets about',
      'prediction market', 'polymarket', 'betting market'
    ];
    
    return searchKeywords.some(keyword => text.includes(keyword));
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: any,
    options: any,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      const marketDetailService = runtime.getService<MarketDetailService>('polymarket-market-detail');
      
      if (!marketDetailService) {
        const errorMessage = 'Market detail service not available';
        elizaLogger.error(errorMessage);
        if (callback) {
          callback({
            text: errorMessage,
            success: false,
          });
        }
        return { text: errorMessage, success: false };
      }

      const messageText = message.content?.text || '';
      
      // Extract search query from the message
      let searchQuery = messageText;
      
      // Remove common prefixes to extract the actual search term
      const prefixes = [
        'what markets are there about',
        'show me markets about',
        'find markets about',
        'search for markets about',
        'search markets',
        'find market',
        'look up market',
        'show me',
        'find',
        'search'
      ];
      
      for (const prefix of prefixes) {
        if (searchQuery.toLowerCase().includes(prefix)) {
          searchQuery = searchQuery.toLowerCase().replace(prefix, '').trim();
          break;
        }
      }

      // Remove question marks and clean up
      searchQuery = searchQuery.replace(/[?]/g, '').trim();

      if (!searchQuery) {
        const errorMsg = 'Please provide a search term. For example: "Find markets about AI" or "Show me election markets"';
        if (callback) {
          callback({
            text: errorMsg,
            success: false,
          });
        }
        return { text: errorMsg, success: false };
      }

      elizaLogger.info(`Searching for markets with query: "${searchQuery}"`);
      
      // Search for markets
      const markets = await marketDetailService.searchMarkets(searchQuery, 5);
      
      if (markets.length === 0) {
        const noResultsMsg = `No active markets found matching "${searchQuery}". Try a different search term.`;
        if (callback) {
          callback({
            text: noResultsMsg,
            success: true,
          });
        }
        return { text: noResultsMsg, success: true };
      }

      // Format response with market information
      let response = `Found ${markets.length} market${markets.length > 1 ? 's' : ''} matching "${searchQuery}":\n\n`;
      
      for (let i = 0; i < markets.length; i++) {
        const market = markets[i];
        const endDate = market.endDateIso ? new Date(market.endDateIso).toLocaleDateString() : 'No end date';
        const category = market.category || 'Uncategorized';
        
        response += `**${i + 1}. ${market.question}**\n`;
        response += `📊 Category: ${category}\n`;
        response += `📅 End Date: ${endDate}\n`;
        response += `🔗 Slug: ${market.marketSlug}\n`;
        
        if (i < markets.length - 1) {
          response += '\n---\n\n';
        }
      }

      if (callback) {
        callback({
          text: response,
          success: true,
        });
      }
      
      return { text: response, success: true };

    } catch (error) {
      const errorMessage = `Error searching markets: ${error instanceof Error ? error.message : 'Unknown error'}`;
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