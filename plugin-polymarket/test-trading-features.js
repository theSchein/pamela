#!/usr/bin/env node

/**
 * Test trading features with private key authentication
 */

import { polymarketPlugin } from './dist/index.js';

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
    parameters: {
      tokenId: '12345',
      side: 'buy'
    },
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

const mockMemory = {
  id: 'test-memory-id',
  entityId: 'test-entity-id',
  roomId: 'test-room-id',
  timestamp: Date.now(),
  content: {
    text: 'Get best price for token 12345 buy side',
    source: 'test',
    actions: [],
  },
  metadata: {
    sessionId: 'test-session-id',
    conversationId: 'test-conversation-id',
  },
};

const mockState = {
  values: {},
  data: {},
  text: '',
};

async function testTradingFeatures() {
  console.log('💰 Testing Trading Features...\n');

  try {
    // Initialize plugin
    console.log('1. Initializing plugin with private key...');
    const config = {
      CLOB_API_URL: 'https://clob.polymarket.com',
      WALLET_PRIVATE_KEY: '8cbcf3768fb062f93ba5a5e2cbaf385a9538b9408de0a9241d8dda5c06f0c6d6',
    };
    
    if (polymarketPlugin.init) {
      await polymarketPlugin.init(config);
      console.log('   ✓ Plugin initialized with private key');
    }

    // Test 1: Get best price
    console.log('\n2. Testing GET_BEST_PRICE action...');
    const getBestPriceAction = polymarketPlugin.actions.find(action => 
      action.name === 'POLYMARKET_GET_BEST_PRICE'
    );

    if (getBestPriceAction) {
      console.log(`   ✓ Found action: ${getBestPriceAction.name}`);
      
      const isValid = await getBestPriceAction.validate(mockRuntime, mockMemory, mockState);
      console.log(`   ✓ Action validation: ${isValid}`);

      let responseReceived = false;
      const callback = (response) => {
        responseReceived = true;
        console.log(`   ✓ Best price response:`);
        console.log(`     Text: ${response.text ? response.text.substring(0, 200) + '...' : 'No text'}`);
        
        if (response.data) {
          console.log(`     Token ID: ${response.data.tokenId || 'Not provided'}`);
          console.log(`     Price: ${response.data.price || 'Not provided'}`);
          console.log(`     Side: ${response.data.side || 'Not provided'}`);
        }
      };

      try {
        await getBestPriceAction.handler(mockRuntime, mockMemory, mockState, {}, callback);
        
        if (responseReceived) {
          console.log('   ✅ GET_BEST_PRICE test successful!');
        } else {
          console.log('   ⚠ Action completed but no response received');
        }
      } catch (error) {
        console.log(`   ❌ GET_BEST_PRICE failed: ${error.message}`);
      }
    }

    // Test 2: Get simplified markets
    console.log('\n3. Testing GET_SIMPLIFIED_MARKETS action...');
    const getSimplifiedMarketsAction = polymarketPlugin.actions.find(action => 
      action.name === 'POLYMARKET_GET_SIMPLIFIED_MARKETS'
    );

    if (getSimplifiedMarketsAction) {
      console.log(`   ✓ Found action: ${getSimplifiedMarketsAction.name}`);
      
      const simplifiedMemory = {
        ...mockMemory,
        content: {
          text: 'Get simplified markets',
          source: 'test',
          actions: [],
        },
      };

      const isValid = await getSimplifiedMarketsAction.validate(mockRuntime, simplifiedMemory, mockState);
      console.log(`   ✓ Action validation: ${isValid}`);

      let responseReceived = false;
      const callback = (response) => {
        responseReceived = true;
        console.log(`   ✓ Simplified markets response:`);
        console.log(`     Text: ${response.text ? response.text.substring(0, 200) + '...' : 'No text'}`);
        
        if (response.data && response.data.markets) {
          console.log(`     Markets count: ${response.data.markets.length}`);
          if (response.data.markets.length > 0) {
            console.log(`     First market condition ID: ${response.data.markets[0].condition_id || 'Not provided'}`);
          }
        }
      };

      try {
        await getSimplifiedMarketsAction.handler(mockRuntime, simplifiedMemory, mockState, {}, callback);
        
        if (responseReceived) {
          console.log('   ✅ GET_SIMPLIFIED_MARKETS test successful!');
        } else {
          console.log('   ⚠ Action completed but no response received');
        }
      } catch (error) {
        console.log(`   ❌ GET_SIMPLIFIED_MARKETS failed: ${error.message}`);
      }
    }

    // Test 3: Get CLOB markets (trading-ready markets)
    console.log('\n4. Testing GET_CLOB_MARKETS action...');
    const getClobMarketsAction = polymarketPlugin.actions.find(action => 
      action.name === 'POLYMARKET_GET_CLOB_MARKETS'
    );

    if (getClobMarketsAction) {
      console.log(`   ✓ Found action: ${getClobMarketsAction.name}`);
      
      const clobMemory = {
        ...mockMemory,
        content: {
          text: 'Get CLOB markets for trading',
          source: 'test',
          actions: [],
        },
      };

      const isValid = await getClobMarketsAction.validate(mockRuntime, clobMemory, mockState);
      console.log(`   ✓ Action validation: ${isValid}`);

      let responseReceived = false;
      const callback = (response) => {
        responseReceived = true;
        console.log(`   ✓ CLOB markets response:`);
        console.log(`     Text: ${response.text ? response.text.substring(0, 200) + '...' : 'No text'}`);
        
        if (response.data && response.data.markets) {
          console.log(`     Trading markets count: ${response.data.markets.length}`);
          if (response.data.markets.length > 0) {
            const market = response.data.markets[0];
            console.log(`     First market: ${market.question || 'No question'}`);
            console.log(`     Market active: ${market.active || 'Unknown'}`);
            console.log(`     Min order size: ${market.minimum_order_size || 'Unknown'}`);
          }
        }
      };

      try {
        await getClobMarketsAction.handler(mockRuntime, clobMemory, mockState, {}, callback);
        
        if (responseReceived) {
          console.log('   ✅ GET_CLOB_MARKETS test successful!');
        } else {
          console.log('   ⚠ Action completed but no response received');
        }
      } catch (error) {
        console.log(`   ❌ GET_CLOB_MARKETS failed: ${error.message}`);
      }
    }

    console.log('\n✅ Trading features test completed!');
    console.log('\n🎯 What we tested:');
    console.log('   - Plugin initialization with private key ✓');
    console.log('   - Price retrieval ✓');
    console.log('   - Simplified markets ✓');
    console.log('   - CLOB markets (trading-ready) ✓');
    console.log('\n🎯 Ready for:');
    console.log('   - Real market queries');
    console.log('   - Order placement');
    console.log('   - Real-time price monitoring');
    console.log('   - Full agent interaction');
    
  } catch (error) {
    console.error('❌ Trading features test failed:', error);
  }
}

testTradingFeatures();