import { ClobClient } from '@polymarket/clob-client';
import { ethers } from 'ethers';

let clobClient: ClobClient | null = null;

export async function getClobClient(): Promise<ClobClient> {
  if (clobClient) return clobClient;

  const privateKey = process.env.POLYMARKET_PRIVATE_KEY;
  const apiKey = process.env.CLOB_API_KEY;
  const apiSecret = process.env.CLOB_API_SECRET;
  const apiPassphrase = process.env.CLOB_API_PASSPHRASE;

  if (!privateKey || !apiKey || !apiSecret || !apiPassphrase) {
    throw new Error('Missing required CLOB credentials');
  }

  const wallet = new ethers.Wallet(privateKey);
  const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
  const signer = wallet.connect(provider);

  // Add ethers v6 compatibility
  if (!signer._signTypedData) {
    (signer as any)._signTypedData = signer.signTypedData;
  }

  const host = 'https://clob.polymarket.com';
  const chainId = 137;
  const creds = {
    key: apiKey,
    secret: apiSecret,
    passphrase: apiPassphrase
  };

  clobClient = new ClobClient(host, chainId, signer, creds);
  
  return clobClient;
}

export async function getUserTrades(address: string) {
  try {
    const client = await getClobClient();
    
    // Use the client's getTrades method - it handles authentication internally
    const trades = await client.getTrades();
    return trades;
  } catch (error) {
    console.error('Error fetching trades:', error);
    return [];
  }
}

export async function calculatePositionsFromTrades(trades: any[]) {
  const positions: Map<string, any> = new Map();

  trades.forEach(trade => {
    const key = `${trade.market}-${trade.outcome}`;
    
    if (!positions.has(key)) {
      positions.set(key, {
        market_id: trade.market,
        outcome: trade.outcome,
        size: 0,
        avgPrice: 0,
        totalCost: 0
      });
    }

    const position = positions.get(key)!;
    const tradeSize = parseFloat(trade.size);
    const tradePrice = parseFloat(trade.price);
    
    if (trade.side === 'BUY') {
      position.totalCost += tradeSize * tradePrice;
      position.size += tradeSize;
    } else {
      position.totalCost -= tradeSize * tradePrice;
      position.size -= tradeSize;
    }

    if (position.size > 0) {
      position.avgPrice = position.totalCost / position.size;
    }
  });

  return Array.from(positions.values()).filter(p => p.size > 0);
}