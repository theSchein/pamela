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
import { getPriceHistory } from "./actions/getPriceHistory";
import { placeOrderAction } from "./actions/placeOrder";
import { createApiKeyAction } from "./actions/createApiKey";
import { revokeApiKeyAction } from "./actions/revokeApiKey";
import { getAllApiKeysAction } from "./actions/getAllApiKeys";
import { getOrderDetailsAction } from "./actions/getOrderDetails";
import { checkOrderScoringAction } from "./actions/checkOrderScoring";
import { getActiveOrdersAction } from "./actions/getActiveOrders";
import { getAccountAccessStatusAction } from "./actions/getAccountAccessStatus";
import { getTradeHistoryAction } from "./actions/getTradeHistory";
import { handleAuthenticationAction } from "./actions/handleAuthentication";
import { setupWebsocketAction } from "./actions/setupWebsocket";
import { handleRealtimeUpdatesAction } from "./actions/handleRealtimeUpdates";
import { getWalletBalanceAction } from "./actions/getWalletBalance";
import { depositUSDCAction } from "./actions/depositUSDC";
import { getDepositAddressAction } from "./actions/getDepositAddress";
import { approveUSDCAction } from "./actions/approveUSDC";
import { setupTradingAction } from "./actions/setupTrading";
import { sellOrderAction } from "./actions/sellOrder";
import { cancelOrderAction } from "./actions/cancelOrder";
import { getMarketPriceAction } from "./actions/getMarketPrice";
import { directPlaceOrderAction } from "./actions/directPlaceOrder";
import { directSellOrderAction } from "./actions/directSellOrder";
import { getPortfolioPositionsAction } from "./actions/getPortfolioPositions";
import { polymarketSchema } from "./schema";
import { MarketSyncService } from "./services/MarketSyncService";
import { MarketDetailService } from "./services/MarketDetailService";

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
    sellOrderAction, // Sell orders (new streamlined selling)
    directPlaceOrderAction, // Direct API buy orders (bypasses LLM)
    directSellOrderAction, // Direct API sell orders (bypasses LLM)
    cancelOrderAction, // Cancel orders

    // Market Discovery & Data
    getSamplingMarkets, // Active markets with rewards
    getOrderBookSummaryAction, // Order book data
    getMarketPriceAction, // Current prices and recommendations
    getPriceHistory, // Historical price data

    // Order Management
    getOrderDetailsAction, // Order status
    getActiveOrdersAction, // Open orders
    getTradeHistoryAction, // Trade history

    // Account Management
    createApiKeyAction,
    revokeApiKeyAction,
    getAllApiKeysAction,
    checkOrderScoringAction,
    getAccountAccessStatusAction,

    // Advanced Features
    depositUSDCAction, // USDC deposits
    getDepositAddressAction, // Deposit address info
    handleAuthenticationAction,
    setupWebsocketAction,
    handleRealtimeUpdatesAction,
  ],
  providers: [polymarketProvider],
};

export default plugin;
