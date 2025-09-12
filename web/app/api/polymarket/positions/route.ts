import { NextRequest, NextResponse } from 'next/server';
import { getUserTrades, calculatePositionsFromTrades } from '@/lib/services/clob-client';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  try {
    console.log(`Fetching positions for address: ${address}`);
    
    // Check if we have CLOB credentials
    if (!process.env.CLOB_API_KEY || !process.env.CLOB_API_SECRET) {
      console.log('No CLOB credentials available, returning empty positions');
      return NextResponse.json([]);
    }
    
    // Fetch trades using authenticated CLOB client
    const trades = await getUserTrades(address);
    
    if (!trades || trades.length === 0) {
      console.log('No trades found for address');
      return NextResponse.json([]);
    }
    
    // Calculate positions from trades
    const positions = await calculatePositionsFromTrades(trades);
    
    // Format positions with proper number values
    const formattedPositions = positions.map(p => ({
      market_id: p.market_id,
      token_id: p.token_id,
      outcome: p.outcome || 'Unknown',
      size: p.size.toFixed(2),
      avgPrice: p.avgPrice.toFixed(4),
      unrealizedPnl: p.unrealizedPnl || 0,
      realizedPnl: p.realizedPnl || 0
    }));
    
    console.log(`Found ${formattedPositions.length} positions for address ${address}`);
    return NextResponse.json(formattedPositions);
    
  } catch (error) {
    console.error('Error fetching positions:', error);
    // Return empty array instead of error to avoid breaking the UI
    return NextResponse.json([]);
  }
}