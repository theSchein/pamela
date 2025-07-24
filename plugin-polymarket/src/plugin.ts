import type { Plugin } from '@elizaos/core';
import {
  type Action,
  type Content,
  type GenerateTextParams,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type Provider,
  type ProviderResult,
  Service,
  type State,
  logger,
} from '@elizaos/core';
import { z } from 'zod';
// REDUNDANT - commenting out overlapping market retrieval actions
// import { retrieveAllMarketsAction } from './actions/retrieveAllMarkets';
// import { getSimplifiedMarketsAction } from './actions/getSimplifiedMarkets';
// import { getClobMarkets } from './actions/getClobMarkets';
// import { getOpenMarkets } from './actions/getOpenMarkets';

// REDUNDANT - commenting out basic market details (superseded by enhanced)
// import { getMarketDetailsAction } from './actions/getMarketDetails';

// KEEP - essential order book data
import { getOrderBookSummaryAction } from './actions/getOrderBookSummary';

// REDUNDANT - commenting out duplicate order book and derived pricing
// import { getOrderBookDepthAction } from './actions/getOrderBookDepth';
// import { getBestPriceAction } from './actions/getBestPrice';
// import { getMidpointPriceAction } from './actions/getMidpointPrice';
// import { getSpreadAction } from './actions/getSpread';

// KEEP - specialized market sampling
import { getSamplingMarkets } from './actions/getSamplingMarkets';

// KEEP - price history is unique functionality
import { getPriceHistory } from './actions/getPriceHistory';
import { placeOrderAction } from './actions/placeOrder';
import { createApiKeyAction } from './actions/createApiKey';
import { revokeApiKeyAction } from './actions/revokeApiKey';
import { getAllApiKeysAction } from './actions/getAllApiKeys';
import { getOrderDetailsAction } from './actions/getOrderDetails';
import { checkOrderScoringAction } from './actions/checkOrderScoring';
import { getActiveOrdersAction } from './actions/getActiveOrders';
import { getAccountAccessStatusAction } from './actions/getAccountAccessStatus';
import { getTradeHistoryAction } from './actions/getTradeHistory';
import { handleAuthenticationAction } from './actions/handleAuthentication';
import { setupWebsocketAction } from './actions/setupWebsocket';
import { handleRealtimeUpdatesAction } from './actions/handleRealtimeUpdates';
import { getMarketDetailBySearchAction } from './actions/getMarketDetailBySearch';
import { getEnhancedMarketInfoAction } from './actions/getEnhancedMarketInfo';
import { getPopularMarketsAction } from './actions/getPopularMarkets';
import { getWalletBalanceAction } from './actions/getWalletBalance';
import { getMarketByNameAction } from './actions/getMarketByName';
// import { showPredictionMarketAction } from './actions/showPredictionMarket'; // REDUNDANT
import { polymarketSchema } from './schema';
import { MarketSyncService } from './services/MarketSyncService';
import { MarketDetailService } from './services/MarketDetailService';

/**
 * Define the configuration schema for the Polymarket plugin
 */
const configSchema = z.object({
  CLOB_API_URL: z
    .string()
    .url('CLOB API URL must be a valid URL')
    .optional()
    .default('https://clob.polymarket.com')
    .transform((val) => {
      if (!val) {
        console.warn('Warning: CLOB_API_URL not provided, using default');
      }
      return val;
    }),
  WALLET_PRIVATE_KEY: z
    .string()
    .min(1, 'Wallet private key cannot be empty')
    .optional()
    .transform((val) => {
      if (!val) {
        console.warn('Warning: WALLET_PRIVATE_KEY not provided, trading features will be disabled');
      }
      return val;
    }),
  PRIVATE_KEY: z
    .string()
    .min(1, 'Private key cannot be empty')
    .optional()
    .transform((val) => {
      if (!val) {
        console.warn('Warning: PRIVATE_KEY not provided, will use WALLET_PRIVATE_KEY instead');
      }
      return val;
    }),
  CLOB_API_KEY: z
    .string()
    .min(1, 'CLOB API key cannot be empty')
    .optional()
    .transform((val) => {
      if (!val) {
        console.warn('Warning: CLOB_API_KEY not provided, using wallet-based authentication');
      }
      return val;
    }),
  POLYMARKET_PRIVATE_KEY: z
    .string()
    .min(1, 'Private key cannot be empty')
    .optional()
    .transform((val) => {
      if (!val) {
        console.warn(
          'Warning: POLYMARKET_PRIVATE_KEY not provided, will use WALLET_PRIVATE_KEY instead'
        );
      }
      return val;
    }),
});

/**
 * Polymarket Service for managing CLOB connections and state
 */
export class PolymarketService extends Service {
  static serviceType = 'polymarket';
  capabilityDescription =
    'This service provides access to Polymarket prediction markets through the CLOB API.';

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  static async start(runtime: IAgentRuntime) {
    logger.info('*** Starting Polymarket service ***');
    const service = new PolymarketService(runtime);
    return service;
  }

