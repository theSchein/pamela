import { NextRequest, NextResponse } from 'next/server';

const DATA_API_URL = 'https://data-api.polymarket.com';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  const limit = searchParams.get('limit') || '100';
  
  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  try {
    // Get closed positions (historical trades)
    const url = new URL(`${DATA_API_URL}/closed-positions`);
    url.searchParams.append('user', address.toLowerCase());
    url.searchParams.append('limit', limit);
    url.searchParams.append('sortBy', 'REALIZEDPNL');
    url.searchParams.append('sortDirection', 'DESC');
    
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const closedPositions = await response.json();

    // Format closed positions for our UI
    const positions = (closedPositions || []).map((pos: any) => ({
      market_id: pos.conditionId,
      token_id: pos.asset,
      outcome: pos.outcome,
      title: pos.title,
      size: '0', // Closed position, no current size
      avgPrice: pos.avgPrice?.toString() || '0',
      totalBought: pos.totalBought || 0,
      totalSold: pos.totalSold || 0,
      realizedPnl: pos.realizedPnl || 0,
      unrealizedPnl: 0, // Closed positions have no unrealized P&L
      endDate: pos.endDate,
      type: 'closed',
      status: pos.realizedPnl > 0 ? 'win' : pos.realizedPnl < 0 ? 'loss' : 'breakeven'
    }));

    return NextResponse.json(positions);
    
  } catch (error: any) {
    console.error('Error fetching closed positions from Data API:', error.response?.data || error.message);
    return NextResponse.json([], { status: 500 });
  }
}