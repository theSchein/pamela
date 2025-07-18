#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const actionsDir = './plugin-polymarket/src/actions';
const actions = readdirSync(actionsDir).filter(file => file.endsWith('.ts'));

console.log(`Found ${actions.length} action files to fix`);

for (const actionFile of actions) {
  const filePath = join(actionsDir, actionFile);
  console.log(`Processing ${actionFile}...`);
  
  try {
    let content = readFileSync(filePath, 'utf8');
    
    // Skip if already fixed
    if (content.includes('ActionResult') && content.includes('contentToActionResult')) {
      console.log(`  - ${actionFile} already fixed, skipping`);
      continue;
    }
    
    // Add imports
    if (!content.includes('type ActionResult')) {
      content = content.replace(
        'import {\n  type Action,\n  type Content,',
        'import {\n  type Action,\n  type ActionResult,\n  type Content,'
      );
    }
    
    if (!content.includes('contentToActionResult')) {
      // Find the last import and add our helper import
      const lastImportIndex = content.lastIndexOf("from '../");
      if (lastImportIndex > -1) {
        const lineEnd = content.indexOf('\n', lastImportIndex);
        content = content.slice(0, lineEnd + 1) + 
          "import { contentToActionResult, createErrorResult } from '../utils/actionHelpers';\n" + 
          content.slice(lineEnd + 1);
      }
    }
    
    // Fix handler return type
    content = content.replace(
      /\): Promise<Content> => \{/g,
      '): Promise<ActionResult> => {'
    );
    
    // Fix return statements that return Content directly
    content = content.replace(
      /return responseContent;/g,
      'return contentToActionResult(responseContent);'
    );
    
    // Fix throw statements to return error results
    content = content.replace(
      /throw new Error\(([^)]+)\);/g,
      'return createErrorResult($1);'
    );
    
    content = content.replace(
      /throw error;/g,
      'return createErrorResult(error);'
    );
    
    writeFileSync(filePath, content);
    console.log(`  - ${actionFile} fixed successfully`);
    
  } catch (error) {
    console.error(`  - Error processing ${actionFile}:`, error.message);
  }
}

console.log('Action fixing complete!');