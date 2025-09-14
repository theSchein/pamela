#!/usr/bin/env npx tsx

import dotenv from 'dotenv';
import { ethers, Wallet, JsonRpcProvider, Contract } from 'ethers';

dotenv.config();

const CONDITIONAL_TOKENS_ADDRESS = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
const CONDITIONAL_TOKENS_ABI = [
  "function payoutNumerators(bytes32 conditionId, uint256 index) external view returns (uint256)",
  "function payoutDenominator(bytes32 conditionId) external view returns (uint256)",
];

async function checkResolvedMarkets() {
  console.log('🔍 Checking for Resolved Markets\n');
  
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
    
    // Setup ConditionalTokens contract
    const conditionalTokens = new Contract(
      CONDITIONAL_TOKENS_ADDRESS,
      CONDITIONAL_TOKENS_ABI,
      provider
    );
    
    // Get positions from CLOB API (alternative endpoint)
    console.log('📈 Fetching positions from CLOB API...');
    const clobUrl = process.env.CLOB_API_URL || 'https://clob.polymarket.com';
    const openOrdersUrl = `${clobUrl}/all-orders?user=${walletAddress}`;
    
    // Try multiple APIs to get comprehensive position data
    const apis = [
      `https://data-api.polymarket.com/positions?user=${walletAddress}`,
      `https://clob.polymarket.com/all-orders?user=${walletAddress}`,
      `https://gamma-api.polymarket.com/markets?user=${walletAddress}`
    ];
    
    console.log('Checking multiple data sources...\n');
    
    // Check specific known markets that might be resolved
    const knownMarkets = [
      // Add any known condition IDs here if you have them
    ];
    
    // Fetch from data API
    const positionsResponse = await fetch(apis[0]);
    if (positionsResponse.ok) {
      const data = await positionsResponse.json();
      const positions = data.data || data || [];
      
      console.log(`Found ${positions.length} positions\n`);
      
      for (const position of positions) {
        const size = parseFloat(position.size || position.quantity || '0');
        if (size < 0.01) continue;
        
        const conditionId = position.conditionId || 
                           position.market?.conditionId || 
                           position.condition_id;
        
        if (!conditionId) continue;
        
        console.log(`Checking position:`);
        console.log(`  Outcome: ${position.outcome}`);
        console.log(`  Size: ${size}`);
        console.log(`  Condition ID: ${conditionId?.substring(0, 10)}...`);
        
        // Check on-chain resolution status
        try {
          const payoutNumerator0 = await conditionalTokens.payoutNumerators(conditionId, 0);
          const payoutNumerator1 = await conditionalTokens.payoutNumerators(conditionId, 1);
          const payoutDenominator = await conditionalTokens.payoutDenominator(conditionId);
          
          console.log(`  On-chain payout status:`);
          console.log(`    Outcome 0 payout: ${payoutNumerator0.toString()}/${payoutDenominator.toString()}`);
          console.log(`    Outcome 1 payout: ${payoutNumerator1.toString()}/${payoutDenominator.toString()}`);
          
          // If payouts are set, market is resolved
          if (payoutDenominator > 0n) {
            console.log(`  ✅ MARKET IS RESOLVED - Ready for redemption!`);
            
            // Calculate which outcome won
            if (payoutNumerator0 > 0n) {
              console.log(`    Winner: Outcome 0 (No)`);
            }
            if (payoutNumerator1 > 0n) {
              console.log(`    Winner: Outcome 1 (Yes)`);
            }
          } else {
            console.log(`  ⏳ Market not yet resolved on-chain`);
          }
        } catch (error) {
          console.log(`  ⚠️ Could not check on-chain status: ${error.message}`);
        }
        
        console.log('');
      }
    }
    
    // Also check for any ERC1155 token balances (CTF positions)
    console.log('\n📊 Checking ERC1155 token balances...');
    const CTF_ADDRESS = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
    const ERC1155_ABI = [
      'function balanceOf(address account, uint256 id) view returns (uint256)',
      'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)'
    ];
    
    // Get recent transfer events to find token IDs
    const ctfContract = new Contract(CTF_ADDRESS, ERC1155_ABI, provider);
    const currentBlock = await provider.getBlockNumber();
    const filter = ctfContract.filters.TransferSingle(null, null, walletAddress);
    
    try {
      // Look back 10000 blocks (about 6 hours on Polygon)
      const events = await ctfContract.queryFilter(filter, currentBlock - 10000, currentBlock);
      const uniqueTokenIds = new Set();
      
      for (const event of events) {
        uniqueTokenIds.add(event.args.id.toString());
      }
      
      console.log(`Found ${uniqueTokenIds.size} unique token IDs from recent transfers`);
      
      for (const tokenId of uniqueTokenIds) {
        const balance = await ctfContract.balanceOf(walletAddress, tokenId);
        if (balance > 0n) {
          console.log(`  Token ID ${tokenId.substring(0, 20)}...: Balance = ${ethers.formatUnits(balance, 6)} shares`);
        }
      }
    } catch (error) {
      console.log(`Could not fetch transfer events: ${error.message}`);
    }
    
    console.log('\n✅ Check complete');
    console.log('\nTo redeem any resolved positions:');
    console.log('1. Ensure the agent is running');
    console.log('2. Send message: "redeem my winnings" or "claim resolved positions"');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkResolvedMarkets();