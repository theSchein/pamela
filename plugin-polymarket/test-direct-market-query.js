#!/usr/bin/env node

/**
 * Direct test of the market query functionality
 */

import { polymarketPlugin } from './dist/index.js';

// Mock runtime for testing
const mockRuntime = {
  character: {
    name: 'Test Agent',
    system: 'Test system',
    plugins: [],
    settings: {},
  },
  getSetting: (key) => {
    const settings = {
      CLOB_API_URL: 'https://clob.polymarket.com',
      WALLET_PRIVATE_KEY: '8cbcf3768fb062f93ba5a5e2cbaf385a9538b9408de0a9241d8dda5c06f0c6d6',
    };
    return settings[key] || process.env[key];
  },
  useModel: () => ({
    // Mock LLM response for parameter extraction
    parameters: {},
    success: true
  }),
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

async function testMarketQuery() {
  console.log('🔍 Testing Direct Market Query...\n');

  try {
    // Initialize plugin
    console.log('1. Initializing plugin...');
    const config = {
      CLOB_API_URL: 'https://clob.polymarket.com',
      WALLET_PRIVATE_KEY: '8cbcf3768fb062f93ba5a5e2cbaf385a9538b9408de0a9241d8dda5c06f0c6d6',
    };
    
    if (polymarketPlugin.init) {
      await polymarketPlugin.init(config);
      console.log('   ✓ Plugin initialized successfully');
    }

    // Find the market action
    console.log('\n2. Finding market action...');
    const marketAction = polymarketPlugin.actions.find(action => 
      action.name === 'POLYMARKET_GET_ALL_MARKETS'
    );

    if (!marketAction) {
      console.log('   ❌ Market action not found');
      return;
    }

    console.log(`   ✓ Found action: ${marketAction.name}`);
    console.log(`   ✓ Description: ${marketAction.description}`);

    // Test action validation
    console.log('\n3. Testing action validation...');
    const isValid = await marketAction.validate(mockRuntime, mockMemory, mockState);
    console.log(`   ✓ Action validation: ${isValid}`);

    // Test action handler
    console.log('\n4. Testing action handler...');
    let responseReceived = false;
    const callback = (response) => {
      responseReceived = true;
      console.log(`   ✓ Action response received:`);
      console.log(`     Text: ${response.text ? response.text.substring(0, 200) + '...' : 'No text'}`);
      console.log(`     Data: ${response.data ? 'Available' : 'Not available'}`);
      
      if (response.data && response.data.markets) {
        console.log(`     Markets count: ${response.data.markets.length}`);
        if (response.data.markets.length > 0) {
          console.log(`     First market: ${response.data.markets[0].question || 'No question'}`);
        }
      }
    };

    try {
      await marketAction.handler(mockRuntime, mockMemory, mockState, {}, callback);
      
      if (responseReceived) {
        console.log('\n✅ Market query test successful!');
      } else {
        console.log('\n⚠ Action completed but no response received');
      }
    } catch (error) {
      console.log(`\n❌ Action handler failed: ${error.message}`);
      console.log(`   Stack: ${error.stack}`);
    }

    console.log('\n🎯 Test Summary:');
    console.log('   - Plugin loaded and initialized ✓');
    console.log('   - Action found and validated ✓');
    console.log(`   - Handler execution: ${responseReceived ? '✓' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Market query test failed:', error);
  }
}

testMarketQuery();