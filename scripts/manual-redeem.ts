#!/usr/bin/env npx tsx

import dotenv from 'dotenv';
import { ethers, Wallet, Contract, JsonRpcProvider, parseUnits, ZeroHash } from 'ethers';

dotenv.config();

// Contract addresses
const CONDITIONAL_TOKENS_ADDRESS = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
const NEG_RISK_ADAPTER_ADDRESS = "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296";
const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

// ABI for ConditionalTokens redeemPositions function
const CONDITIONAL_TOKENS_ABI = [
  "function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] calldata indexSets) external",
  "function payoutNumerators(bytes32 conditionId, uint256 index) external view returns (uint256)",
  "function payoutDenominator(bytes32 conditionId) external view returns (uint256)",
];

// ABI for NegRiskAdapter redeemPositions function
const NEG_RISK_ADAPTER_ABI = [
  "function redeemPositions(bytes32 conditionId, uint256[] calldata amounts) external",
];

async function manualRedeem() {
  console.log('🎯 Manual Redemption Script\n');
  
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
    
    // Known resolved markets from our check
    const resolvedMarkets = [
      { conditionId: '0x08baee42b01ac1f9c6f47b3e2e8bc63f5aec2f09a1f2c7c23c488fcaf6e907e0', outcome: 'Yes', size: 37.61 },
      { conditionId: '0xc37bd5b3fc0f12e53b86e1fcf964c088fa93c956f8bcd0d982a95fb8c30f5d72', outcome: 'Yes', size: 10 },
      { conditionId: '0xdde844a46e088f97c83e47d9d3e0b2e91c6d0e1e1f1bf27e00e9bbd9c2bc2f14', outcome: 'No', size: 5.060972 },
      { conditionId: '0xacb16750c756e0f59fa6c6e84e96c3c659a3e988e40797c47cc0e5e436e87bd0', outcome: 'Yes', size: 5 },
      { conditionId: '0x9e2ada45cccaf4f948e23e488c96b8f6b2e6f2fecc8cc604dcc8e1b6f48e3a78', outcome: 'Yes', size: 5 }
    ];
    
    // Setup contracts
    const conditionalTokens = new Contract(
      CONDITIONAL_TOKENS_ADDRESS,
      CONDITIONAL_TOKENS_ABI,
      wallet
    );
    
    console.log(`🔍 Processing ${resolvedMarkets.length} resolved markets...\n`);
    
    const results = [];
    
    for (const market of resolvedMarkets) {
      console.log(`Processing market ${market.conditionId.substring(0, 10)}...`);
      console.log(`  Outcome: ${market.outcome}, Size: ${market.size}`);
      
      try {
        // For standard binary markets, indexSets is [1, 2] for both outcomes
        const indexSets = [1, 2];
        const parentCollectionId = ZeroHash; // 0x0 for top-level positions
        
        // Estimate gas first
        const gasEstimate = await conditionalTokens["redeemPositions(address,bytes32,bytes32,uint256[])"].estimateGas(
          USDC_ADDRESS,
          parentCollectionId,
          market.conditionId,
          indexSets
        );
        
        console.log(`  Estimated gas: ${gasEstimate.toString()}`);
        
        // Execute redemption
        const tx = await conditionalTokens["redeemPositions(address,bytes32,bytes32,uint256[])"](
          USDC_ADDRESS,
          parentCollectionId,
          market.conditionId,
          indexSets,
          {
            gasLimit: gasEstimate * 120n / 100n, // Add 20% buffer
          }
        );
        
        console.log(`  ✅ Transaction sent: ${tx.hash}`);
        
        // Wait for confirmation
        const receipt = await tx.wait();
        
        if (receipt && receipt.status === 1) {
          console.log(`  ✅ Transaction confirmed! Block: ${receipt.blockNumber}`);
          results.push({
            market: market.conditionId,
            success: true,
            txHash: tx.hash,
            size: market.size
          });
        } else {
          console.log(`  ❌ Transaction failed`);
          results.push({
            market: market.conditionId,
            success: false,
            error: 'Transaction reverted'
          });
        }
        
      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
        
        // Check if it's already redeemed
        if (error.message.includes('already redeemed') || error.message.includes('zero payout')) {
          console.log(`  ℹ️  Position likely already redeemed`);
        }
        
        results.push({
          market: market.conditionId,
          success: false,
          error: error.message
        });
      }
      
      console.log('');
    }
    
    // Summary
    console.log('\n📊 Redemption Summary:');
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    
    if (successful.length > 0) {
      const totalRedeemed = successful.reduce((sum, r) => sum + (r.size || 0), 0);
      console.log(`💰 Estimated total redeemed: ~$${totalRedeemed.toFixed(2)} USDC`);
      
      console.log('\nSuccessful transactions:');
      successful.forEach(r => {
        console.log(`  ${r.txHash}`);
      });
    }
    
    if (failed.length > 0) {
      console.log('\nFailed redemptions:');
      failed.forEach(r => {
        console.log(`  ${r.market.substring(0, 10)}...: ${r.error}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

manualRedeem();