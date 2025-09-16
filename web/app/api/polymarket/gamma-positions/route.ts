import { NextRequest, NextResponse } from 'next/server';

// Fetch positions directly from Polymarket Gamma API
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  try {
    // Use Polymarket's Gamma API for positions
    const response = await fetch(
      `https://gamma-api.polymarket.com/balances?user=${address.toLowerCase()}&nonzero=true`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('Gamma API error:', response.status);
      return NextResponse.json([]);
    }

    const data = await response.json();
    
    // Transform Gamma API response to our format
    const positions = data
      .filter((item: any) => item.outcome_shares > 0)
      .map((item: any) => ({
        market_id: item.condition_id,
        token_id: `${item.condition_id}-${item.outcome_index}`,
        outcome: item.outcome || (item.outcome_index === 1 ? 'Yes' : 'No'),
        size: item.outcome_shares.toFixed(2),
        avgPrice: '0', // Gamma API doesn't provide avg price
        unrealizedPnl: 0,
        realizedPnl: 0,
        marketQuestion: item.market_slug || item.question || 'Unknown Market',
      }));

    console.log(`Found ${positions.length} positions via Gamma API for ${address}`);
    return NextResponse.json(positions);
    
  } catch (error) {
    console.error('Error fetching Gamma positions:', error);
    return NextResponse.json([]);
  }
}