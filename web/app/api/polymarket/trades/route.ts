import { NextRequest, NextResponse } from 'next/server';
import { getUserTrades } from '@/lib/services/clob-client';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  const limit = parseInt(searchParams.get('limit') || '100');
  const enrichMarkets = searchParams.get('enrichMarkets') === 'true'; // Only fetch market data if requested

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  try {
    console.log(`Fetching trades for address: ${address}`);
    
    // Check if we have CLOB credentials
    if (!process.env.CLOB_API_KEY || !process.env.CLOB_API_SECRET) {
      console.log('No CLOB credentials available, returning empty trades');
      return NextResponse.json([]);
    }
    
    // Fetch trades using authenticated CLOB client
    const trades = await getUserTrades(address);
    
    if (!trades || trades.length === 0) {
      console.log('No trades found for address');
      return NextResponse.json([]);
    }
    
    // Format trades for the frontend
    const formattedTrades = await Promise.all(
      trades.slice(0, limit).map(async (trade: any) => {
        // Extract market ID from various possible fields
        const assetId = trade.asset_id || trade.assetId || trade.token_id;
        const marketId = trade.market || trade.market_id || trade.condition_id || 
                        (assetId ? assetId.split('-')[0] : null);
        
        // Only fetch market question if requested (to avoid slow initial load)
        let marketQuestion = trade.market_slug || trade.question || 'Loading...';
        if (enrichMarkets && marketId) {
          try {
            const marketResponse = await fetch(
              `https://gamma-api.polymarket.com/markets/${marketId}`
            );
            if (marketResponse.ok) {
              const marketData = await marketResponse.json();
              marketQuestion = marketData.question || marketData.title || marketQuestion;
            }
          } catch (err) {
            console.error('Error fetching market data for trade:', err);
          }
        }
        
        // Determine outcome from asset ID or trade data
        const outcomeIndex = assetId?.split('-')[1];
        const outcome = trade.outcome || trade.outcome_name || 
                       (outcomeIndex === '1' ? 'Yes' : outcomeIndex === '0' ? 'No' : 'Unknown');
        
        return {
          id: trade.id || trade.order_id || trade.hash,
          marketId: marketId,
          marketQuestion: marketQuestion,
          side: trade.side || 'BUY',
          outcome: outcome,
          size: trade.size || trade.match_size || trade.shares || '0',
          price: trade.price || trade.match_price || '0',
          timestamp: trade.created_at || trade.timestamp || new Date().toISOString(),
          status: trade.status || 'matched',
          txHash: trade.transaction_hash || trade.tx_hash
        };
      })
    );
    
    console.log(`Returning ${formattedTrades.length} trades for ${address}`);
    return NextResponse.json(formattedTrades);
    
  } catch (error: any) {
    console.error('Error fetching trades:', error);
    
    // Return empty array instead of error to avoid breaking UI
    return NextResponse.json([]);
  }
}