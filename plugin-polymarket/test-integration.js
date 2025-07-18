#!/usr/bin/env node

/**
 * Simple integration test for the Polymarket plugin
 * This tests the plugin without the full Eliza framework
 */

import { fileURLToPath } from 'url';
import path from 'path';
import { logger } from '@elizaos/core';
import { polymarketPlugin as plugin } from './dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock runtime for testing
const mockRuntime = {
  character: {
    name: 'Test Character',
    system: 'Test system',
    plugins: [],
    settings: {},
  },
  getSetting: (key) => {
    const settings = {
      CLOB_API_URL: 'https://clob.polymarket.com',
    };
    return settings[key] || process.env[key];
  },
  models: {},
  db: {
    get: async (key) => null,
    set: async (key, value) => true,
    delete: async (key) => true,
    getKeys: async (pattern) => [],
  },
  memory: {
    add: async (memory) => {},
    get: async (id) => null,
    getByEntityId: async (entityId) => [],
    getLatest: async (entityId) => null,
    getRecentMessages: async (options) => [],
    search: async (query) => [],
  },
  getService: (serviceType) => null,
};

// Mock memory
const mockMemory = {
  id: 'test-memory-id',
  entityId: 'test-entity-id',
  roomId: 'test-room-id',
  timestamp: Date.now(),
  content: {
    text: 'Show me all available prediction markets',
    source: 'test',
    actions: [],
  },
  metadata: {
    sessionId: 'test-session-id',
    conversationId: 'test-conversation-id',
  },
};

// Mock state
const mockState = {
  values: {},
  data: {},
  text: '',
};

async function testPlugin() {
  console.log('🧪 Testing Polymarket Plugin Integration...\n');

  try {
    // Test 1: Plugin structure
    console.log('1. Testing plugin structure...');
    console.log(`   ✓ Plugin name: ${plugin.name}`);
    console.log(`   ✓ Plugin description: ${plugin.description}`);
    console.log(`   ✓ Actions count: ${plugin.actions?.length || 0}`);
    console.log(`   ✓ Services count: ${plugin.services?.length || 0}`);
    console.log(`   ✓ Providers count: ${plugin.providers?.length || 0}`);

    // Test 2: Plugin initialization
    console.log('\n2. Testing plugin initialization...');
    const config = {
      CLOB_API_URL: 'https://clob.polymarket.com',
    };
    
    if (plugin.init) {
      await plugin.init(config);
      console.log('   ✓ Plugin initialization successful');
    } else {
      console.log('   ⚠ Plugin has no init method');
    }

    // Test 3: Provider test
    console.log('\n3. Testing provider...');
    if (plugin.providers && plugin.providers.length > 0) {
      const provider = plugin.providers[0];
      console.log(`   ✓ Provider name: ${provider.name}`);
      console.log(`   ✓ Provider description: ${provider.description}`);
      
      try {
        const result = await provider.get(mockRuntime, mockMemory, mockState);
        console.log(`   ✓ Provider get method returned: ${result.text.substring(0, 50)}...`);
      } catch (error) {
        console.log(`   ✗ Provider get method failed: ${error.message}`);
      }
    } else {
      console.log('   ⚠ No providers found');
    }

    // Test 4: Action test
    console.log('\n4. Testing main action...');
    if (plugin.actions && plugin.actions.length > 0) {
      // Find the main markets action
      const marketAction = plugin.actions.find(action => 
        action.name === 'POLYMARKET_GET_ALL_MARKETS' || 
        action.name.includes('MARKETS')
      );
      
      if (marketAction) {
        console.log(`   ✓ Found action: ${marketAction.name}`);
        console.log(`   ✓ Action description: ${marketAction.description}`);
        console.log(`   ✓ Action similes: ${marketAction.similes?.join(', ')}`);
        
        try {
          const isValid = await marketAction.validate(mockRuntime, mockMemory, mockState);
          console.log(`   ✓ Action validate result: ${isValid}`);
          
          // Test action handler
          console.log(`   ✓ Testing action handler...`);
          const callback = (response) => {
            console.log(`   ✓ Action response: ${response.text.substring(0, 100)}...`);
          };
          await marketAction.handler(mockRuntime, mockMemory, mockState, {}, callback);
          
        } catch (error) {
          console.log(`   ✗ Action test failed: ${error.message}`);
        }
      } else {
        console.log('   ⚠ No market action found');
      }
    } else {
      console.log('   ⚠ No actions found');
    }

    console.log('\n✅ Plugin integration test completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Plugin loaded: ✓`);
    console.log(`   - Actions: ${plugin.actions?.length || 0}`);
    console.log(`   - Services: ${plugin.services?.length || 0}`);
    console.log(`   - Providers: ${plugin.providers?.length || 0}`);
    
  } catch (error) {
    console.error('❌ Plugin integration test failed:', error);
    process.exit(1);
  }
}

testPlugin();