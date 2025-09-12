import { NextRequest, NextResponse } from 'next/server';
import { marketCache, getMarketWithFallback } from '@/lib/services/market-cache';

const GAMMA_API_URL = 'https://gamma-api.polymarket.com';
const CLOB_API_URL = 'https://clob.polymarket.com';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const marketId = searchParams.get('id');
  const active = searchParams.get('active');

  try {
    // If fetching a specific market, try multiple endpoints
    if (marketId) {
      // First try the gamma API with the market/condition ID
      let marketData = null;
      
      // Try fetching from gamma API
      try {
        const gammaResponse = await fetch(`${GAMMA_API_URL}/markets?id=${marketId}`, {
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (gammaResponse.ok) {
          const data = await gammaResponse.json();
          if (Array.isArray(data) && data.length > 0) {
            marketData = data[0];
          }
        }
      } catch (e) {
        console.log('Gamma API failed, trying CLOB API');
      }
      
      // If no data yet, try CLOB markets endpoint
      if (!marketData) {
        try {
          const clobResponse = await fetch(`${CLOB_API_URL}/markets/${marketId}`, {
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (clobResponse.ok) {
            marketData = await clobResponse.json();
          }
        } catch (e) {
          console.log('CLOB API also failed');
        }
      }
      
      // If still no data, return a basic structure
      if (!marketData) {
        marketData = {
          id: marketId,
          condition_id: marketId,
          question: `Market ${marketId}`,
          market_slug: marketId,
          end_date_iso: new Date().toISOString(),
          volume: '0',
          liquidity: '0',
          outcomes: [
            { id: '1', price: 0.5, outcome: 'Yes' },
            { id: '2', price: 0.5, outcome: 'No' }
          ],
          tokens: [
            { token_id: '1', outcome: 'Yes', price: 0.5, winner: false },
            { token_id: '2', outcome: 'No', price: 0.5, winner: false }
          ],
          active: true,
          closed: false,
          resolved: false
        };
      }
      
      // Normalize the market data to ensure consistent format
      const normalizedData = {
        id: marketData.condition_id || marketData.id || marketId,
        question: marketData.question || `Market ${marketId}`,
        market_slug: marketData.market_slug || marketId,
        end_date_iso: marketData.end_date_iso || new Date().toISOString(),
        volume: marketData.volume || '0',
        liquidity: marketData.liquidity || '0',
        outcomes: marketData.tokens ? marketData.tokens.map((t: any) => ({
          id: t.token_id,
          price: t.price,
          outcome: t.outcome
        })) : marketData.outcomes || [],
        active: marketData.active !== undefined ? marketData.active : true,
        closed: marketData.closed !== undefined ? marketData.closed : false,
        resolved: marketData.resolved !== undefined ? marketData.resolved : false
      };
      
      // Cache the normalized data
      if (normalizedData) {
        marketCache.set(marketId, normalizedData);
      }
      
      return NextResponse.json(normalizedData);
    } else {
      // Fetch all markets
      const url = active !== null 
        ? `${GAMMA_API_URL}/markets?active=${active}`
        : `${GAMMA_API_URL}/markets`;
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
      }

      const data = await response.json();
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error('Error fetching markets:', error);
    return NextResponse.json({ error: 'Failed to fetch markets' }, { status: 500 });
  }
}