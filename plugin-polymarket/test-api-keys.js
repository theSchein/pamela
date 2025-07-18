#!/usr/bin/env node

/**
 * Test API key creation functionality
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

const mockMemory = {
  id: 'test-memory-id',
  entityId: 'test-entity-id',
  roomId: 'test-room-id',
  timestamp: Date.now(),
  content: {
    text: 'Create API key for Polymarket trading',
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

async function testApiKeyCreation() {
  console.log('🔑 Testing API Key Creation...\n');

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

    // Find the create API key action
    console.log('\n2. Finding create API key action...');
    const createApiKeyAction = polymarketPlugin.actions.find(action => 
      action.name === 'POLYMARKET_CREATE_API_KEY'
    );

    if (!createApiKeyAction) {
      console.log('   ❌ Create API key action not found');
      return;
    }

    console.log(`   ✓ Found action: ${createApiKeyAction.name}`);
    console.log(`   ✓ Description: ${createApiKeyAction.description}`);

    // Test action validation
    console.log('\n3. Testing action validation...');
    const isValid = await createApiKeyAction.validate(mockRuntime, mockMemory, mockState);
    console.log(`   ✓ Action validation: ${isValid}`);

    // Test action handler
    console.log('\n4. Testing API key creation...');
    let responseReceived = false;
    const callback = (response) => {
      responseReceived = true;
      console.log(`   ✓ API key creation response received:`);
      console.log(`     Text: ${response.text ? response.text.substring(0, 300) + '...' : 'No text'}`);
      
      if (response.data && response.data.apiKey) {
        console.log(`     API Key ID: ${response.data.apiKey.id}`);
        console.log(`     Secret: ${response.data.apiKey.secret ? response.data.apiKey.secret.substring(0, 10) + '...' : 'Not provided'}`);
        console.log(`     Passphrase: ${response.data.apiKey.passphrase ? response.data.apiKey.passphrase.substring(0, 10) + '...' : 'Not provided'}`);
        console.log(`     Created: ${response.data.apiKey.created_at || 'Not provided'}`);
      }
    };

    try {
      await createApiKeyAction.handler(mockRuntime, mockMemory, mockState, {}, callback);
      
      if (responseReceived) {
        console.log('\n✅ API key creation test successful!');
        console.log('\n🎯 Next steps:');
        console.log('   1. Save the API credentials to your .env file');
        console.log('   2. Test authenticated endpoints');
        console.log('   3. Try placing a test order');
      } else {
        console.log('\n⚠ Action completed but no response received');
      }
    } catch (error) {
      console.log(`\n❌ API key creation failed: ${error.message}`);
      console.log(`   Stack: ${error.stack}`);
    }

    console.log('\n🎯 Test Summary:');
    console.log('   - Plugin loaded and initialized ✓');
    console.log('   - Action found and validated ✓');
    console.log(`   - Handler execution: ${responseReceived ? '✓' : '❌'}`);
    
  } catch (error) {
    console.error('❌ API key creation test failed:', error);
  }
}

testApiKeyCreation();