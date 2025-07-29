/**
 * Core Trading Functionality Tests
 * Consolidated test suite for essential Polymarket plugin functionality
 */

// Load environment variables from root directory
import { config } from 'dotenv';
import path from 'path';
config({ path: path.resolve(process.cwd(), '../../.env') });

import { describe, it, expect, beforeAll } from 'vitest';
import type { IAgentRuntime } from '@elizaos/core';

// Core actions
import { setupTradingAction } from '../src/actions/setupTrading';
import { placeOrderAction } from '../src/actions/placeOrder';
import { sellOrderAction } from '../src/actions/sellOrder';
import { getWalletBalanceAction } from '../src/actions/getWalletBalance';
import { getSamplingMarkets } from '../src/actions/getSamplingMarkets';

// Test utilities
import { createTestRuntime } from './test-utils';
import { initializeClobClient } from '../src/utils/clobClient';

const TEST_CONFIG = {
  WALLET_ADDRESS: '0x516F82432606705cEf5fA86dD4Ff79DDe6b082C0',
  MIN_ORDER_SIZE: 5,
  TEST_TOKEN_ID: '110911393156699128240765920158928840337199547754402639514182164506911446042781',
};

describe('🚀 Core Trading Functionality', () => {
  let runtime: IAgentRuntime;
  let clobClient: any;

  beforeAll(async () => {
    console.log('🔧 Setting up core trading tests...');
    
    runtime = await createTestRuntime({
      POLYMARKET_PRIVATE_KEY: process.env.POLYMARKET_PRIVATE_KEY || '',
      WALLET_PRIVATE_KEY: process.env.WALLET_PRIVATE_KEY || '',
      CLOB_API_URL: process.env.CLOB_API_URL || 'https://clob.polymarket.com',
    });
    
    try {
      clobClient = await initializeClobClient(runtime);
      console.log('✅ CLOB client initialized');
    } catch (error) {
      console.log('⚠️  CLOB client init failed, some tests may be limited:', error.message);
    }
  });

  describe('Trading Setup', () => {
    it('should complete trading setup successfully', async () => {
      console.log('🛠️  Testing complete trading setup...');
      
      const mockMemory = {
        id: 'test-setup',
        userId: 'test-user',
        agentId: 'test-agent',
        content: { text: 'setup trading for polymarket' },
        roomId: 'test-room',
        createdAt: Date.now(),
      };

      const result = await setupTradingAction.handler(
        runtime,
        mockMemory,
        undefined,
        undefined,
        undefined
      );

      console.log('📊 Setup Result:');
      console.log(`   Success: ${result.success}`);
      console.log(`   Data Available: ${!!result.data}`);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      if (result.data && typeof result.data === 'object') {
        const setupData = result.data as any;
        console.log(`   Setup Status: ${JSON.stringify(setupData.setupStatus || {})}`);
      }
      
      console.log('✅ Trading setup completed');
    }, 30000);
  });

  describe('Market Discovery', () => {
    it('should fetch sampling markets successfully', async () => {
      console.log('📊 Testing market discovery...');
      
      const mockMemory = {
        id: 'test-markets',
        userId: 'test-user',
        agentId: 'test-agent',
        content: { text: 'show me active markets' },
        roomId: 'test-room',
        createdAt: Date.now(),
      };

      const result = await getSamplingMarkets.handler(
        runtime,
        mockMemory,
        undefined,
        undefined,
        undefined
      );

      console.log('📈 Markets Result:');
      console.log(`   Success: ${result.success}`);
      
      expect(result.success).toBe(true);
      
      if (result.data && typeof result.data === 'object') {
        const marketsData = result.data as any;
        console.log(`   Markets Found: ${marketsData.markets?.length || 0}`);
        
        if (marketsData.markets && marketsData.markets.length > 0) {
          console.log(`   Sample Market: ${marketsData.markets[0].question || 'N/A'}`);
        }
      }
      
      console.log('✅ Market discovery working');
    }, 15000);
  });

  describe('Balance Management', () => {
    it('should check wallet balance correctly', async () => {
      console.log('💰 Testing balance checking...');
      
      const mockMemory = {
        id: 'test-balance',
        userId: 'test-user',
        agentId: 'test-agent',
        content: { text: 'check my wallet balance' },
        roomId: 'test-room',
        createdAt: Date.now(),
      };

      const result = await getWalletBalanceAction.handler(
        runtime,
        mockMemory,
        undefined,
        undefined,
        undefined
      );

      console.log('💳 Balance Result:');
      console.log(`   Success: ${result.success}`);
      
      expect(result.success).toBe(true);
      
      if (result.data && typeof result.data === 'object') {
        const balanceData = result.data as any;
        console.log(`   USDC Balance: ${balanceData.balance || 'N/A'}`);
        console.log(`   Max Position: ${balanceData.maxPositionSize || 'N/A'}`);
      }
      
      console.log('✅ Balance checking working');
    }, 15000);
  });

  describe('Order Validation', () => {
    it('should validate buy order parameters', async () => {
      console.log('📝 Testing buy order validation...');
      
      // Test with valid parameters
      const validMemory = {
        id: 'test-buy-valid',
        userId: 'test-user',
        agentId: 'test-agent',
        content: { text: `buy 5 shares of token ${TEST_CONFIG.TEST_TOKEN_ID} at $0.15` },
        roomId: 'test-room',
        createdAt: Date.now(),
      };

      const isValid = await placeOrderAction.validate(runtime, validMemory, undefined);
      console.log(`   Valid Order Validation: ${isValid}`);
      expect(isValid).toBe(true);
      
      console.log('✅ Buy order validation working');
    });

    it('should validate sell order parameters', async () => {
      console.log('📝 Testing sell order validation...');
      
      const validMemory = {
        id: 'test-sell-valid',
        userId: 'test-user',
        agentId: 'test-agent',
        content: { text: `sell 10 shares of token ${TEST_CONFIG.TEST_TOKEN_ID} at $0.60` },
        roomId: 'test-room',
        createdAt: Date.now(),
      };

      const isValid = await sellOrderAction.validate(runtime, validMemory, undefined);
      console.log(`   Valid Sell Validation: ${isValid}`);
      expect(isValid).toBe(true);
      
      console.log('✅ Sell order validation working');
    });

    it('should handle invalid order parameters gracefully', async () => {
      console.log('❌ Testing invalid order handling...');
      
      const invalidMemory = {
        id: 'test-invalid',
        userId: 'test-user',
        agentId: 'test-agent',
        content: { text: 'i want to trade something' },
        roomId: 'test-room',
        createdAt: Date.now(),
      };

      // This should fail gracefully rather than crash
      try {
        const result = await placeOrderAction.handler(
          runtime,
          invalidMemory,
          undefined,
          undefined,
          undefined
        );
        
        console.log(`   Invalid Order Result: ${result.success}`);
        expect(result.success).toBe(false);
        
      } catch (error) {
        console.log(`   Invalid order handled with error: ${error.message}`);
        expect(error.message).toContain('parameters');
      }
      
      console.log('✅ Invalid order handling working');
    });
  });

  describe('Integration Flow', () => {
    it('should demonstrate complete trading workflow', async () => {
      console.log('🔄 Testing complete trading workflow...');
      
      // Step 1: Setup trading
      console.log('Step 1: Setup trading');
      const setupMemory = {
        id: 'workflow-setup',
        userId: 'test-user',
        agentId: 'test-agent',
        content: { text: 'prepare for trading' },
        roomId: 'test-room',
        createdAt: Date.now(),
      };

      const setupResult = await setupTradingAction.handler(
        runtime,
        setupMemory,
        undefined,
        undefined,
        undefined
      );
      
      expect(setupResult.success).toBe(true);
      console.log('   ✅ Setup completed');

      // Step 2: Check balance
      console.log('Step 2: Check balance');
      const balanceMemory = {
        id: 'workflow-balance',
        userId: 'test-user',
        agentId: 'test-agent',
        content: { text: 'check balance' },
        roomId: 'test-room',
        createdAt: Date.now(),
      };

      const balanceResult = await getWalletBalanceAction.handler(
        runtime,
        balanceMemory,
        undefined,
        undefined,
        undefined
      );
      
      expect(balanceResult.success).toBe(true);
      console.log('   ✅ Balance checked');

      // Step 3: Validate order creation (don't actually place)
      console.log('Step 3: Validate order creation');
      const orderMemory = {
        id: 'workflow-order',
        userId: 'test-user',
        agentId: 'test-agent',
        content: { text: `validate buy order for ${TEST_CONFIG.MIN_ORDER_SIZE} shares at $0.15` },
        roomId: 'test-room',
        createdAt: Date.now(),
      };

      const orderValid = await placeOrderAction.validate(runtime, orderMemory, undefined);
      expect(orderValid).toBe(true);
      console.log('   ✅ Order validation passed');

      console.log('🎉 Complete workflow validated successfully!');
    }, 45000);
  });
});

// Export for use in other test files
export { TEST_CONFIG };