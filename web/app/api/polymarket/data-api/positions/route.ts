import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const DATA_API_URL = 'https://data-api.polymarket.com';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  
  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  try {
    // Get current positions
    const currentPositions = await axios.get(`${DATA_API_URL}/positions`, {
      params: {
        user: address.toLowerCase(),
        sizeThreshold: 0.01, // Include small positions
        limit: 500,
      },
      headers: {
        'Accept': 'application/json',
      }
    });

    // Format positions for our UI with all available data
    const positions = (currentPositions.data || []).map((pos: any) => ({
      market_id: pos.conditionId,
      token_id: pos.asset,
      outcome: pos.outcome,
      size: pos.size?.toString() || '0',
      avgPrice: pos.avgPrice?.toString() || '0',
      currentValue: pos.currentValue || 0,
      curPrice: pos.curPrice || pos.avgPrice || 0,
      cashPnl: pos.cashPnl || 0,
      percentPnl: pos.percentPnl || 0,
      unrealizedPnl: pos.cashPnl || 0,
      realizedPnl: pos.realizedPnl || 0,
      totalBought: pos.totalBought || 0,
      endDate: pos.endDate,
      title: pos.title,
      slug: pos.slug,
      eventSlug: pos.eventSlug,
      oppositeOutcome: pos.oppositeOutcome,
      redeemable: pos.redeemable,
      mergeable: pos.mergeable,
      type: 'current'
    }));

    return NextResponse.json(positions);
    
  } catch (error: any) {
    console.error('Error fetching positions from Data API:', error.response?.data || error.message);
    return NextResponse.json([], { status: 500 });
  }
}