import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  try {
    // For now, return empty trades since we don't have CLOB client setup
    // The data-api endpoints should be used instead
    console.log(`Legacy trades endpoint called for: ${address}`);
    console.log('Use /api/polymarket/data-api endpoints instead');
    
    return NextResponse.json([]);
    
  } catch (error) {
    console.error('Error in trades route:', error);
    return NextResponse.json([]);
  }
}