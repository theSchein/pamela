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
  
  console.log(`Processing ${trades.length} trades for position calculation`);

  trades.forEach(trade => {
    // Extract market ID and token ID from the asset_id
    // Polymarket uses format: condition_id-outcome_index for asset_id
    const assetId = trade.asset_id || trade.assetId || trade.token_id;
    const marketId = trade.market || trade.market_id || trade.condition_id || (assetId ? assetId.split('-')[0] : null);
    const outcomeIndex = trade.outcome_index || (assetId ? assetId.split('-')[1] : null);
    
    // Create unique key for each market-outcome combination
    const key = assetId || `${marketId}-${outcomeIndex}`;
    
    if (!key) {
      console.warn('Trade missing market identifier:', trade);
      return;
    }
    
    if (!positions.has(key)) {
      positions.set(key, {
        market_id: marketId,
        token_id: assetId,
        outcome: trade.outcome || trade.outcome_name || (outcomeIndex === '1' ? 'Yes' : 'No'),
        size: 0,
        avgPrice: 0,
        totalCost: 0,
        buyVolume: 0,
        sellVolume: 0,
        unrealizedPnl: 0,
        realizedPnl: 0,
        trades: []
      });
    }

    const position = positions.get(key)!;
    
    // Polymarket trades use shares not USDC for size
    // Price is in cents (0-100), need to divide by 100 for dollar value
    const tradeShares = parseFloat(trade.size || trade.match_size || trade.shares || '0');
    const tradePriceCents = parseFloat(trade.price || trade.match_price || '0');
    const tradePrice = tradePriceCents > 1 ? tradePriceCents / 100 : tradePriceCents; // Normalize to 0-1 range
    
    // Store trade for debugging
    position.trades.push({
      side: trade.side,
      shares: tradeShares,
      price: tradePrice,
      value: tradeShares * tradePrice
    });
    
    // Track buy and sell volumes separately
    if (trade.side === 'BUY' || trade.side === 'buy') {
      const tradeCost = tradeShares * tradePrice;
      position.buyVolume += tradeShares;
      position.totalCost += tradeCost;
      position.size += tradeShares;
    } else if (trade.side === 'SELL' || trade.side === 'sell') {
      position.sellVolume += tradeShares;
      // Calculate realized P&L on sells
      if (position.size > 0) {
        const avgCost = position.totalCost / position.size;
        const sellValue = tradeShares * tradePrice;
        const costBasis = tradeShares * avgCost;
        position.realizedPnl += sellValue - costBasis;
        
        // Reduce position
        position.totalCost -= costBasis;
        position.size -= tradeShares;
      }
    }

    // Update average price for remaining position
    if (position.size > 0) {
      position.avgPrice = position.totalCost / position.size;
    } else {
      position.avgPrice = 0;
      position.size = 0; // Ensure no negative positions
    }
  });

  // Filter and log positions
  const activePositions = Array.from(positions.values())
    .filter(p => p.size > 0.01) // Filter out dust
    .map(p => {
      // Log suspicious positions
      if (p.size > 100 || p.avgPrice > 1) {
        console.log('Large/suspicious position found:', {
          market_id: p.market_id,
          size: p.size,
          avgPrice: p.avgPrice,
          totalCost: p.totalCost,
          trades: p.trades.length
        });
      }
      
      // Remove trades array from final output
      const { trades, ...position } = p;
      return position;
    });
    
  console.log(`Calculated ${activePositions.length} active positions from trades`);
  
  return activePositions;
}