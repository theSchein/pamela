import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

// This endpoint tries to fetch market data from the agent's cache/database
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const marketId = searchParams.get('id');

  try {
    // Try to read from the agent's PGLite database or cache files
    // First check if there's a cached markets file
    const cacheDir = path.join(process.cwd(), '../.eliza');
    const marketsFile = path.join(cacheDir, 'markets-cache.json');
    
    try {
      const fileContent = await readFile(marketsFile, 'utf-8');
      const markets = JSON.parse(fileContent);
      
      if (marketId) {
        const market = markets.find((m: any) => m.id === marketId || m.condition_id === marketId);
        if (market) {
          return NextResponse.json(market);
        }
      } else {
        return NextResponse.json(markets);
      }
    } catch (fileError) {
      console.log('No cached markets file found');
    }

    // If no cache file, return empty or fetch from agent API if available
    if (process.env.AGENT_API_URL) {
      const agentResponse = await fetch(`${process.env.AGENT_API_URL}/markets${marketId ? `/${marketId}` : ''}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (agentResponse.ok) {
        const data = await agentResponse.json();
        return NextResponse.json(data);
      }
    }

    // Return empty if nothing found
    return NextResponse.json(marketId ? null : []);
  } catch (error) {
    console.error('Error fetching agent markets:', error);
    return NextResponse.json({ error: 'Failed to fetch agent markets' }, { status: 500 });
  }
}