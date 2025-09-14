#!/usr/bin/env npx tsx

import dotenv from 'dotenv';
import { ethers, Wallet, Contract, JsonRpcProvider, ZeroHash } from 'ethers';

dotenv.config();

// Contract addresses
const CONDITIONAL_TOKENS_ADDRESS = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const NEG_RISK_CTF_EXCHANGE = "0xC5d563A36AE78145C45a50134d48A1215220f80a";
const CTF_EXCHANGE_ADDRESS = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";

// ABI for ConditionalTokens
const CONDITIONAL_TOKENS_ABI = [
  "function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] calldata indexSets) external",
  "function payoutNumerators(bytes32 conditionId, uint256 index) external view returns (uint256)",
  "function payoutDenominator(bytes32 conditionId) external view returns (uint256)",
];

// Markets from the web monitor showing ended positions
const endedMarkets = [
  { 
    market_id: "0xdde844a4c5da46c819c168aa73cb0b5cb41f1d2067df7764c39420104463765c",
    question: "Will Donald Trump sign an executive order on August 15?",
    outcome: "No",
    size: 5.06
  },
  {
    market_id: "0x08baee42ad514b5a5048c9082987a6221f04b9ca1d87069ac456972230c37008",
    question: "Will any free agent QB get more money than Myles Garrett?",
    outcome: "Yes",
    size: 37.61
  },
  {
    market_id: "0x9e2ada45732ff2ce8685b32088285bac5b5490d11485d4067fde789cb5144b29",
    question: "Trump, Putin, and Zelensky seen together by August 31?",
    outcome: "Yes",
    size: 76.43
  },
  {
    market_id: "0xc37bd5b3042c9512bec7cee8fd166bdafc2d7c8a62e22aed825eadcf8803f5d3",
    question: "Will courts block Trump's D.C. takeover by Friday?",
    outcome: "Yes",
    size: 10.00
  },
  {
    market_id: "0xacb16750f73e286a8ab1a313effd54e9e33002b415bc3f7b0865ab6c230f3387",
    question: "Will JD Vance say 'Trump' or 'President' 20+ times",
    outcome: "Yes",
    size: 5.00
  },
  {
    market_id: "0xd7ad29cb861db6df200287306a79499fc757fbfb0d1c1ffe52c5dda9a1d7acb7",
    question: "Any fleeing Texas House Democrats arrested by Friday?",
    outcome: "No/Yes",
    size: 10.00
  }
];

async function redeemSpecificMarkets() {
  console.log('🎯 Attempting to Redeem Specific Markets\n');
  
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
    
    console.log(`📊 Wallet Address: ${walletAddress}\n`);
    
    // Setup contracts
    const conditionalTokens = new Contract(
      CONDITIONAL_TOKENS_ADDRESS,
      CONDITIONAL_TOKENS_ABI,
      wallet
    );
    
    const results = [];
    
    for (const market of endedMarkets) {
      console.log(`\n📍 Checking Market: ${market.question.substring(0, 50)}...`);
      console.log(`   Market ID: ${market.market_id.substring(0, 20)}...`);
      console.log(`   Position: ${market.outcome} @ ${market.size}`);
      
      // The market ID from the web app might need to be converted to condition ID
      // Polymarket uses different ID formats - let's check both
      const conditionId = market.market_id;
      
      try {
        // Check on-chain resolution status
        const payoutDenom = await conditionalTokens.payoutDenominator(conditionId);
        const payoutNum0 = await conditionalTokens.payoutNumerators(conditionId, 0);
        const payoutNum1 = await conditionalTokens.payoutNumerators(conditionId, 1);
        
        console.log(`   On-chain payouts: ${payoutNum0}/${payoutDenom} (No), ${payoutNum1}/${payoutDenom} (Yes)`);
        
        if (payoutDenom > 0n) {
          console.log(`   ✅ Market is resolved on-chain!`);
          
          // Attempt redemption
          console.log(`   Attempting redemption...`);
          
          const indexSets = [1, 2];
          const parentCollectionId = ZeroHash;
          
          try {
            const tx = await conditionalTokens["redeemPositions(address,bytes32,bytes32,uint256[])"](
              USDC_ADDRESS,
              parentCollectionId,
              conditionId,
              indexSets,
              {
                gasLimit: 500000,
              }
            );
            
            console.log(`   ✅ Transaction sent: ${tx.hash}`);
            
            const receipt = await tx.wait();
            
            if (receipt && receipt.status === 1) {
              console.log(`   ✅ Redemption successful!`);
              results.push({
                market: market.question,
                success: true,
                txHash: tx.hash,
                amount: market.size
              });
            } else {
              console.log(`   ❌ Transaction failed`);
              results.push({
                market: market.question,
                success: false,
                error: 'Transaction reverted'
              });
            }
          } catch (txError: any) {
            console.log(`   ❌ Redemption failed: ${txError.reason || txError.message}`);
            results.push({
              market: market.question,
              success: false,
              error: txError.reason || txError.message
            });
          }
        } else {
          console.log(`   ⏳ Market not resolved on-chain yet`);
        }
      } catch (error: any) {
        console.log(`   ⚠️ Could not check market: ${error.message}`);
        
        // Try to get more info about this market
        try {
          const marketDataUrl = `https://gamma-api.polymarket.com/markets?id=${market.market_id}`;
          const response = await fetch(marketDataUrl);
          if (response.ok) {
            const data = await response.json();
            const marketInfo = Array.isArray(data) ? data[0] : data;
            if (marketInfo) {
              console.log(`   Market info: Closed=${marketInfo.closed}, Resolved=${marketInfo.resolved}`);
              if (marketInfo.conditionId && marketInfo.conditionId !== market.market_id) {
                console.log(`   Found condition ID: ${marketInfo.conditionId}`);
                // Could retry with this condition ID
              }
            }
          }
        } catch (fetchError) {
          // Ignore
        }
      }
    }
    
    // Summary
    console.log('\n\n📊 Redemption Summary:');
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    
    if (successful.length > 0) {
      const totalRedeemed = successful.reduce((sum, r) => sum + (r.amount || 0), 0);
      console.log(`💰 Total redeemed: ~$${totalRedeemed.toFixed(2)} USDC`);
      
      console.log('\nSuccessful redemptions:');
      successful.forEach(r => {
        console.log(`  ✅ ${r.market.substring(0, 50)}...`);
        console.log(`     TX: ${r.txHash}`);
      });
    }
    
    if (failed.length > 0) {
      console.log('\nFailed redemptions:');
      failed.forEach(r => {
        console.log(`  ❌ ${r.market.substring(0, 50)}...`);
        console.log(`     Error: ${r.error}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

redeemSpecificMarkets();