import { NextRequest, NextResponse } from 'next/server';

const DATA_API_URL = 'https://data-api.polymarket.com';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  
  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  try {
    // Fetch data from Polymarket API only - NO blockchain calls
    const [currentPositions, closedPositions] = await Promise.all([
      // Get current positions
      fetch(`${DATA_API_URL}/positions?user=${address.toLowerCase()}&sizeThreshold=0.01&limit=500`, {
        headers: { 'Accept': 'application/json' }
      }).then(res => res.json()).catch(err => {
        console.error('Error fetching current positions:', err.message);
        return [];
      }),
      
      // Get closed positions
      fetch(`${DATA_API_URL}/closed-positions?user=${address.toLowerCase()}&limit=200&sortBy=REALIZEDPNL&sortDirection=DESC`, {
        headers: { 'Accept': 'application/json' }
      }).then(res => res.json()).catch(err => {
        console.error('Error fetching closed positions:', err.message);
        return [];
      })
    ]);

    // Format current positions - the API already includes title field!
    const formattedCurrentPositions = (currentPositions || []).map((pos: any) => ({
      id: `current-${pos.conditionId}-${pos.outcome}`,
      type: 'position',
      status: 'open',
      market_id: pos.conditionId,
      marketQuestion: pos.title || `Market ${pos.conditionId.slice(0, 8)}...`,
      token_id: pos.asset,
      outcome: pos.outcome,
      size: pos.size?.toString() || '0',
      avgPrice: pos.avgPrice?.toString() || '0',
      currentValue: pos.currentValue || 0,
      unrealizedPnl: pos.cashPnl || 0,
      percentPnl: pos.percentPnl || 0,
      timestamp: new Date().toISOString(),
      endDate: pos.endDate
    }));

    // Format closed positions as historical trades
    const formattedClosedPositions = (closedPositions || []).map((pos: any) => ({
      id: `closed-${pos.conditionId}-${pos.outcome}`,
      type: 'closed_position',
      status: pos.realizedPnl > 0 ? 'won' : pos.realizedPnl < 0 ? 'lost' : 'breakeven',
      market_id: pos.conditionId,
      marketQuestion: pos.title,
      token_id: pos.asset,
      outcome: pos.outcome,
      avgPrice: pos.avgPrice?.toString() || '0',
      totalBought: pos.totalBought || 0,
      totalSold: pos.totalSold || 0,
      realizedPnl: pos.realizedPnl || 0,
      timestamp: pos.endDate || new Date().toISOString(),
      endDate: pos.endDate
    }));

    // Combine all history (no redemptions - those are included in closed positions)
    const fullHistory = [
      ...formattedCurrentPositions,
      ...formattedClosedPositions
    ].sort((a, b) => {
      const timeA = new Date(a.timestamp || a.endDate || 0).getTime();
      const timeB = new Date(b.timestamp || b.endDate || 0).getTime();
      return timeB - timeA; // Most recent first
    });

    // Calculate summary statistics
    const stats = {
      totalPositions: formattedCurrentPositions.length,
      totalClosedPositions: formattedClosedPositions.length,
      totalRedemptions: 0, // Redemptions are included in closed positions
      totalUnrealizedPnl: formattedCurrentPositions.reduce((sum: number, p: any) => sum + (p.unrealizedPnl || 0), 0),
      totalRealizedPnl: formattedClosedPositions.reduce((sum: number, p: any) => sum + (p.realizedPnl || 0), 0),
      totalRedeemed: formattedClosedPositions
        .filter((p: any) => p.status === 'won')
        .reduce((sum: number, p: any) => sum + (p.totalSold || 0), 0)
    };

    return NextResponse.json({
      history: fullHistory,
      stats
    });
    
  } catch (error: any) {
    console.error('Error fetching full history:', error);
    return NextResponse.json({ 
      history: [], 
      stats: {
        totalPositions: 0,
        totalClosedPositions: 0,
        totalRedemptions: 0,
        totalUnrealizedPnl: 0,
        totalRealizedPnl: 0,
        totalRedeemed: 0
      }
    });
  }
}