import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  try {
    // For now, return empty positions since we don't have CLOB client setup
    // The data-api/positions endpoint should be used instead
    console.log(`Legacy positions endpoint called for: ${address}`);
    console.log('Use /api/polymarket/data-api/positions instead');
    return NextResponse.json([]);
    
  } catch (error) {
    console.error('Error in positions route:', error);
    return NextResponse.json([]);
  }
}