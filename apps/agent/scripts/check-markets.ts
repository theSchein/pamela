#!/usr/bin/env tsx
/**
 * Check markets in database
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { polymarketMarketsTable } from '../plugin-polymarket/src/schema.js';
import { sql } from 'drizzle-orm';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

async function checkMarkets() {
  console.log('🔍 Checking markets in database...\n');
  
  try {
    // Connect to PGLite database
    const dbPath = resolve(__dirname, '../.eliza/.elizadb');
    const client = new PGlite(dbPath);
    const db = drizzle(client);
    
    // Count total markets
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(polymarketMarketsTable);
    
    const totalMarkets = countResult[0]?.count || 0;
    console.log(`📊 Total markets in database: ${totalMarkets}\n`);
    
    // Get sample of markets sorted by volume (assuming we track it)
    const markets = await db
      .select()
      .from(polymarketMarketsTable)
      .where(sql`active = true`)
      .limit(10);
    
    console.log('📈 Sample Active Markets:');
    console.log('═'.repeat(80));
    
    markets.forEach((market, index) => {
      console.log(`\n${index + 1}. ${market.question}`);
      console.log(`   🔗 Condition ID: ${market.conditionId}`);
      console.log(`   📅 End Date: ${market.endDateIso || 'No end date'}`);
      console.log(`   🏷️  Category: ${market.category || 'Uncategorized'}`);
      console.log(`   ✅ Active: ${market.active}`);
    });
    
    console.log('\n' + '═'.repeat(80));
    
    // Count by category
    const categoryResult = await db
      .select({
        category: polymarketMarketsTable.category,
        count: sql<number>`count(*)`
      })
      .from(polymarketMarketsTable)
      .groupBy(polymarketMarketsTable.category);
    
    console.log('\n📊 Markets by Category:');
    categoryResult.forEach(({ category, count }) => {
      console.log(`   ${category || 'Uncategorized'}: ${count}`);
    });
    
    // Count active vs closed
    const activeResult = await db
      .select({
        active: polymarketMarketsTable.active,
        count: sql<number>`count(*)`
      })
      .from(polymarketMarketsTable)
      .groupBy(polymarketMarketsTable.active);
    
    console.log('\n📊 Market Status:');
    activeResult.forEach(({ active, count }) => {
      console.log(`   ${active ? 'Active' : 'Closed'}: ${count}`);
    });
    
    await client.close();
    
  } catch (error) {
    console.error('❌ Error checking markets:', error);
    process.exit(1);
  }
}

// Run the check
checkMarkets().catch(console.error);