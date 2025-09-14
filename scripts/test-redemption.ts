#!/usr/bin/env npx tsx

import dotenv from 'dotenv';
import { ethers, Wallet, JsonRpcProvider } from 'ethers';

dotenv.config();

async function testRedemption() {
  console.log('🔍 Testing Redemption Functionality\n');
  
  const privateKey = process.env.POLYMARKET_PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY;
  
  if (!privateKey) {
    console.error('❌ No private key found in environment');
    process.exit(1);
  }
  
  try {
    // Setup provider and wallet
    const provider = new JsonRpcProvider('https://polygon-rpc.com');
    const wallet = new Wallet(privateKey, provider);
    const walletAddress = wallet.address;
    
    console.log(`📊 Wallet Address: ${walletAddress}`);
    
    // Check USDC balance
    const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
    const USDC_ABI = ['function balanceOf(address) view returns (uint256)'];
    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
    const balance = await usdcContract.balanceOf(walletAddress);
    console.log(`💰 USDC Balance: ${ethers.formatUnits(balance, 6)} USDC\n`);
    
    // Fetch positions from Polymarket API
    console.log('📈 Fetching positions...');
    const positionsUrl = `https://data-api.polymarket.com/positions?user=${walletAddress}&sizeThreshold=0.01`;
    const positionsResponse = await fetch(positionsUrl);
    
    if (!positionsResponse.ok) {
      throw new Error(`Failed to fetch positions: ${positionsResponse.status}`);
    }
    
    const positionsData = await positionsResponse.json();
    const positions = positionsData.data || positionsData || [];
    
    console.log(`Found ${positions.length} total positions\n`);
    
    // Look for resolved markets
    const resolvedMarkets = new Map();
    let potentialRedemptions = 0;
    
    for (const position of positions) {
      const size = parseFloat(position.size || position.quantity || '0');
      if (size < 0.01) continue;
      
      const conditionId = position.conditionId || 
                          position.market?.conditionId || 
                          position.marketConditionId ||
                          position.condition_id;
      
      if (!conditionId) continue;
      
      const currentPrice = parseFloat(position.currentPrice || position.price || position.current_price || '-1');
      const outcome = position.outcome || position.outcomeId;
      
      // Check if this looks like a resolved market (price at 0 or 1)
      if (currentPrice === 0 || currentPrice === 1 || currentPrice === 0.0 || currentPrice === 1.0) {
        console.log(`🎯 Potential resolved position found:`);
        console.log(`   Market: ${position.market?.question || position.question || 'Unknown'}`);
        console.log(`   Outcome: ${outcome}`);
        console.log(`   Size: ${size}`);
        console.log(`   Current Price: ${currentPrice}`);
        console.log(`   Condition ID: ${conditionId.substring(0, 10)}...`);
        
        // Try to get more info about the market
        try {
          const marketUrl = `https://gamma-api.polymarket.com/markets?conditionId=${conditionId}`;
          const marketResponse = await fetch(marketUrl);
          
          if (marketResponse.ok) {
            const marketData = await marketResponse.json();
            const market = Array.isArray(marketData) ? marketData[0] : marketData;
            
            if (market) {
              console.log(`   Market Status: ${market.closed ? 'CLOSED' : 'OPEN'}`);
              console.log(`   Resolved: ${market.resolved ? 'YES' : 'NO'}`);
              
              // Check end date to filter out old markets
              const endDate = market.endDate || market.end_date_iso;
              if (endDate) {
                const marketEndDate = new Date(endDate);
                const isOldMarket = marketEndDate < new Date('2024-01-01');
                if (isOldMarket) {
                  console.log(`   ⚠️  Market ended before 2024 - likely already processed`);
                  continue;
                }
              }
              
              if (market.closed || market.resolved || currentPrice === 0 || currentPrice === 1) {
                potentialRedemptions++;
                resolvedMarkets.set(conditionId, {
                  conditionId,
                  question: market.question,
                  outcome,
                  size,
                  price: currentPrice,
                  isNegRisk: market.negRisk || market.neg_risk || false
                });
              }
            }
          }
        } catch (error) {
          console.log(`   ⚠️  Could not fetch market details: ${error.message}`);
          // Still count it if price indicates resolution
          if (currentPrice === 0 || currentPrice === 1) {
            potentialRedemptions++;
            resolvedMarkets.set(conditionId, {
              conditionId,
              question: position.market?.question || 'Unknown',
              outcome,
              size,
              price: currentPrice
            });
          }
        }
        console.log('');
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total positions: ${positions.length}`);
    console.log(`   Potential redemptions: ${potentialRedemptions}`);
    console.log(`   Unique markets to redeem: ${resolvedMarkets.size}`);
    
    if (resolvedMarkets.size > 0) {
      console.log('\n✅ Markets ready for redemption:');
      for (const [conditionId, market] of resolvedMarkets) {
        console.log(`   - ${market.question.substring(0, 60)}...`);
        console.log(`     Outcome: ${market.outcome}, Size: ${market.size}, Price: ${market.price}`);
      }
      
      console.log('\n💡 To redeem these positions, the agent needs to:');
      console.log('   1. Be prompted with "redeem my winnings" or similar');
      console.log('   2. The redeemWinningsAction will automatically process these');
    } else {
      console.log('\n❌ No positions found that need redemption');
      console.log('   This could mean:');
      console.log('   - All winnings have already been redeemed');
      console.log('   - No resolved markets with positions');
      console.log('   - Markets are still active');
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error);
    process.exit(1);
  }
}

testRedemption();