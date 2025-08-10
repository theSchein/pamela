import type { Plugin } from "@elizaos/core";
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
} from "@elizaos/core";
import { z } from "zod";

// CORE TRADING ACTIONS
import { getOrderBookSummaryAction } from "./actions/getOrderBookSummary";

// MARKET DATA ACTIONS
import { getSamplingMarkets } from "./actions/getSamplingMarkets";
import { searchMarketsAction } from "./actions/searchMarkets";
import { syncMarketsAction } from "./actions/syncMarkets";
import { showFavoriteMarketsAction } from "./actions/showFavoriteMarkets";
import { explainMarketAction } from "./actions/explainMarket";
import { getMarketDataAction } from "./actions/getMarketData";
import { getPriceHistory } from "./actions/getPriceHistory";
import { placeOrderAction } from "./actions/placeOrder";
import { getAccountAccessStatusAction } from "./actions/getAccountAccessStatus";
import { getWalletBalanceAction } from "./actions/getWalletBalance";
import { depositUSDCAction } from "./actions/depositUSDC";
import { getDepositAddressAction } from "./actions/getDepositAddress";
import { approveUSDCAction } from "./actions/approveUSDC";
import { setupTradingAction } from "./actions/setupTrading";
import { sellOrderAction } from "./actions/sellOrder";
import { getMarketPriceAction } from "./actions/getMarketPrice";
import { getPortfolioPositionsAction } from "./actions/getPortfolioPositions";
import { redeemWinningsAction } from "./actions/redeemWinnings";
import { polymarketSchema } from "./schema";
import { MarketSyncService } from "./services/MarketSyncService";
import { MarketDetailService } from "./services/MarketDetailService";
import { marketDataProvider } from "./providers/marketDataProvider";

/**
 * Define the configuration schema for the Polymarket plugin
 */
const configSchema = z.object({
  CLOB_API_URL: z
    .string()
    .url("CLOB API URL must be a valid URL")
    .optional()
    .default("https://clob.polymarket.com")
    .transform((val) => {
      if (!val) {
        console.warn("Warning: CLOB_API_URL not provided, using default");
      }
      return val;
    }),
  WALLET_PRIVATE_KEY: z
    .string()
    .min(1, "Wallet private key cannot be empty")
    .optional()
    .transform((val) => {
      if (!val) {
        console.warn(
          "Warning: WALLET_PRIVATE_KEY not provided, trading features will be disabled",
        );
      }
      return val;
    }),
  PRIVATE_KEY: z
    .string()
    .min(1, "Private key cannot be empty")
    .optional()
    .transform((val) => {
      if (!val) {
        console.warn(
          "Warning: PRIVATE_KEY not provided, will use WALLET_PRIVATE_KEY instead",
        );
      }
      return val;
    }),
  CLOB_API_KEY: z
    .string()
    .min(1, "CLOB API key cannot be empty")
    .optional()
    .transform((val) => {
      if (!val) {
        console.warn(
          "Warning: CLOB_API_KEY not provided, using wallet-based authentication",
        );
      }
      return val;
    }),
  POLYMARKET_PRIVATE_KEY: z
    .string()
    .min(1, "Private key cannot be empty")
    .optional()
    .transform((val) => {
      if (!val) {
        console.warn(
          "Warning: POLYMARKET_PRIVATE_KEY not provided, will use WALLET_PRIVATE_KEY instead",
        );
      }
      return val;
    }),
});

/**
 * Polymarket Service for managing CLOB connections and state
 */
export class PolymarketService extends Service {
  static serviceType = "polymarket";
  capabilityDescription =
    "This service provides access to Polymarket prediction markets through the CLOB API.";

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  static async start(runtime: IAgentRuntime) {
    logger.info("*** Starting Polymarket service ***");
    const service = new PolymarketService(runtime);
    return service;
  }

  static async stop(runtime: IAgentRuntime) {
    logger.info("*** Stopping Polymarket service ***");
    const service = runtime.getService(PolymarketService.serviceType);
    if (!service) {
      throw new Error("Polymarket service not found");
    }
    service.stop();
  }

  async stop() {
    logger.info("*** Stopping Polymarket service instance ***");
  }
}

/**
 * Example provider for Polymarket market data
 */
