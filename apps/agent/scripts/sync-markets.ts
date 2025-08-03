#!/usr/bin/env tsx
/**
 * Manual market sync script
 * Run this to immediately sync active Polymarket markets to the database
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables from the agent directory
config({ path: resolve(__dirname, '../.env') });

async function syncMarkets() {
  console.log('🔄 Starting manual market sync...\n');
  
  // Fetch markets directly from Gamma API
  const gammaUrl = 'https://gamma-api.polymarket.com/markets';
  const today = new Date().toISOString().split('T')[0];
  const params = new URLSearchParams({
    limit: '500',
    active: 'true',
    volume_num_min: '1000',
    closed: 'false',
    end_date_min: today // Only markets ending today or later
  });
  
  console.log(`📡 Fetching from: ${gammaUrl}?${params.toString()}\n`);
  
  try {
    const response = await fetch(`${gammaUrl}?${params}`);
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
    const markets = await response.json();
    
    console.log(`✅ Fetched ${markets.length} active markets with $1k+ volume\n`);
    
    // Filter out old markets (before current year)
    const currentYear = new Date().getFullYear();
    const recentMarkets = markets.filter((market: any) => {
      if (!market.endDate && !market.endDateIso) return true; // Keep markets without end date
      const endDate = new Date(market.endDate || market.endDateIso);
      return endDate.getFullYear() >= currentYear;
    });
    
    console.log(`📅 Filtered to ${recentMarkets.length} current/future markets (${currentYear}+)\n`);
    
    // Show top 10 markets by volume
    const sortedMarkets = recentMarkets.sort((a: any, b: any) => 
      parseFloat(b.volumeNum || b.volume || '0') - parseFloat(a.volumeNum || a.volume || '0')
    );
    
    console.log('📊 Top 10 Markets by Volume:');
    console.log('═'.repeat(80));
    
    sortedMarkets.slice(0, 10).forEach((market: any, index: number) => {
      const volume = parseFloat(market.volumeNum || market.volume || '0');
      const liquidity = parseFloat(market.liquidityNum || market.liquidity || '0');
      const endDate = market.endDate || market.endDateIso || 'No end date';
      
      console.log(`\n${index + 1}. ${market.question}`);
      console.log(`   📈 Volume: $${volume.toLocaleString()}`);
      console.log(`   💰 Liquidity: $${liquidity.toLocaleString()}`);
      console.log(`   📅 End Date: ${endDate}`);
      console.log(`   🔗 Slug: ${market.slug}`);
    });
    
    console.log('\n' + '═'.repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`   Total markets: ${markets.length}`);
    console.log(`   Total volume: $${sortedMarkets.reduce((sum: number, m: any) => 
      sum + parseFloat(m.volumeNum || m.volume || '0'), 0).toLocaleString()}`);
    console.log(`   Total liquidity: $${sortedMarkets.reduce((sum: number, m: any) => 
      sum + parseFloat(m.liquidityNum || m.liquidity || '0'), 0).toLocaleString()}`);
    
    // Save to file for inspection
    const fs = await import('fs/promises');
    const outputPath = resolve(__dirname, '../active-markets.json');
    try {
      await fs.writeFile(outputPath, JSON.stringify(recentMarkets, null, 2));
      console.log(`\n💾 Full market data saved to: ${outputPath}`);
    } catch (err) {
      console.log(`\n⚠️  Could not save market data to file: ${err}`);
    }
    
  } catch (error) {
    console.error('❌ Error fetching markets:', error);
    process.exit(1);
  }
}

// Run the sync
syncMarkets().catch(console.error);