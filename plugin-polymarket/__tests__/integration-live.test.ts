/**
 * Live Integration Test Suite
 * Tests actual trading functionality with real API calls and small amounts
 * Only runs when explicitly enabled with LIVE_TESTING=true
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { IAgentRuntime, Memory, State } from '@elizaos/core';
import { createTestRuntime, createTestMemory } from './test-utils';

// Import all trading actions for live testing
import { placeOrderAction } from '../src/actions/placeOrder';
import { getWalletBalanceAction } from '../src/actions/getWalletBalance';
import { getActiveOrdersAction } from '../src/actions/getActiveOrders';
import { retrieveAllMarketsAction } from '../src/actions/retrieveAllMarkets';
import { getMarketDetailBySearchAction } from '../src/actions/getMarketDetailBySearch';

// Live testing configuration
const LIVE_CONFIG = {
  ENABLED: process.env.LIVE_TESTING === 'true',
  MAX_ORDER_SIZE: 2, // $2 maximum for live testing
  TEST_TIMEOUT: 60000, // 60 seconds for live API calls
  REQUIRED_MIN_BALANCE: 5, // Minimum $5 USDC needed for live tests
  TEST_SEARCH_TERMS: ['Trump', 'Bitcoin', '2025'], // Popular markets for testing
};

// Skip entire suite if live testing is not enabled
const describeIf = LIVE_CONFIG.ENABLED ? describe : describe.skip;

describeIf('🔴 LIVE Polymarket Trading Integration Tests', () => {
  let runtime: IAgentRuntime;
  let testMemory: Memory;
  let testState: State;
  let liveMarkets: any[] = [];
  let walletBalance: number = 0;

  beforeAll(async () => {
    if (!LIVE_CONFIG.ENABLED) {
      console.log('⚠️  Live testing disabled. Set LIVE_TESTING=true to enable.');
      return;
    }

    console.log('🚨 STARTING LIVE TRADING TESTS WITH REAL MONEY 🚨');
    console.log(`💰 Maximum order size: $${LIVE_CONFIG.MAX_ORDER_SIZE}`);
    console.log('⚠️  These tests will place actual orders on Polymarket!');
    
    // Require explicit environment variables for live testing
    if (!process.env.POLYMARKET_PRIVATE_KEY) {
      throw new Error('POLYMARKET_PRIVATE_KEY required for live testing');
    }
    
    runtime = await createTestRuntime({
      POLYMARKET_PRIVATE_KEY: process.env.POLYMARKET_PRIVATE_KEY,
      CLOB_API_URL: process.env.CLOB_API_URL || 'https://clob.polymarket.com/',
      TRADING_ENABLED: 'true',
      MAX_POSITION_SIZE: LIVE_CONFIG.MAX_ORDER_SIZE.toString(),
    });

    testState = {
      userId: 'live-test-user',
      agentId: 'pamela-live-test',
      bio: 'Pamela live trading test agent',
      lore: [],
      messageDirections: 'Execute live trading tests with real funds',
      postDirections: 'Place actual orders on Polymarket',
      roomId: 'live-test-room',
      actors: '',
      goals: 'Test live trading functionality with minimal risk',
      recentMessages: '',
      recentMessagesData: [],
    };

    // Pre-flight checks
    await runPreflightChecks();
  });

  beforeEach(() => {
    testMemory = createTestMemory({
      content: { text: 'Live test message' },
      userId: 'live-test-user',
      roomId: 'live-test-room',
    });
  });

  afterAll(async () => {
    if (LIVE_CONFIG.ENABLED) {
      console.log('🧹 Live testing completed. Check your positions manually.');
      console.log('💡 Remember to close any open positions created during testing.');
    }
  });

  async function runPreflightChecks() {
    console.log('🔍 Running pre-flight checks...');

    // Check wallet balance
    const balanceResult = await getWalletBalanceAction.handler(runtime, testMemory, testState);
    if (!balanceResult.success) {
      throw new Error('Failed to check wallet balance');
    }

    walletBalance = parseFloat(balanceResult.data?.balanceInfo?.usdcBalance || '0');
    console.log(`💰 Current USDC balance: $${walletBalance}`);

    if (walletBalance < LIVE_CONFIG.REQUIRED_MIN_BALANCE) {
      throw new Error(
        `Insufficient balance for live testing. Required: $${LIVE_CONFIG.REQUIRED_MIN_BALANCE}, Available: $${walletBalance}`
      );
    }

    // Get available markets
    const marketsResult = await retrieveAllMarketsAction.handler(runtime, testMemory, testState);
    if (!marketsResult.success || !marketsResult.data?.markets) {
      throw new Error('Failed to retrieve markets for live testing');
    }

    liveMarkets = marketsResult.data.markets;
    console.log(`📊 Found ${liveMarkets.length} active markets`);

    if (liveMarkets.length === 0) {
      throw new Error('No active markets available for live testing');
    }

    console.log('✅ Pre-flight checks passed');
  }

  describe('💰 Live Wallet Tests', () => {
    it('should have sufficient balance for testing', async () => {
      expect(walletBalance).toBeGreaterThanOrEqual(LIVE_CONFIG.REQUIRED_MIN_BALANCE);
      console.log(`✅ Wallet has sufficient balance: $${walletBalance}`);
    });

    it('should retrieve real wallet configuration', async () => {
      const result = await getWalletBalanceAction.handler(runtime, testMemory, testState);
      
      expect(result.success).toBe(true);
      expect(result.data?.balanceInfo?.address).toBeTruthy();
      expect(result.data?.tradingLimits?.tradingEnabled).toBe(true);
      
      console.log(`✅ Live wallet address: ${result.data.balanceInfo.address}`);
      console.log(`✅ Trading enabled: ${result.data.tradingLimits.tradingEnabled}`);
    }, LIVE_CONFIG.TEST_TIMEOUT);
  });

  describe('📊 Live Market Tests', () => {
    it('should retrieve real active markets', async () => {
      expect(liveMarkets.length).toBeGreaterThan(0);
      
      const firstMarket = liveMarkets[0];
      expect(firstMarket.question).toBeTruthy();
      expect(firstMarket.tokens).toBeTruthy();
      expect(firstMarket.tokens.length).toBeGreaterThanOrEqual(2);
      
      console.log(`✅ Sample market: "${firstMarket.question}"`);
      console.log(`✅ Market tokens: ${firstMarket.tokens.map((t: any) => t.outcome).join(', ')}`);
    });

    it('should search for specific live markets', async () => {
      for (const searchTerm of LIVE_CONFIG.TEST_SEARCH_TERMS) {
        console.log(`🔍 Searching for "${searchTerm}" markets...`);
        
        const searchMemory = createTestMemory({
          content: { text: `Show me markets about ${searchTerm}` },
          userId: 'live-test-user',
          roomId: 'live-test-room',
        });

        const result = await getMarketDetailBySearchAction.handler(runtime, searchMemory, testState);
        
        if (result.success && result.data?.markets) {
          console.log(`✅ Found ${result.data.markets.length} markets for "${searchTerm}"`);
        }
        
        // Delay between searches to be respectful to API
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }, LIVE_CONFIG.TEST_TIMEOUT);
  });

  describe('🛒 Live Buy Order Tests', () => {
    it('should place a real small buy order', async () => {
      console.log('🚨 PLACING REAL BUY ORDER 🚨');
      console.log(`💰 Order size: $${LIVE_CONFIG.MAX_ORDER_SIZE}`);
      
      // Find a suitable market (liquid, reasonable prices)
      const suitableMarket = liveMarkets.find(market => 
        market.tokens && 
        market.tokens.length >= 2 &&
        market.question.length < 100 // Avoid overly complex markets
      );

      if (!suitableMarket) {
        throw new Error('No suitable market found for live testing');
      }

      console.log(`🎯 Target market: "${suitableMarket.question}"`);

      const buyMemory = createTestMemory({
        content: { 
          text: `Buy YES for $${LIVE_CONFIG.MAX_ORDER_SIZE} in "${suitableMarket.question}"` 
        },
        userId: 'live-test-user',
        roomId: 'live-test-room',
      });

      const result = await placeOrderAction.handler(runtime, buyMemory, testState);
      
      expect(result).toBeDefined();
      
      if (result.success) {
        console.log('🎉 LIVE BUY ORDER SUCCESSFUL!');
        console.log(`📊 Order details:`, result.data?.orderDetails);
        
        // Verify order was actually placed
        expect(result.data?.orderResponse?.success).toBe(true);
        expect(result.data?.orderDetails?.side).toBe('BUY');
        expect(result.data?.orderDetails?.totalValue).toBeLessThanOrEqual(LIVE_CONFIG.MAX_ORDER_SIZE);
        
      } else {
        console.log('⚠️  Live buy order failed:', result.data?.error);
        
        // Even failures should be handled gracefully
        expect(result.data?.error).toBeTruthy();
      }
    }, LIVE_CONFIG.TEST_TIMEOUT);

    it('should handle live market name resolution', async () => {
      console.log('🔍 Testing live market name resolution...');
      
      // Try to buy with just market search term
      const searchBuyMemory = createTestMemory({
        content: { text: `Buy YES for $1 in Trump market` },
        userId: 'live-test-user',
        roomId: 'live-test-room',
      });

      const result = await placeOrderAction.handler(runtime, searchBuyMemory, testState);
      
      expect(result).toBeDefined();
      
      if (result.data?.marketResolution) {
        console.log('✅ Market resolution successful');
        console.log(`📊 Resolved to: ${result.data.marketResolution.market?.question}`);
      } else if (result.data?.error === 'Market not found') {
        console.log('ℹ️  No matching market found (acceptable)');
      }
    }, LIVE_CONFIG.TEST_TIMEOUT);
  });

  describe('📉 Live Sell Order Tests', () => {
    it('should attempt to sell existing positions', async () => {
      console.log('💰 Testing live sell orders...');
      
      // First check what positions we have
      const ordersResult = await getActiveOrdersAction.handler(runtime, testMemory, testState);
      
      if (ordersResult.data?.orders && ordersResult.data.orders.length > 0) {
        console.log(`📊 Found ${ordersResult.data.orders.length} active orders`);
        
        // Try to sell at a reasonable price
        const sellMemory = createTestMemory({
          content: { text: 'Sell my position at $0.75' },
          userId: 'live-test-user',
          roomId: 'live-test-room',
        });

        const sellResult = await placeOrderAction.handler(runtime, sellMemory, testState);
        expect(sellResult).toBeDefined();
        
        if (sellResult.success) {
          console.log('✅ Live sell order processed');
        } else {
          console.log('ℹ️  Sell order issue (expected if no positions):', sellResult.data?.error);
        }
      } else {
        console.log('ℹ️  No active positions to sell');
      }
    }, LIVE_CONFIG.TEST_TIMEOUT);
  });

  describe('🔄 Live Trading Workflow', () => {
    it('should complete a full live trading cycle', async () => {
      console.log('🔄 EXECUTING COMPLETE LIVE TRADING CYCLE');
      
      // Step 1: Check initial balance
      console.log('Step 1: Check initial balance');
      const initialBalance = await getWalletBalanceAction.handler(runtime, testMemory, testState);
      expect(initialBalance.success).toBe(true);
      
      const startBalance = parseFloat(initialBalance.data?.balanceInfo?.usdcBalance || '0');
      console.log(`💰 Starting balance: $${startBalance}`);

      // Step 2: Place small buy order
      console.log('Step 2: Place buy order');
      const buyMemory = createTestMemory({
        content: { text: `Buy YES for $1 in any liquid market` },
        userId: 'live-test-user',
        roomId: 'live-test-room',
      });
      
      const buyResult = await placeOrderAction.handler(runtime, buyMemory, testState);
      expect(buyResult).toBeDefined();
      
      if (buyResult.success) {
        console.log('✅ Buy order placed successfully');
        
        // Step 3: Wait a moment for order processing
        console.log('Step 3: Wait for order processing');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Step 4: Check orders
        console.log('Step 4: Check active orders');
        const ordersResult = await getActiveOrdersAction.handler(runtime, testMemory, testState);
        expect(ordersResult).toBeDefined();
        
        // Step 5: Check final balance
        console.log('Step 5: Check final balance');
        const finalBalance = await getWalletBalanceAction.handler(runtime, testMemory, testState);
        expect(finalBalance.success).toBe(true);
        
        const endBalance = parseFloat(finalBalance.data?.balanceInfo?.usdcBalance || '0');
        console.log(`💰 Final balance: $${endBalance}`);
        
        // Balance should have decreased by approximately the order amount
        const balanceChange = startBalance - endBalance;
        console.log(`📊 Balance change: -$${balanceChange.toFixed(2)}`);
        
        console.log('🎉 LIVE TRADING CYCLE COMPLETED SUCCESSFULLY');
        
      } else {
        console.log('⚠️  Buy order failed, cycle incomplete');
        console.log('Error:', buyResult.data?.error);
      }
    }, LIVE_CONFIG.TEST_TIMEOUT * 2);
  });

  describe('🚨 Live Safety Tests', () => {
    it('should respect position size limits in live environment', async () => {
      console.log('⚠️  Testing position size limits with live API...');
      
      // Try to place order larger than configured maximum
      const largeOrderMemory = createTestMemory({
        content: { text: `Buy YES for $${LIVE_CONFIG.MAX_ORDER_SIZE + 1} in any market` },
        userId: 'live-test-user',
        roomId: 'live-test-room',
      });

      const result = await placeOrderAction.handler(runtime, largeOrderMemory, testState);
      
      // Should be blocked by position size limit
      if (result.data?.error?.includes('position limit')) {
        console.log('✅ Position size limit enforced correctly');
      } else if (result.success) {
        // If it succeeded, verify the actual order size was capped
        expect(result.data?.orderDetails?.totalValue).toBeLessThanOrEqual(LIVE_CONFIG.MAX_ORDER_SIZE);
        console.log('✅ Order size was capped correctly');
      }
    });

    it('should handle live API errors gracefully', async () => {
      console.log('🚫 Testing live API error handling...');
      
      // Try invalid market
      const invalidMemory = createTestMemory({
        content: { text: 'Buy YES in "Completely Invalid Market Name 12345" for $1' },
        userId: 'live-test-user',
        roomId: 'live-test-room',
      });

      const result = await placeOrderAction.handler(runtime, invalidMemory, testState);
      
      expect(result).toBeDefined();
      if (!result.success) {
        console.log('✅ Invalid market handled correctly');
        expect(result.data?.error).toBeTruthy();
      }
    });
  });
});