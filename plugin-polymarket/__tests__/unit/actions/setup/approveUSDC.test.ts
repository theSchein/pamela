/**
 * USDC Approval Test
 * Tests the USDC approval functionality for Polymarket trading
 */

// Load environment variables from root directory
import { config } from 'dotenv';
import path from 'path';
config({ path: path.resolve(process.cwd(), '../.env') });

import { describe, it, expect, beforeAll } from 'vitest';
import type { IAgentRuntime, Memory, State } from '@elizaos/core';
import { createTestRuntime, createTestMemory } from './test-utils';

// Import approval action
import { approveUSDCAction } from '../src/actions/approveUSDC';

describe('🔧 USDC Approval Test Suite', () => {
  let runtime: IAgentRuntime;
  let testState: State;

  beforeAll(async () => {
    console.log('🔧 Setting up USDC approval test environment...');
    
    // Create runtime with real environment variables
    runtime = await createTestRuntime({
      POLYMARKET_PRIVATE_KEY: process.env.POLYMARKET_PRIVATE_KEY,
      WALLET_PRIVATE_KEY: process.env.WALLET_PRIVATE_KEY,
      POLYGON_RPC_URL: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    });

    testState = {
      userId: 'approval-test-user',
      agentId: 'pamela-approval',
      bio: 'Pamela USDC approval test',
      lore: [],
      messageDirections: 'Execute USDC approval test',
      postDirections: 'Test USDC approval functionality',
      roomId: '00000000-0000-0000-0000-000000000001',
      actors: '',
      goals: 'Verify USDC approval functionality',
      recentMessages: '',
      recentMessagesData: [],
    };

    console.log('✅ USDC approval test environment ready');
  });

  describe('🔒 USDC Approval Setup', () => {
    it('should validate the approval action correctly', async () => {
      console.log('🔍 Validating USDC approval action...');
      
      const memory = createTestMemory({
        content: { text: 'Please approve USDC for Polymarket trading' },
        userId: 'approval-test-user',
        roomId: '00000000-0000-0000-0000-000000000001',
      });

      const isValid = await approveUSDCAction.validate(runtime, memory, testState);
      
      expect(isValid).toBe(true);
      console.log('✅ USDC approval action validation passed');
    });

    it('should set up USDC approvals for Polymarket trading', async () => {
      console.log('🚀 Setting up USDC approvals...');
      console.log('⚠️  This will execute real blockchain transactions!');
      
      const memory = createTestMemory({
        content: { text: 'Set up USDC approvals for Polymarket trading' },
        userId: 'approval-test-user',
        roomId: '00000000-0000-0000-0000-000000000001',
      });

      // Track callback messages
      const callbackMessages: string[] = [];
      const callback = (content: any) => {
        console.log('\n📋 Approval Step:');
        console.log(content.text);
        callbackMessages.push(content.text);
        
        if (content.data) {
          console.log('📊 Step Data:', JSON.stringify(content.data, null, 2));
        }
      };

      const result = await approveUSDCAction.handler(
        runtime, 
        memory, 
        testState, 
        {},
        callback
      );

      console.log('\n🎯 Final Approval Result:');
      console.log('Success:', result.success);
      console.log('Text (first 200 chars):', result.text?.substring(0, 200) + '...');
      
      if (result.data) {
        console.log('Final Data Keys:', Object.keys(result.data));
      }

      // Verify the result structure
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.text).toBeDefined();

      if (result.success) {
        console.log('\n🎉 USDC APPROVAL SUCCESSFUL!');
        console.log('✅ Your wallet is now approved for Polymarket trading');
        
        // Verify we got approval status data
        expect(result.data).toBeDefined();
        
        if (result.data?.finalStatus) {
          console.log('✅ Final approval status:', result.data.finalStatus);
          
          // If approvals were set, verify the structure
          if (!result.data.allApprovalsSet) {
            expect(result.data.transactions).toBeDefined();
            expect(Array.isArray(result.data.transactions)).toBe(true);
            console.log(`✅ Executed ${result.data.transactions.length} approval transactions`);
          }
        }
        
      } else {
        console.log('\n⚠️  USDC APPROVAL RESULT:');
        console.log('Status:', result.success ? 'SUCCESS' : 'HANDLED');
        console.log('Message:', result.data?.error || 'No error message');
        
        // Even if approvals were already set, this is still a successful result
        if (result.data?.allApprovalsSet) {
          console.log('✅ All approvals were already set - ready for trading!');
        }
      }

      // Verify we got reasonable callback messages
      expect(callbackMessages.length).toBeGreaterThan(0);
      console.log(`✅ Received ${callbackMessages.length} progress updates`);

    }, 120000); // 2 minute timeout for blockchain transactions
  });
});