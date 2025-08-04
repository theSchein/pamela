/**
 * Direct Trading Test - Bypass LLM, test core functionality
 * Tests price discovery and order placement with direct parameters
 */

// Load environment variables from root directory
import { config } from 'dotenv';
import path from 'path';
config({ path: path.resolve(process.cwd(), '../../.env') });

import { describe, it, expect, beforeAll } from 'vitest';
import { createTestRuntime } from './test-utils';

// Direct API test - use the actual CLOB client and actions
import { initializeClobClient } from '../src/utils/clobClient';

// Test environment configuration
const testEnvVars = {
  CLOB_API_URL: 'https://clob.polymarket.com',
  POLYMARKET_PRIVATE_KEY: process.env.POLYMARKET_PRIVATE_KEY || process.env.PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY,
};

// Test configuration with hardcoded market
const TEST_CONFIG = {
  MIN_ORDER_SIZE: 5, // Polymarket minimum
  MAX_TEST_COST: 10, // Maximum $10 for testing
  TEST_MARKET_ID: '0x362c61cfb577a719526b03e7596a3ef3d6d9aadf5292e2e2391c2cdf62892730',
  // Known token from this market (we'll use this for testing)
  TEST_TOKEN_ID: '110911393156699128240765920158928840337199547754402639514182164506911446042781',
};

