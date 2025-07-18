#!/usr/bin/env node

import { polymarketPlugin } from './plugin-polymarket/src/index.ts';

console.log('Testing Polymarket plugin...');
console.log('Plugin name:', polymarketPlugin.name);
console.log('Plugin description:', polymarketPlugin.description);
console.log('Number of actions:', polymarketPlugin.actions?.length || 0);
console.log('Number of providers:', polymarketPlugin.providers?.length || 0);

if (polymarketPlugin.actions) {
  console.log('\nAvailable actions:');
  polymarketPlugin.actions.forEach((action, index) => {
    console.log(`  ${index + 1}. ${action.name} - ${action.description}`);
  });
}

console.log('\nPlugin test completed successfully!');