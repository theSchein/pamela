import { NextRequest, NextResponse } from 'next/server';

const GAMMA_API_URL = 'https://gamma-api.polymarket.com';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  const state = searchParams.get('state') || 'OPEN';

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  try {
    // Using Gamma API endpoint for user orders
    const response = await fetch(
      `${GAMMA_API_URL}/users/${address.toLowerCase()}/orders?status=${state.toLowerCase()}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      // If no orders found, return empty array
      if (response.status === 404) {
        return NextResponse.json([]);
      }
      throw new Error(`API responded with status ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(Array.isArray(data) ? data : (data.orders || []));
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}