// Simple in-memory cache for market data
// This helps reduce API calls and provides fallback data

interface MarketData {
  id: string;
  question: string;
  market_slug: string;
  end_date_iso: string;
  volume: string;
  liquidity: string;
  outcomes: Array<{
    id: string;
    price: number;
    outcome: string;
  }>;
  active: boolean;
  closed: boolean;
  resolved: boolean;
  cached_at: number;
}

class MarketCache {
  private cache: Map<string, MarketData> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  set(marketId: string, data: Omit<MarketData, 'cached_at'>): void {
    this.cache.set(marketId, {
      ...data,
      cached_at: Date.now()
    });
  }

  get(marketId: string): MarketData | null {
    const data = this.cache.get(marketId);
    if (!data) return null;

    // Check if cache is still valid
    if (Date.now() - data.cached_at > this.CACHE_TTL) {
      this.cache.delete(marketId);
      return null;
    }

    return data;
  }

  // Pre-populate with some known markets if needed
  initializeWithKnownMarkets(): void {
    // This can be populated with markets from the agent's database
    // or from a previous successful fetch
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const marketCache = new MarketCache();

// Helper function to get market data with fallback
export async function getMarketWithFallback(
  marketId: string,
  fetchFunction: () => Promise<any>
): Promise<any> {
  // Check cache first
  const cached = marketCache.get(marketId);
  if (cached) {
    return cached;
  }

  try {
    // Try to fetch fresh data
    const data = await fetchFunction();
    if (data) {
      marketCache.set(marketId, data);
      return data;
    }
  } catch (error) {
    console.error(`Failed to fetch market ${marketId}:`, error);
  }

  // Return a basic fallback structure
  return {
    id: marketId,
    question: `Market ${marketId.slice(0, 8)}...`,
    market_slug: marketId,
    end_date_iso: new Date().toISOString(),
    volume: '0',
    liquidity: '0',
    outcomes: [
      { id: '1', price: 0.5, outcome: 'Yes' },
      { id: '2', price: 0.5, outcome: 'No' }
    ],
    active: true,
    closed: false,
    resolved: false
  };
}