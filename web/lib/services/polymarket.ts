const CLOB_API_URL = process.env.NEXT_PUBLIC_CLOB_URL || 'https://clob.polymarket.com';
const GAMMA_API_URL = 'https://gamma-api.polymarket.com';

export interface Position {
  market_id: string;
  token_id: string;
  outcome: string;
  size: string;
  avgPrice: string;
  unrealizedPnl?: number;
  realizedPnl?: number;
}

export interface Market {
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
}

export interface OrderBook {
  market: string;
  asset_id: string;
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
  timestamp: string;
}

export class PolymarketService {
  // Use local API routes to avoid CORS issues
  private baseURL = '/api/polymarket';
  
  private async fetchAPI(endpoint: string, params?: Record<string, any>) {
    const origin = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.NEXT_PUBLIC_AGENT_API || 'http://localhost:3001';
    const url = new URL(`${origin}${this.baseURL}${endpoint}`);
    if (params) {
      Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    }
    
    const response = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }

  async getPositions(address: string): Promise<Position[]> {
    try {
      const data = await this.fetchAPI('/positions', { address: address.toLowerCase() });
      
      if (data && data.length > 0) {
        const positions = data.map((pos: any) => ({
          market_id: pos.market_id,
          token_id: pos.token_id,
          outcome: pos.outcome || 'Unknown',
          size: pos.size,
          avgPrice: pos.avgPrice || pos.avg_price || '0',
          unrealizedPnl: pos.unrealizedPnl || pos.unrealized_pnl || 0,
          realizedPnl: pos.realizedPnl || pos.realized_pnl || 0
        }));
        
        return positions.filter((pos: Position) => {
          const size = parseFloat(pos.size);
          const price = parseFloat(pos.avgPrice);
          if (size > 1000 && price > 0.5) {
            console.warn('Suspicious position detected:', pos);
            return false;
          }
          return true;
        });
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching positions:', error);
      return [];
    }
  }

  async getMarket(marketId: string): Promise<Market | null> {
    try {
      const data = await this.fetchAPI('/markets', { id: marketId });
      
      if (!data) return null;
      
      return {
        id: data.id,
        question: data.question,
        market_slug: data.market_slug,
        end_date_iso: data.end_date_iso,
        volume: data.volume || '0',
        liquidity: data.liquidity || '0',
        outcomes: data.outcomes || [],
        active: data.active,
        closed: data.closed,
        resolved: data.resolved
      };
    } catch (error) {
      console.error('Error fetching market:', error);
      return null;
    }
  }

  async getMarkets(active?: boolean): Promise<Market[]> {
    try {
      const params: any = {};
      if (active !== undefined) params.active = active;
      
      const data = await this.fetchAPI('/markets', params);
      
      return (data || []).map((market: any) => ({
        id: market.id,
        question: market.question,
        market_slug: market.market_slug,
        end_date_iso: market.end_date_iso,
        volume: market.volume || '0',
        liquidity: market.liquidity || '0',
        outcomes: market.outcomes || [],
        active: market.active,
        closed: market.closed,
        resolved: market.resolved
      }));
    } catch (error) {
      console.error('Error fetching markets:', error);
      return [];
    }
  }

  async getOrderBook(marketId: string, outcomeId: string): Promise<OrderBook | null> {
    try {
      const data = await this.fetchAPI('/book', { token_id: `${marketId}-${outcomeId}` });
      
      return {
        market: marketId,
        asset_id: outcomeId,
        bids: data.bids || [],
        asks: data.asks || [],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching order book:', error);
      return null;
    }
  }

  async getOpenOrders(address: string): Promise<any[]> {
    try {
      const data = await this.fetchAPI('/orders', {
        address: address.toLowerCase(),
        state: 'OPEN'
      });
      
      return data || [];
    } catch (error) {
      console.error('Error fetching open orders:', error);
      return [];
    }
  }

  async getTradeHistory(address: string, limit: number = 50): Promise<any[]> {
    try {
      const data = await this.fetchAPI('/trades', {
        address: address.toLowerCase(),
        limit: limit.toString()
      });
      
      return data || [];
    } catch (error) {
      console.error('Error fetching trade history:', error);
      return [];
    }
  }

  calculateTotalPnl(positions: Position[]): { unrealized: number; realized: number; total: number } {
    const unrealized = positions.reduce((sum, pos) => sum + (pos.unrealizedPnl || 0), 0);
    const realized = positions.reduce((sum, pos) => sum + (pos.realizedPnl || 0), 0);
    
    return {
      unrealized,
      realized,
      total: unrealized + realized
    };
  }

  async calculatePositionPnl(position: Position, currentPrice?: number): Promise<{ unrealized: number; realized: number }> {
    try {
      if (currentPrice === undefined && position.market_id && position.token_id) {
        const market = await this.getMarket(position.market_id);
        if (market && market.outcomes) {
          const outcome = market.outcomes.find(o => 
            o.id === position.token_id || 
            o.outcome === position.outcome
          );
          currentPrice = outcome?.price || 0;
        }
      }

      const size = parseFloat(position.size);
      const avgPrice = parseFloat(position.avgPrice);
      const current = currentPrice || 0;

      const unrealized = size * (current - avgPrice);
      const realized = position.realizedPnl || 0;

      return { unrealized, realized };
    } catch (error) {
      console.error('Error calculating P&L:', error);
      return { unrealized: 0, realized: 0 };
    }
  }
}

export const polymarketService = new PolymarketService();