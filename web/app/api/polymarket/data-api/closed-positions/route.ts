import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

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
    const closedPositions = await axios.get(`${DATA_API_URL}/closed-positions`, {
      params: {
        user: address.toLowerCase(),
        limit: parseInt(limit),
        sortBy: 'REALIZEDPNL',
        sortDirection: 'DESC'
      },
      headers: {
        'Accept': 'application/json',
      }
    });

    // Format closed positions for our UI
    const positions = (closedPositions.data || []).map((pos: any) => ({
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