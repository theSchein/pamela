import type { Plugin } from '@elizaos/core';
import { logger } from '@elizaos/core';
import { z } from 'zod';

// Import the polymarket actions
import { getBestPriceAction } from '../plugin-polymarket/src/actions/getBestPrice.ts';
import { getMarketDetailsAction } from '../plugin-polymarket/src/actions/getMarketDetails.ts';
import { getSpreadAction } from '../plugin-polymarket/src/actions/getSpread.ts';
import { getMidpointPriceAction } from '../plugin-polymarket/src/actions/getMidpointPrice.ts';
import { retrieveAllMarketsAction } from '../plugin-polymarket/src/actions/retrieveAllMarkets.ts';
import { getSimplifiedMarketsAction } from '../plugin-polymarket/src/actions/getSimplifiedMarkets.ts';
import { placeOrderAction } from '../plugin-polymarket/src/actions/placeOrder.ts';

/**
 * Configuration schema for the prediction market trading agent
 */
const configSchema = z.object({
  POLYMARKET_API_KEY: z
    .string()
    .min(1, 'Polymarket API key is required')
    .optional(),
  POLYMARKET_PASSPHRASE: z
    .string()
    .min(1, 'Polymarket passphrase is required')
    .optional(),
  POLYMARKET_SECRET: z
    .string()
    .min(1, 'Polymarket secret is required')
    .optional(),
  POLYMARKET_PRIVATE_KEY: z
    .string()
    .min(1, 'Polymarket private key is required')
    .optional(),
  CLOB_API_URL: z
    .string()
    .url('CLOB API URL must be a valid URL')
    .optional()
    .default('https://clob.polymarket.com'),
  TRADING_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .optional()
    .default('true'),
  MAX_POSITION_SIZE: z
    .string()
    .transform((val) => parseFloat(val))
    .optional()
    .default('100'),
  MIN_CONFIDENCE_THRESHOLD: z
    .string()
    .transform((val) => parseFloat(val))
    .optional()
    .default('0.7'),
});

/**
 * Prediction Market Trading Agent Plugin
 * This plugin integrates with Polymarket for prediction market trading
 */
const predictionMarketPlugin: Plugin = {
  name: 'prediction-market-trader',
  description: 'A prediction market trading agent plugin that integrates with Polymarket',
  priority: 100,
  config: {
    POLYMARKET_API_KEY: process.env.POLYMARKET_API_KEY,
    POLYMARKET_PASSPHRASE: process.env.POLYMARKET_PASSPHRASE,
    POLYMARKET_SECRET: process.env.POLYMARKET_SECRET,
    POLYMARKET_PRIVATE_KEY: process.env.POLYMARKET_PRIVATE_KEY,
    CLOB_API_URL: process.env.CLOB_API_URL || 'https://clob.polymarket.com',
    TRADING_ENABLED: process.env.TRADING_ENABLED || 'false',
    MAX_POSITION_SIZE: process.env.MAX_POSITION_SIZE || '100',
    MIN_CONFIDENCE_THRESHOLD: process.env.MIN_CONFIDENCE_THRESHOLD || '0.7',
  },
  
  async init(config: Record<string, string>) {
    logger.info('*** Initializing Prediction Market Trading Agent ***');
    
    try {
      const validatedConfig = await configSchema.parseAsync(config);
      
      // Set environment variables
      for (const [key, value] of Object.entries(validatedConfig)) {
        if (value !== undefined) {
          process.env[key] = String(value);
        }
      }
      
      // Note: polymarket plugin will be initialized when used
      // We've set the environment variables, which is sufficient
      
      logger.info('Prediction Market Trading Agent initialized successfully');
      logger.info(`Trading enabled: ${validatedConfig.TRADING_ENABLED}`);
      logger.info(`Max position size: ${validatedConfig.MAX_POSITION_SIZE}`);
      logger.info(`Min confidence threshold: ${validatedConfig.MIN_CONFIDENCE_THRESHOLD}`);
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(
          `Invalid plugin configuration: ${error.errors.map((e) => e.message).join(', ')}`
        );
      }
      throw error;
    }
  },
  
  // Core polymarket actions for prediction market analysis and trading
  actions: [
    getBestPriceAction,
    getMarketDetailsAction, 
    getSpreadAction,
    getMidpointPriceAction,
    retrieveAllMarketsAction,
    getSimplifiedMarketsAction,
    placeOrderAction
  ],
  
  // Providers, services, routes, events, and models to be added as we integrate
  providers: [],
  services: [],
  routes: [],
  events: {},
  models: {},
};

export default predictionMarketPlugin;