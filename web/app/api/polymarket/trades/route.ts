import { NextRequest, NextResponse } from 'next/server';

const CLOB_API_URL = 'https://clob.polymarket.com';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  const limit = searchParams.get('limit') || '100';

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  try {
    // The CLOB API requires authentication for trades endpoint
    // For now, we'll return mock data to test the UI
    // In production, you'd need to implement proper authentication
    
    console.log(`Fetching trades for address: ${address}`);
    
    // Mock response for testing
    // TODO: Implement proper CLOB authentication and fetch real trades
    return NextResponse.json({
      trades: [],
      message: 'CLOB API requires authentication. Please implement API key authentication.'
    });
    
  } catch (error) {
    console.error('Error fetching trades:', error);
    return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
  }
}