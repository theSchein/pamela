#!/usr/bin/env node

/**
 * List all available actions in the plugin
 */

import { polymarketPlugin } from './dist/index.js';

async function listActions() {
  console.log('📋 Available Polymarket Plugin Actions:\n');

  if (polymarketPlugin.actions && polymarketPlugin.actions.length > 0) {
    console.log(`Found ${polymarketPlugin.actions.length} actions:\n`);
    
    polymarketPlugin.actions.forEach((action, index) => {
      console.log(`${index + 1}. ${action.name}`);
      console.log(`   Description: ${action.description || 'No description'}`);
      console.log(`   Similes: ${action.similes?.join(', ') || 'None'}`);
      console.log('');
    });
  } else {
    console.log('No actions found in plugin');
  }
}

listActions();