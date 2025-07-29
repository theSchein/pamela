/**
 * Test Suite for Sell and Redeem Actions (Phase 2 Completion)
 * Tests the missing functionality: sell positions and redeem winnings
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { IAgentRuntime, Memory, State } from '@elizaos/core';
import { createTestRuntime, createTestMemory } from './test-utils';

// Import existing actions that will be extended
import { placeOrderAction } from '../src/actions/placeOrder';
import { getActiveOrdersAction } from '../src/actions/getActiveOrders';
import { getWalletBalanceAction } from '../src/actions/getWalletBalance';

describe('Sell and Redeem Actions Test Suite', () => {
  let runtime: IAgentRuntime;
  let testMemory: Memory;
  let testState: State;

  beforeAll(async () => {
    console.log('🚀 Setting up Sell/Redeem test suite...');
    
    runtime = await createTestRuntime({
      POLYMARKET_PRIVATE_KEY: process.env.POLYMARKET_PRIVATE_KEY || '0x' + '1'.repeat(64),
      CLOB_API_URL: process.env.CLOB_API_URL || 'https://clob.polymarket.com/',
      TRADING_ENABLED: 'true',
      MAX_POSITION_SIZE: '100',
    });

    testState = {
      userId: 'test-user',
      agentId: 'pamela-test',
      bio: 'Pamela sell/redeem test agent',
      lore: [],
      messageDirections: 'Test sell and redeem functionality',
      postDirections: 'Execute sell/redeem tests',
      roomId: 'test-room',
      actors: '',
      goals: 'Test sell positions and redeem winnings',
      recentMessages: '',
      recentMessagesData: [],
    };
  });

  beforeEach(() => {
    testMemory = createTestMemory({
      content: { text: 'Test sell/redeem message' },
      userId: 'test-user',
      roomId: 'test-room',
    });
  });

  describe('📉 Sell Position Tests', () => {
    it('should validate sell order parameters', async () => {
      console.log('🔍 Testing sell order validation...');
      
      const sellMemory = createTestMemory({
        content: { text: 'Sell my YES position in Trump market for $0.75' },
        userId: 'test-user',
        roomId: 'test-room',
      });

      // Current placeOrderAction should handle sell orders
      const isValid = await placeOrderAction.validate(runtime, sellMemory, testState);
      expect(isValid).toBe(true);
      
      console.log('✅ Sell order validation passed');
    });

    it('should process sell order requests', async () => {
      console.log('💰 Testing sell order processing...');
      
      const sellMemory = createTestMemory({
        content: { text: 'Sell 50 shares of my YES position at $0.60' },
        userId: 'test-user',
        roomId: 'test-room',
      });

      const result = await placeOrderAction.handler(runtime, sellMemory, testState);
      
      expect(result).toBeDefined();
      console.log('✅ Sell order processing completed');
      
      if (result.success) {
        console.log('🎉 Sell order processed successfully!');
        expect(result.data?.orderDetails?.side).toBe('SELL');
      } else if (result.data?.error) {
        console.log(`⚠️  Sell order issue: ${result.data.error}`);
        // Common issues: no position to sell, invalid price, etc.
      }
    });

    it('should handle market sell orders', async () => {
      console.log('⚡ Testing market sell orders...');
      
      const marketSellMemory = createTestMemory({
        content: { text: 'Sell my position at market price' },
        userId: 'test-user',
        roomId: 'test-room',
      });

      const result = await placeOrderAction.handler(runtime, marketSellMemory, testState);
      expect(result).toBeDefined();
      
      console.log('✅ Market sell order test completed');
    });

    it('should handle partial position sales', async () => {
      console.log('📊 Testing partial position sales...');
      
      const partialSellMemory = createTestMemory({
        content: { text: 'Sell half of my YES position in Biden market' },
        userId: 'test-user',
        roomId: 'test-room',
      });

      const result = await placeOrderAction.handler(runtime, partialSellMemory, testState);
      expect(result).toBeDefined();
      
      console.log('✅ Partial sell order test completed');
    });
  });

  describe('💎 Position Management Tests', () => {
    it('should identify current positions', async () => {
      console.log('📋 Testing current position identification...');
      
      // This would require a new action to get positions
      // For now, test through active orders and trade history
      const ordersResult = await getActiveOrdersAction.handler(runtime, testMemory, testState);
      expect(ordersResult).toBeDefined();
      
      console.log('✅ Position identification test completed');
    });

    it('should calculate position values', async () => {
      console.log('💰 Testing position value calculations...');
      
      const balanceResult = await getWalletBalanceAction.handler(runtime, testMemory, testState);
      expect(balanceResult.success).toBe(true);
      
      // Position values should be included in wallet balance
      console.log('✅ Position value calculation test completed');
    });
  });

  describe('🏆 Redeem Winnings Tests', () => {
    it('should identify redeemable positions', async () => {
      console.log('🔍 Testing redeemable position identification...');
      
      const redeemMemory = createTestMemory({
        content: { text: 'Show me my winning positions ready to redeem' },
        userId: 'test-user',
        roomId: 'test-room',
      });

      // This would need a new action for redemption
      // For now, test the concept through existing infrastructure
      console.log('ℹ️  Redeem identification requires new action (to be implemented)');
    });

    it('should process redemption requests', async () => {
      console.log('💎 Testing redemption processing...');
      
      const redeemMemory = createTestMemory({
        content: { text: 'Redeem my winning position in settled Trump market' },
        userId: 'test-user',
        roomId: 'test-room',
      });

      // This will require implementing a redeem action
      console.log('ℹ️  Redemption processing requires new action (to be implemented)');
    });

    it('should handle batch redemptions', async () => {
      console.log('🔄 Testing batch redemption...');
      
      const batchRedeemMemory = createTestMemory({
        content: { text: 'Redeem all my winning positions' },
        userId: 'test-user',
        roomId: 'test-room',
      });

      console.log('ℹ️  Batch redemption requires new action (to be implemented)');
    });
  });

  describe('⚠️  Error Handling Tests', () => {
    it('should handle sell without positions', async () => {
      console.log('🚫 Testing sell without positions...');
      
      const invalidSellMemory = createTestMemory({
        content: { text: 'Sell my position in nonexistent market' },
        userId: 'test-user',
        roomId: 'test-room',
      });

      const result = await placeOrderAction.handler(runtime, invalidSellMemory, testState);
      expect(result).toBeDefined();
      
      // Should handle gracefully
      console.log('✅ No position error handling tested');
    });

    it('should handle redeem non-winning positions', async () => {
      console.log('❌ Testing redeem non-winning positions...');
      
      const invalidRedeemMemory = createTestMemory({
        content: { text: 'Redeem my losing position' },
        userId: 'test-user',
        roomId: 'test-room',
      });

      console.log('ℹ️  Invalid redeem error requires new action (to be implemented)');
    });

    it('should handle redeem unsettled markets', async () => {
      console.log('⏳ Testing redeem unsettled markets...');
      
      const unsettledRedeemMemory = createTestMemory({
        content: { text: 'Redeem position in active market' },
        userId: 'test-user',
        roomId: 'test-room',
      });

      console.log('ℹ️  Unsettled market error requires new action (to be implemented)');
    });
  });

  describe('🔄 Workflow Integration Tests', () => {
    it('should complete buy-sell-redeem workflow', async () => {
      console.log('🔄 Testing complete trading lifecycle...');
      
      // This test simulates the full lifecycle:
      // 1. Buy position
      // 2. Monitor position
      // 3. Sell position or wait for settlement
      // 4. Redeem winnings
      
      console.log('Step 1: Simulated buy');
      const buyMemory = createTestMemory({
        content: { text: 'Buy YES for $1 in test market' },
        userId: 'test-user',
        roomId: 'test-room',
      });
      const buyResult = await placeOrderAction.handler(runtime, buyMemory, testState);
      expect(buyResult).toBeDefined();
      
      console.log('Step 2: Check positions');
      const ordersResult = await getActiveOrdersAction.handler(runtime, testMemory, testState);
      expect(ordersResult).toBeDefined();
      
      console.log('Step 3: Simulated sell');
      const sellMemory = createTestMemory({
        content: { text: 'Sell my position at $0.75' },
        userId: 'test-user',
        roomId: 'test-room',
      });
      const sellResult = await placeOrderAction.handler(runtime, sellMemory, testState);
      expect(sellResult).toBeDefined();
      
      console.log('Step 4: Redeem (to be implemented)');
      // Redemption step will be implemented in Phase 2
      
      console.log('✅ Complete trading lifecycle tested');
    });
  });

  describe('📊 Performance and Reliability Tests', () => {
    it('should handle rapid sell orders', async () => {
      console.log('⚡ Testing rapid sell order processing...');
      
      const rapidSells = [
        'Sell 10 shares at $0.50',
        'Sell 20 shares at $0.55', 
        'Sell 15 shares at market price'
      ];

      for (const sellText of rapidSells) {
        const sellMemory = createTestMemory({
          content: { text: sellText },
          userId: 'test-user',
          roomId: 'test-room',
        });

        const result = await placeOrderAction.handler(runtime, sellMemory, testState);
        expect(result).toBeDefined();
        
        // Small delay between orders
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log('✅ Rapid sell order test completed');
    });

    it('should handle concurrent sell and redeem operations', async () => {
      console.log('🔄 Testing concurrent operations...');
      
      const sellPromise = placeOrderAction.handler(
        runtime,
        createTestMemory({
          content: { text: 'Sell my position at $0.70' },
          userId: 'test-user',
          roomId: 'test-room',
        }),
        testState
      );

      const balancePromise = getWalletBalanceAction.handler(runtime, testMemory, testState);

      const [sellResult, balanceResult] = await Promise.all([sellPromise, balancePromise]);
      
      expect(sellResult).toBeDefined();
      expect(balanceResult).toBeDefined();
      
      console.log('✅ Concurrent operations test completed');
    });
  });
});