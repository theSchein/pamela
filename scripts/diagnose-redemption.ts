#!/usr/bin/env npx tsx

import dotenv from 'dotenv';
import { ethers, Contract, JsonRpcProvider } from 'ethers';

dotenv.config();

const CONDITIONAL_TOKENS_ADDRESS = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
const NEG_RISK_CTF_EXCHANGE = "0xC5d563A36AE78145C45a50134d48A1215220f80a";
const CTF_EXCHANGE_ADDRESS = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";

// ConditionalTokens ABI
const CONDITIONAL_TOKENS_ABI = [
  "function payoutNumerators(bytes32 conditionId, uint256 index) external view returns (uint256)",
  "function payoutDenominator(bytes32 conditionId) external view returns (uint256)",
  "function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] calldata indexSets) external",
];

// CTF Exchange ABI to check oracle reports
const CTF_EXCHANGE_ABI = [
  "function getCondition(bytes32 conditionId) external view returns (tuple(address oracle, bytes32 questionId, uint outcomeSlotCount))",
];

// Oracle ABI to check if results were reported
const ORACLE_ABI = [
  "function getResult(bytes32 questionId) external view returns (bytes32)",
  "function isFinalized(bytes32 questionId) external view returns (bool)",
];

async function diagnoseRedemption() {
  console.log('🔬 Diagnosing Redemption Issues\n');
  
  const provider = new JsonRpcProvider('https://polygon-rpc.com');
  
  // Test markets from earlier
  const testMarkets = [
    { conditionId: '0x08baee42b01ac1f9c6f47b3e2e8bc63f5aec2f09a1f2c7c23c488fcaf6e907e0', name: 'Market 1' },
    { conditionId: '0xc37bd5b3fc0f12e53b86e1fcf964c088fa93c956f8bcd0d982a95fb8c30f5d72', name: 'Market 2' },
    { conditionId: '0xdde844a46e088f97c83e47d9d3e0b2e91c6d0e1e1f1bf27e00e9bbd9c2bc2f14', name: 'Market 3' },
    { conditionId: '0xacb16750c756e0f59fa6c6e84e96c3c659a3e988e40797c47cc0e5e436e87bd0', name: 'Market 4' },
    { conditionId: '0x9e2ada45cccaf4f948e23e488c96b8f6b2e6f2fecc8cc604dcc8e1b6f48e3a78', name: 'Market 5' }
  ];
  
  const conditionalTokens = new Contract(
    CONDITIONAL_TOKENS_ADDRESS,
    CONDITIONAL_TOKENS_ABI,
    provider
  );
  
  for (const market of testMarkets) {
    console.log(`\n📊 Analyzing ${market.name}:`);
    console.log(`Condition ID: ${market.conditionId.substring(0, 20)}...`);
    
    try {
      // 1. Check payout configuration
      const payoutNum0 = await conditionalTokens.payoutNumerators(market.conditionId, 0);
      const payoutNum1 = await conditionalTokens.payoutNumerators(market.conditionId, 1);
      const payoutDenom = await conditionalTokens.payoutDenominator(market.conditionId);
      
      console.log(`\n  Payout Configuration:`);
      console.log(`    Outcome 0 (No):  ${payoutNum0}/${payoutDenom}`);
      console.log(`    Outcome 1 (Yes): ${payoutNum1}/${payoutDenom}`);
      
      if (payoutDenom > 0n) {
        console.log(`    ✅ Payouts are set (denominator > 0)`);
        
        // Determine winner
        if (payoutNum0 > 0n) {
          console.log(`    🏆 Winner: NO (Outcome 0)`);
        } else if (payoutNum1 > 0n) {
          console.log(`    🏆 Winner: YES (Outcome 1)`);
        }
      } else {
        console.log(`    ❌ Payouts NOT set (denominator = 0)`);
      }
      
      // 2. Try to understand why redemption might fail
      console.log(`\n  Attempting dry-run redemption...`);
      
      // Try to encode the redemption call
      const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
      const parentCollectionId = ethers.ZeroHash;
      const indexSets = [1, 2];
      
      // Try static call to see if it would succeed
      try {
        const iface = new ethers.Interface(CONDITIONAL_TOKENS_ABI);
        const calldata = iface.encodeFunctionData("redeemPositions", [
          USDC_ADDRESS,
          parentCollectionId,
          market.conditionId,
          indexSets
        ]);
        
        // Simulate the call
        const result = await provider.call({
          to: CONDITIONAL_TOKENS_ADDRESS,
          data: calldata,
          from: "0x516F82432606705cEf5fA86dD4Ff79DDe6b082C0" // Your wallet
        });
        
        console.log(`    ✅ Redemption would succeed (static call passed)`);
      } catch (error: any) {
        console.log(`    ❌ Redemption would fail:`);
        if (error.reason) {
          console.log(`       Reason: ${error.reason}`);
        }
        if (error.data) {
          // Try to decode error
          try {
            const decoded = ethers.toUtf8String('0x' + error.data.slice(138));
            console.log(`       Error: ${decoded}`);
          } catch {
            console.log(`       Raw error: ${error.data.substring(0, 100)}...`);
          }
        }
      }
      
      // 3. Check if this is a neg risk market
      console.log(`\n  Checking market type...`);
      try {
        // Check both CTF exchanges
        for (const exchange of [CTF_EXCHANGE_ADDRESS, NEG_RISK_CTF_EXCHANGE]) {
          try {
            const ctfExchange = new Contract(exchange, CTF_EXCHANGE_ABI, provider);
            const condition = await ctfExchange.getCondition(market.conditionId);
            console.log(`    Found in ${exchange === NEG_RISK_CTF_EXCHANGE ? 'Neg Risk' : 'Standard'} CTF Exchange`);
            console.log(`    Oracle: ${condition.oracle}`);
            break;
          } catch {
            // Not in this exchange
          }
        }
      } catch (error) {
        console.log(`    Could not determine market type`);
      }
      
    } catch (error) {
      console.log(`  ❌ Error analyzing market: ${error.message}`);
    }
  }
  
  console.log('\n\n📋 Summary:');
  console.log('The issue appears to be that while payouts show as set (1/1 or 0/1),');
  console.log('the ConditionalTokens contract still rejects redemption with "result not received".');
  console.log('\nPossible causes:');
  console.log('1. These are old markets that were already redeemed');
  console.log('2. The oracle report process is incomplete');
  console.log('3. These are neg risk markets requiring different redemption flow');
  console.log('4. The positions were already claimed via a different mechanism');
}

diagnoseRedemption();