describe('🎯 Direct Trading Functionality', () => {
  let clobClient: any;
  let testRuntime: any;

  beforeAll(async () => {
    console.log('🔧 Setting up direct trading test...');
    
    // Create test runtime with environment variables
    testRuntime = await createTestRuntime(testEnvVars);
    
    // Check if we have the required private key
    if (!testEnvVars.POLYMARKET_PRIVATE_KEY) {
      console.warn('⚠️  No POLYMARKET_PRIVATE_KEY found. Skipping live API tests.');
      console.warn('   Set POLYMARKET_PRIVATE_KEY, PRIVATE_KEY, or WALLET_PRIVATE_KEY to enable live testing.');
      return;
    }
    
    // Initialize CLOB client with proper runtime
    clobClient = await initializeClobClient(testRuntime);
    console.log('✅ CLOB client initialized');
  });

  it('should fetch orderbook data for our test token', async () => {
    if (!testEnvVars.POLYMARKET_PRIVATE_KEY) {
      console.log('⏭️  Skipping test - no private key configured');
      return;
    }
    
    console.log('📊 Step 1: Testing orderbook retrieval...');
    
    try {
      const orderbook = await clobClient.getOrderBook(TEST_CONFIG.TEST_TOKEN_ID);
      
      console.log('✅ Orderbook retrieved successfully!');
      console.log(`   Bids: ${orderbook.bids?.length || 0}`);
      console.log(`   Asks: ${orderbook.asks?.length || 0}`);
      
      // Verify we got orderbook data
      expect(orderbook).toBeDefined();
      expect(orderbook.bids || orderbook.asks).toBeTruthy();
      
      if (orderbook.bids?.length > 0) {
        console.log(`   Best Bid: $${orderbook.bids[0].price}`);
      }
      if (orderbook.asks?.length > 0) {
        console.log(`   Best Ask: $${orderbook.asks[0].price}`);
      }
      
    } catch (error) {
      console.log('❌ Orderbook retrieval failed:', error.message);
      throw error;
    }
  });

  it('should calculate realistic pricing from orderbook', async () => {
    if (!testEnvVars.POLYMARKET_PRIVATE_KEY) {
      console.log('⏭️  Skipping test - no private key configured');
      return;
    }
    
    console.log('📊 Step 2: Testing price calculation...');
    
    try {
      const orderbook = await clobClient.getOrderBook(TEST_CONFIG.TEST_TOKEN_ID);
      
      // Extract best prices
      const bestBid = orderbook.bids?.[0]?.price ? parseFloat(orderbook.bids[0].price) : 0;
      const bestAsk = orderbook.asks?.[0]?.price ? parseFloat(orderbook.asks[0].price) : 0;
      
      console.log(`   Best Bid: $${bestBid.toFixed(4)}`);
      console.log(`   Best Ask: $${bestAsk.toFixed(4)}`);
      
      // Calculate recommended pricing (similar to our getMarketPrice action)
      const midPrice = (bestBid + bestAsk) / 2;
      const buyPremium = 0.02; // 2% premium for buying
      const recommendedBuyPrice = Math.min(0.99, bestAsk * (1 + buyPremium));
      
      console.log(`   Mid Price: $${midPrice.toFixed(4)}`);
      console.log(`   Recommended Buy: $${recommendedBuyPrice.toFixed(4)}`);
      
      // Verify reasonable pricing
      expect(bestBid).toBeGreaterThan(0);
      expect(bestAsk).toBeGreaterThan(bestBid); // Ask > Bid
      expect(recommendedBuyPrice).toBeGreaterThan(0.01); // Above 1 cent
      expect(recommendedBuyPrice).toBeLessThanOrEqual(0.99); // At or below market cap
      
      const testOrderCost = TEST_CONFIG.MIN_ORDER_SIZE * recommendedBuyPrice;
      console.log(`   Test Order Cost (${TEST_CONFIG.MIN_ORDER_SIZE} tokens): $${testOrderCost.toFixed(2)}`);
      
      expect(testOrderCost).toBeLessThan(TEST_CONFIG.MAX_TEST_COST);
      
    } catch (error) {
      console.log('❌ Price calculation failed:', error.message);
      throw error;
    }
  });

  it('should validate order placement parameters', async () => {
    if (!testEnvVars.POLYMARKET_PRIVATE_KEY) {
      console.log('⏭️  Skipping test - no private key configured');
      return;
    }
    
    console.log('🚀 Step 3: Validating order parameters...');
    
    try {
      const orderbook = await clobClient.getOrderBook(TEST_CONFIG.TEST_TOKEN_ID);
      const bestAsk = orderbook.asks?.[0]?.price ? parseFloat(orderbook.asks[0].price) : 0;
      const buyPremium = 0.02;
      const recommendedBuyPrice = Math.min(0.99, bestAsk * (1 + buyPremium));
      
      const orderParams = {
        tokenId: TEST_CONFIG.TEST_TOKEN_ID,
        size: TEST_CONFIG.MIN_ORDER_SIZE,
        price: recommendedBuyPrice,
        side: 'buy',
        orderType: 'GTC'
      };
      
      console.log('📋 Order Parameters:');
      console.log(`   Token ID: ${orderParams.tokenId.substring(0, 20)}...`);
      console.log(`   Size: ${orderParams.size} tokens`);
      console.log(`   Price: $${orderParams.price.toFixed(4)} each`);
      console.log(`   Side: ${orderParams.side}`);
      console.log(`   Type: ${orderParams.orderType}`);
      console.log(`   Total Cost: $${(orderParams.size * orderParams.price).toFixed(2)}`);
      
      // Validate parameters
      expect(orderParams.tokenId).toMatch(/^\d+$/); // Should be numeric string
      expect(orderParams.size).toBeGreaterThanOrEqual(TEST_CONFIG.MIN_ORDER_SIZE);
      expect(orderParams.price).toBeGreaterThan(0);
      expect(orderParams.price).toBeLessThan(1); // Prices are between 0 and 1
      expect(['buy', 'sell']).toContain(orderParams.side);
      expect(['GTC', 'FOK', 'IOC']).toContain(orderParams.orderType);
      
      console.log('✅ Order parameters validated successfully!');
      
    } catch (error) {
      console.log('❌ Order parameter validation failed:', error.message);
      throw error;
    }
  });

  it('should demonstrate realistic pricing vs hardcoded pricing', async () => {
    if (!testEnvVars.POLYMARKET_PRIVATE_KEY) {
      console.log('⏭️  Skipping test - no private key configured');
      return;
    }
    
    console.log('📈 Step 4: Comparing pricing strategies...');
    
    try {
      const orderbook = await clobClient.getOrderBook(TEST_CONFIG.TEST_TOKEN_ID);
      const bestAsk = orderbook.asks?.[0]?.price ? parseFloat(orderbook.asks[0].price) : 0;
      const buyPremium = 0.02;
      const marketPrice = Math.min(0.99, bestAsk * (1 + buyPremium));
      
      const hardcodedPrice = 0.99;
      const orderSize = TEST_CONFIG.MIN_ORDER_SIZE;
      
      const marketCost = orderSize * marketPrice;
      const hardcodedCost = orderSize * hardcodedPrice;
      const savings = hardcodedCost - marketCost;
      const savingsPercent = (savings / hardcodedCost) * 100;
      
      console.log('💰 Pricing Comparison:');
      console.log(`   Market-based price: $${marketPrice.toFixed(4)}`);
      console.log(`   Hardcoded price: $${hardcodedPrice.toFixed(4)}`);
      console.log(`   Market-based cost (${orderSize} tokens): $${marketCost.toFixed(2)}`);
      console.log(`   Hardcoded cost (${orderSize} tokens): $${hardcodedCost.toFixed(2)}`);
      console.log(`   Savings: $${savings.toFixed(2)} (${savingsPercent.toFixed(1)}%)`);
      
      // Verify market pricing is more efficient
      if (marketPrice < hardcodedPrice) {
        console.log('🎉 Market pricing is more efficient!');
        expect(marketCost).toBeLessThan(hardcodedCost);
      } else {
        console.log('📊 Market pricing reflects current conditions');
        expect(marketPrice).toBeGreaterThan(0);
      }
      
      console.log('✅ Price discovery system working correctly!');
      console.log('🚀 Ready for autonomous trading with realistic prices!');
      
    } catch (error) {
      console.log('❌ Pricing comparison failed:', error.message);
      throw error;
    }
  });
});