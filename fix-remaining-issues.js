#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';

const fixes = [
  {
    file: 'plugin-polymarket/src/actions/getOpenMarkets.ts',
    fixes: [
      {
        from: '  ): Promise<boolean> => {',
        to: '  ): Promise<ActionResult> => {'
      },
      {
        from: /return true;/g,
        to: 'return contentToActionResult(responseContent);'
      },
      {
        from: /return false;/g,
        to: 'return createErrorResult(error, errorContent);'
      },
      {
        from: /: any/g,
        to: ': any'
      }
    ]
  },
  {
    file: 'plugin-polymarket/src/actions/getPriceHistory.ts',
    fixes: [
      {
        from: '  ): Promise<boolean> => {',
        to: '  ): Promise<ActionResult> => {'
      },
      {
        from: /return true;/g,
        to: 'return contentToActionResult(responseContent);'
      },
      {
        from: /return false;/g,
        to: 'return createErrorResult(error, errorContent);'
      },
      {
        from: 'token_id:',
        to: 'tokenId:'
      }
    ]
  },
  {
    file: 'plugin-polymarket/src/actions/getSamplingMarkets.ts',
    fixes: [
      {
        from: '  ): Promise<boolean> => {',
        to: '  ): Promise<ActionResult> => {'
      },
      {
        from: /return true;/g,
        to: 'return contentToActionResult(responseContent);'
      },
      {
        from: /return false;/g,
        to: 'return createErrorResult(error, errorContent);'
      }
    ]
  }
];

console.log('Applying systematic fixes...');

for (const { file, fixes: fileFixes } of fixes) {
  console.log(`Processing ${file}...`);
  
  try {
    let content = readFileSync(file, 'utf8');
    
    // Add ActionResult import if not present
    if (!content.includes('type ActionResult')) {
      content = content.replace(
        'import {\n  type Action,',
        'import {\n  type Action,\n  type ActionResult,'
      );
    }
    
    // Apply each fix
    for (const fix of fileFixes) {
      if (typeof fix.from === 'string') {
        content = content.replace(fix.from, fix.to);
      } else {
        content = content.replace(fix.from, fix.to);
      }
    }
    
    writeFileSync(file, content);
    console.log(`  ✓ ${file} fixed`);
    
  } catch (error) {
    console.error(`  ✗ Error processing ${file}:`, error.message);
  }
}

console.log('Systematic fixes complete!');