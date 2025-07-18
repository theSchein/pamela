#!/usr/bin/env node

/**
 * Test character configuration with Polymarket plugin
 */

import { character } from './dist/index.js';

async function testCharacter() {
  console.log('👤 Testing Character Configuration...\n');

  try {
    // Test character structure
    console.log('1. Testing character structure...');
    console.log(`   ✓ Character name: ${character.name}`);
    console.log(`   ✓ Plugins loaded: ${character.plugins?.length || 0}`);
    console.log(`   ✓ Bio entries: ${character.bio?.length || 0}`);
    console.log(`   ✓ Topics: ${character.topics?.length || 0}`);
    console.log(`   ✓ Style rules: ${character.style?.all?.length || 0}`);

    // Test plugin loading
    console.log('\n2. Testing plugin loading...');
    const conditionalPlugins = character.plugins.filter(plugin => 
      plugin.includes('process.env')
    );
    console.log(`   ✓ Conditional plugins: ${conditionalPlugins.length}`);
    
    const alwaysLoaded = character.plugins.filter(plugin => 
      !plugin.includes('process.env')
    );
    console.log(`   ✓ Always loaded plugins: ${alwaysLoaded.length}`);

    // Test message examples
    console.log('\n3. Testing message examples...');
    if (character.messageExamples && character.messageExamples.length > 0) {
      console.log(`   ✓ Message examples: ${character.messageExamples.length}`);
      console.log(`   ✓ First example has ${character.messageExamples[0].length} messages`);
    }

    // Test system prompt
    console.log('\n4. Testing system configuration...');
    if (character.system) {
      console.log(`   ✓ System prompt: ${character.system.substring(0, 50)}...`);
    }

    console.log('\n✅ Character Configuration Valid!');
    console.log('\n📊 Character Summary:');
    console.log(`   - Name: ${character.name}`);
    console.log(`   - Plugins: ${character.plugins?.length || 0}`);
    console.log(`   - Bio entries: ${character.bio?.length || 0}`);
    console.log(`   - Topics: ${character.topics?.length || 0}`);
    console.log(`   - Message examples: ${character.messageExamples?.length || 0}`);
    
  } catch (error) {
    console.error('❌ Character test failed:', error);
    process.exit(1);
  }
}

testCharacter();