  static async stop(runtime: IAgentRuntime) {
    logger.info('*** Stopping Polymarket service ***');
    const service = runtime.getService(PolymarketService.serviceType);
    if (!service) {
      throw new Error('Polymarket service not found');
    }
    service.stop();
  }

  async stop() {
    logger.info('*** Stopping Polymarket service instance ***');
  }
}

/**
 * Example provider for Polymarket market data
 */
const polymarketProvider: Provider = {
  name: 'POLYMARKET_PROVIDER',
  description: 'Provides current Polymarket market information and context',

  get: async (runtime: IAgentRuntime, message: Memory, state: State): Promise<ProviderResult> => {
    try {
      const clobApiUrl = runtime.getSetting('CLOB_API_URL') || 'https://clob.polymarket.com';

      return {
        text: `Connected to Polymarket CLOB at ${clobApiUrl}. Ready to fetch market data and execute trades.`,
        values: {
          clobApiUrl,
          serviceStatus: 'active',
          featuresAvailable: ['market_data', 'price_feeds', 'order_book'],
        },
        data: {
          timestamp: new Date().toISOString(),
          service: 'polymarket',
        },
      };
    } catch (error) {
      logger.error('Error in Polymarket provider:', error);
      return {
        text: 'Polymarket service is currently unavailable.',
        values: {
          serviceStatus: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        data: {
          timestamp: new Date().toISOString(),
          service: 'polymarket',
        },
      };
    }
  },
};

const plugin: Plugin = {
  name: 'polymarket',
  description: 'A plugin for interacting with Polymarket prediction markets',
  schema: polymarketSchema,
  config: {
    CLOB_API_URL: process.env.CLOB_API_URL,
    WALLET_PRIVATE_KEY: process.env.WALLET_PRIVATE_KEY,
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    CLOB_API_KEY: process.env.CLOB_API_KEY,
    POLYMARKET_PRIVATE_KEY: process.env.POLYMARKET_PRIVATE_KEY,
  },
  async init(config: Record<string, string>) {
    logger.info('*** Initializing Polymarket plugin ***');
    try {
      const validatedConfig = await configSchema.parseAsync(config);

      // Set all environment variables at once
      for (const [key, value] of Object.entries(validatedConfig)) {
        if (value) process.env[key] = value;
      }

      logger.info('Polymarket plugin initialized successfully');
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(
          `Invalid Polymarket plugin configuration: ${error.errors.map((e) => e.message).join(', ')}`
        );
      }
      throw error;
    }
  },
  services: [PolymarketService, MarketSyncService, MarketDetailService],
  actions: [
    // === CORE ACTIONS - SIMPLIFIED PLUGIN ===
    
    // Market Discovery (2 actions)
    getPopularMarketsAction,        // Fast database lookup
    getSamplingMarkets,            // Reward-enabled markets
    
    // Market Details (3 actions)  
    getEnhancedMarketInfoAction,   // Comprehensive market details
    getMarketDetailBySearchAction, // Search functionality
    getMarketByNameAction,         // Market lookup by name/description
    
    // Market Data (1 action)
    getOrderBookSummaryAction,     // Complete order book with pricing info
    
    // Trading (5 actions)
    placeOrderAction,              // Order placement
    getWalletBalanceAction,        // Balance checking
    getOrderDetailsAction,         // Order status  
    getActiveOrdersAction,         // Open orders
    getTradeHistoryAction,         // Trade history
    
    // === COMMENTED OUT - REDUNDANT ACTIONS ===
    
    // REDUNDANT: Market retrieval overlap
    // showPredictionMarketAction,     // REDUNDANT: superseded by enhanced market info
    // retrieveAllMarketsAction,       // REDUNDANT: overlaps with popular markets
    // getSimplifiedMarketsAction,     // REDUNDANT: optimization can be parameter-based
    // getClobMarkets,                 // REDUNDANT: nearly identical to retrieveAllMarkets
    // getOpenMarkets,                 // REDUNDANT: just filtered retrieveAllMarkets
    // getMarketDetailsAction,         // REDUNDANT: superseded by enhanced version
    
    // REDUNDANT: Order book and pricing overlap  
    // getOrderBookDepthAction,        // REDUNDANT: minimal difference from summary
    // getBestPriceAction,             // REDUNDANT: derivable from order book
    // getMidpointPriceAction,         // REDUNDANT: derivable from order book  
    // getSpreadAction,                // REDUNDANT: derivable from order book
    
    // Additional functionality (price history)
    getPriceHistory,               // Unique historical data functionality
    
    // Account management (keep essential ones)
    createApiKeyAction,
    revokeApiKeyAction, 
    getAllApiKeysAction,
    checkOrderScoringAction,
    getAccountAccessStatusAction,
    
    // WebSocket and real-time (advanced features)
    handleAuthenticationAction,
    setupWebsocketAction,
    handleRealtimeUpdatesAction,
  ],
  providers: [polymarketProvider],
};

export default plugin;
