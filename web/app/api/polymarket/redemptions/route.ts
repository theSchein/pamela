import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Redemptions are now tracked through closed positions in Polymarket's API
  // No need to scan blockchain - this avoids rate limiting
  return NextResponse.json([]);
}