const polymarketProvider: Provider = {
  name: "POLYMARKET_PROVIDER",
  description: "Provides current Polymarket market information and context",

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<ProviderResult> => {
    try {
      const clobApiUrl =
        runtime.getSetting("CLOB_API_URL") || "https://clob.polymarket.com";

      return {
        text: `Connected to Polymarket CLOB at ${clobApiUrl}. Ready to fetch market data and execute trades.`,
        values: {
          clobApiUrl,
          serviceStatus: "active",
          featuresAvailable: ["market_data", "price_feeds", "order_book"],
        },
        data: {
          timestamp: new Date().toISOString(),
          service: "polymarket",
        },
      };
    } catch (error) {
      logger.error("Error in Polymarket provider:", error);
      return {
        text: "Polymarket service is currently unavailable.",
        values: {
          serviceStatus: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        },
        data: {
          timestamp: new Date().toISOString(),
          service: "polymarket",
        },
      };
    }
  },
};

const plugin: Plugin = {
  name: "polymarket",
  description: "A plugin for interacting with Polymarket prediction markets",
  schema: polymarketSchema,
  config: {
    CLOB_API_URL: process.env.CLOB_API_URL,
    WALLET_PRIVATE_KEY: process.env.WALLET_PRIVATE_KEY,
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    CLOB_API_KEY: process.env.CLOB_API_KEY,
    POLYMARKET_PRIVATE_KEY: process.env.POLYMARKET_PRIVATE_KEY,
  },
  async init(config: Record<string, string>) {
    logger.info("*** Initializing Polymarket plugin ***");
    try {
      const validatedConfig = await configSchema.parseAsync(config);

      // Set all environment variables at once
      for (const [key, value] of Object.entries(validatedConfig)) {
        if (value) process.env[key] = value;
      }

      logger.info("Polymarket plugin initialized successfully");
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(
          `Invalid Polymarket plugin configuration: ${error.errors.map((e) => e.message).join(", ")}`,
        );
      }
      throw error;
    }
  },
  services: [PolymarketService, MarketSyncService, MarketDetailService],
  actions: [
    // === STREAMLINED TRADING ACTIONS ===

    // Setup & Management
    setupTradingAction, // Complete trading setup (approvals + credentials)
    approveUSDCAction, // Legacy USDC approval (kept for compatibility)
    getWalletBalanceAction, // Balance checking
    getPortfolioPositionsAction, // Portfolio positions and holdings

    // Core Trading
    placeOrderAction, // Buy orders (enhanced with market lookup)
    sellOrderAction, // Sell orders (now works with derived L2 credentials)
    redeemWinningsAction, // Redeem winnings from resolved markets
    // sellInfoAction, // No longer needed - sell works now
    // cancelOrderAction, // Cancel orders - REQUIRES L2
    
    // Advanced/API Trading (not for general use)
    // directPlaceOrderAction, // Direct API buy orders (bypasses LLM) - DISABLED
    // directSellOrderAction, // Direct API sell orders (bypasses LLM) - DISABLED

    // Market Discovery & Data
    explainMarketAction, // Explain specific market with prices (HIGH PRIORITY)
    getMarketDataAction, // Get market data by condition ID
    showFavoriteMarketsAction, // Show favorite markets with commentary
    searchMarketsAction, // Search for markets in database
    syncMarketsAction, // Manually sync markets from API
    getSamplingMarkets, // Active markets with rewards
    getOrderBookSummaryAction, // Order book data
    getMarketPriceAction, // Current prices and recommendations
    getPriceHistory, // Historical price data

    // Order Management (L2 Required - Disabled)
    // getOrderDetailsAction, // Order status - REQUIRES L2
    // getActiveOrdersAction, // Open orders - REQUIRES L2
    // getTradeHistoryAction, // Trade history - REQUIRES L2

    // Account Management (L2 Required - Disabled)
    // createApiKeyAction, // REQUIRES L2
    // revokeApiKeyAction, // REQUIRES L2
    // getAllApiKeysAction, // REQUIRES L2
    // checkOrderScoringAction, // REQUIRES L2
    getAccountAccessStatusAction, // Works with L1

    // Advanced Features
    depositUSDCAction, // USDC deposits
    getDepositAddressAction, // Deposit address info
    // handleAuthenticationAction, // L2 auth - DISABLED
    // setupWebsocketAction, // REQUIRES L2
    // handleRealtimeUpdatesAction, // REQUIRES L2
  ],
  providers: [polymarketProvider, marketDataProvider],
};

export default plugin;
