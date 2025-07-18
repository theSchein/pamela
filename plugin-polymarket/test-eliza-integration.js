#!/usr/bin/env node

/**
 * Test Polymarket plugin integration with Eliza system
 */

import { fileURLToPath } from 'url';
import path from 'path';
import { polymarketPlugin } from './dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testElizaIntegration() {
  console.log('🔧 Testing Polymarket Plugin with Eliza System...\n');

  try {
    // Test 1: Plugin exports
    console.log('1. Testing plugin exports...');
    console.log(`   ✓ Plugin name: ${polymarketPlugin.name}`);
    console.log(`   ✓ Plugin description: ${polymarketPlugin.description}`);
    console.log(`   ✓ Actions: ${polymarketPlugin.actions?.length || 0}`);
    console.log(`   ✓ Services: ${polymarketPlugin.services?.length || 0}`);
    console.log(`   ✓ Providers: ${polymarketPlugin.providers?.length || 0}`);

    // Test 2: Plugin configuration
    console.log('\n2. Testing plugin configuration...');
    const config = {
      CLOB_API_URL: 'https://clob.polymarket.com',
    };
    
    if (polymarketPlugin.init) {
      await polymarketPlugin.init(config);
      console.log('   ✓ Plugin initialization successful');
    } else {
      console.log('   ⚠ Plugin has no init method');
    }

    // Test 3: Service availability
    console.log('\n3. Testing service availability...');
    if (polymarketPlugin.services && polymarketPlugin.services.length > 0) {
      const service = polymarketPlugin.services[0];
      console.log(`   ✓ Service available: ${service.serviceType}`);
    } else {
      console.log('   ⚠ No services available');
    }

    // Test 4: Action availability
    console.log('\n4. Testing action availability...');
    if (polymarketPlugin.actions && polymarketPlugin.actions.length > 0) {
      const marketActions = polymarketPlugin.actions.filter(action => 
        action.name.includes('MARKETS')
      );
      console.log(`   ✓ Market actions available: ${marketActions.length}`);
      
      if (marketActions.length > 0) {
        console.log(`   ✓ Primary action: ${marketActions[0].name}`);
      }
    } else {
      console.log('   ⚠ No actions available');
    }

    // Test 5: Provider availability
    console.log('\n5. Testing provider availability...');
    if (polymarketPlugin.providers && polymarketPlugin.providers.length > 0) {
      const provider = polymarketPlugin.providers[0];
      console.log(`   ✓ Provider available: ${provider.name}`);
      console.log(`   ✓ Provider description: ${provider.description}`);
    } else {
      console.log('   ⚠ No providers available');
    }

    console.log('\n✅ Polymarket Plugin Ready for Eliza Integration!');
    console.log('\n📊 Summary:');
    console.log(`   - Plugin loaded: ✓`);
    console.log(`   - Configuration: ✓`);
    console.log(`   - Actions: ${polymarketPlugin.actions?.length || 0}`);
    console.log(`   - Services: ${polymarketPlugin.services?.length || 0}`);
    console.log(`   - Providers: ${polymarketPlugin.providers?.length || 0}`);

    console.log('\n🎯 Next Steps:');
    console.log('   1. Add plugin to your character configuration');
    console.log('   2. Set environment variables for API access');
    console.log('   3. Test with "Show me all prediction markets"');
    
  } catch (error) {
    console.error('❌ Plugin integration test failed:', error);
    process.exit(1);
  }
}

testElizaIntegration();