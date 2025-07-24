import {
  type Action,
  type ActionResult,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
} from '@elizaos/core';
import { 
  findMarketByName, 
  getMarketSuggestions, 
  formatMarketLookup, 
  extractMarketReference 
} from '../utils/marketLookup';
import { contentToActionResult, createErrorResult } from '../utils/actionHelpers';

/**
 * Get market details by name/description action
 * Allows users to get market info without knowing token IDs
 */
export const getMarketByNameAction: Action = {
  name: 'GET_MARKET_BY_NAME',
  similes: [
    'MARKET_DETAILS',
    'MARKET_INFO',
    'TELL_ME_ABOUT',
    'DETAILS_ON',
    'MORE_INFO',
    'MARKET_LOOKUP',
    'FIND_MARKET',
    'SEARCH_MARKET',
    'WHAT_IS',
    'EXPLAIN_MARKET',
    'SHOW_MARKET',
    'MARKET_DATA',
    'GET_INFO_ON',
    'DETAILS_ABOUT',
    'MORE_DETAILS_ON',
  ],
  description: 'Get market details by name, question, or description without needing token IDs',

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    logger.info(`[getMarketByNameAction] Validate called for message: "${message.content?.text}"`);

    const messageText = message.content?.text?.toLowerCase() || '';
    
    // Check if message contains market inquiry patterns
    const hasMarketKeywords = /\b(market|details|info|about|on|tell me|explain|what is)\b/.test(messageText);
    const hasQuestionPattern = /\?/.test(messageText);
    const hasDetailsRequest = /\b(details?|info|information|more|explain|tell)\b/.test(messageText);

    if (hasMarketKeywords || hasQuestionPattern || hasDetailsRequest) {
      logger.info('[getMarketByNameAction] Validation passed - market inquiry detected');
      return true;
    }

    logger.info('[getMarketByNameAction] Validation failed - no market inquiry pattern');
    return false;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    logger.info('[getMarketByNameAction] Handler called!');

    const messageText = message.content?.text || '';
    
    try {
      // Extract market reference from user message
      const marketRef = extractMarketReference(messageText);
      
      if (!marketRef) {
        const errorContent: Content = {
          text: `❌ **Could not identify market from your request**

Please be more specific about which market you'd like details on. Examples:
• "Tell me about the Macron market"
• "Details on Trump 2024 election"
• "More info on Bitcoin price prediction"
• "What is the Chiefs vs Raiders market?"

You can also use: "show me open markets" to see available markets first.`,
          actions: ['POLYMARKET_GET_MARKET_BY_NAME'],
          data: { error: 'Market reference not found', originalMessage: messageText },
        };

        if (callback) {
          await callback(errorContent);
        }
        return createErrorResult('Could not extract market reference from message');
      }

      logger.info(`[getMarketByNameAction] Extracted market reference: "${marketRef}"`);

      // Search for the market
      const marketResult = await findMarketByName(runtime, marketRef);

      if (!marketResult) {
        // Try to get suggestions for similar markets
        const suggestions = await getMarketSuggestions(runtime, marketRef, 3);
        
        let suggestionText = '';
        if (suggestions.length > 0) {
          suggestionText = '\n\n**Similar markets found:**\n' + 
            suggestions.map((s, i) => `${i + 1}. ${s.market.question}`).join('\n');
        }

        const errorContent: Content = {
          text: `❌ **Market not found: "${marketRef}"**

I couldn't find an active market matching that description.${suggestionText}

**Try:**
• Use more specific keywords
• Check spelling of market name
• Use "show me open markets" to browse all available markets
• Try searching by category (e.g., "politics", "sports", "crypto")`,
          actions: ['POLYMARKET_GET_MARKET_BY_NAME'],
          data: { 
            error: 'Market not found', 
            searchTerm: marketRef,
            suggestions: suggestions.map(s => s.market.question),
          },
        };

        if (callback) {
          await callback(errorContent);
        }
        return createErrorResult(`Market not found: ${marketRef}`);
      }

      // Format market information for display
      const formattedInfo = formatMarketLookup(marketResult);
      
      const responseContent: Content = {
        text: formattedInfo,
        actions: ['POLYMARKET_GET_MARKET_BY_NAME'],
        data: {
          market: marketResult.market,
          tokens: marketResult.tokens,
          searchTerm: marketRef,
          timestamp: new Date().toISOString(),
        },
      };

      if (callback) {
        await callback(responseContent);
      }

      return contentToActionResult(responseContent);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error(`[getMarketByNameAction] Error:`, error);

      const errorContent: Content = {
        text: `❌ **Error getting market details**

**Error**: ${errorMessage}

This could be due to:
• Database connectivity issues
• Market data synchronization problems
• Invalid search parameters

Please try again or use "show me open markets" to browse available markets.`,
        actions: ['POLYMARKET_GET_MARKET_BY_NAME'],
        data: {
          error: errorMessage,
          originalMessage: messageText,
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
        name: '{{user1}}',
        content: {
          text: 'Tell me about the Macron out in 2025 market',
        },
      },
      {
        name: '{{user2}}',
        content: {
          text: "I'll get the details for the Macron market including current prices and trading information...",
          action: 'POLYMARKET_GET_MARKET_BY_NAME',
        },
      },
    ],
    [
      {
        name: '{{user1}}',
        content: {
          text: 'Give me more details on: Trump election prediction',
        },
      },
      {
        name: '{{user2}}',
        content: {
          text: "Let me find the Trump election prediction market and show you the current details...",
          action: 'POLYMARKET_GET_MARKET_BY_NAME',
        },
      },
    ],
    [
      {
        name: '{{user1}}',
        content: {
          text: 'What is the Chiefs vs Raiders market?',
        },
      },
      {
        name: '{{user2}}',
        content: {
          text: "I'll explain the Chiefs vs Raiders prediction market and show you the current betting odds...",
          action: 'POLYMARKET_GET_MARKET_BY_NAME',
        },
      },
    ],
  ],
};