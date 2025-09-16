#!/usr/bin/env npx tsx

import dotenv from 'dotenv';
import { ethers, Contract, JsonRpcProvider } from 'ethers';

dotenv.config();

const CONDITIONAL_TOKENS_ADDRESS = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";

// ConditionalTokens ABI
const CONDITIONAL_TOKENS_ABI = [
  "function payoutNumerators(bytes32 conditionId, uint256 index) external view returns (uint256)",
  "function payoutDenominator(bytes32 conditionId) external view returns (uint256)",
];

// Known markets from the monitor (with recent end dates)
const recentMarkets = [
  { question: "Will Donald Trump sign an executive order on August 15?", ended: "Aug 14, 2025" },
  { question: "Will any free agent QB get more money than Myles Garrett?", ended: "Sep 2, 2025" },
  { question: "Trump, Putin, and Zelensky seen together by August 31?", ended: "Aug 30, 2025" },
  { question: "Will courts block Trump's D.C. takeover by Friday?", ended: "Aug 14, 2025" },
  { question: "Will JD Vance say 'Trump' or 'President' 20+ times", ended: "Aug 12, 2025" },
  { question: "Any fleeing Texas House Democrats arrested by Friday?", ended: "Aug 7, 2025" },
];

async function findRedeemableMarkets() {
  console.log('🔍 Finding Redeemable Markets\n');
  
  const provider = new JsonRpcProvider('https://polygon-rpc.com');
  const conditionalTokens = new Contract(
    CONDITIONAL_TOKENS_ADDRESS,
    CONDITIONAL_TOKENS_ABI,
    provider
  );
  
  // Search for these markets in recent Polymarket data
  for (const market of recentMarkets) {
    console.log(`\nSearching for: "${market.question.substring(0, 50)}..."`);
    console.log(`  Ended: ${market.ended}`);
    
    // Try to find via Gamma API with question search
    const encodedQ = encodeURIComponent(market.question.substring(0, 30));
    const searchUrl = `https://gamma-api.polymarket.com/markets?search=${encodedQ}`;
    
    try {
      const response = await fetch(searchUrl);
      if (response.ok) {
        const data = await response.json();
        const markets = Array.isArray(data) ? data : [data];
        
        for (const m of markets) {
          if (m && m.question && m.question.includes(market.question.substring(0, 30))) {
            console.log(`  ✅ Found market!`);
            console.log(`     Condition ID: ${m.conditionId || 'Unknown'}`);
            console.log(`     Closed: ${m.closed || false}`);
            console.log(`     Resolved: ${m.resolved || false}`);
            
            // Check on-chain resolution
            if (m.conditionId) {
              try {
                const payoutDenom = await conditionalTokens.payoutDenominator(m.conditionId);
                const payoutNum0 = await conditionalTokens.payoutNumerators(m.conditionId, 0);
                const payoutNum1 = await conditionalTokens.payoutNumerators(m.conditionId, 1);
                
                console.log(`     On-chain payouts: ${payoutNum0}/${payoutDenom} (No), ${payoutNum1}/${payoutDenom} (Yes)`);
                
                if (payoutDenom > 0n) {
                  console.log(`     🎯 READY FOR REDEMPTION!`);
                  console.log(`     Add to redemption list: ${m.conditionId}`);
                }
              } catch (e) {
                console.log(`     Could not check on-chain status`);
              }
            }
            break;
          }
        }
      }
    } catch (error) {
      console.log(`  Error searching: ${error.message}`);
    }
  }
  
  console.log('\n\n📋 Next Steps:');
  console.log('1. Collect the condition IDs for markets that show "READY FOR REDEMPTION"');
  console.log('2. Use these specific condition IDs in the redemption action');
  console.log('3. The plugin needs to be updated to handle these specific markets');
}

findRedeemableMarkets();