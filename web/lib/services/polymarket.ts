import axios from 'axios';

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
  private api = axios.create({
    baseURL: '/api/polymarket',
    headers: {
      'Content-Type': 'application/json',
    }
  });

  async getPositions(address: string): Promise<Position[]> {
    try {
      // Try CLOB API first
      const response = await this.api.get(`/positions`, {
        params: { address: address.toLowerCase() }
      });
      
      // If we get positions, validate them
      if (response.data && response.data.length > 0) {
        const positions = response.data.map((pos: any) => ({
          market_id: pos.market_id,
          token_id: pos.token_id,
          outcome: pos.outcome || 'Unknown',
          size: pos.size,
          avgPrice: pos.avgPrice || pos.avg_price || '0',
          unrealizedPnl: pos.unrealizedPnl || pos.unrealized_pnl || 0,
          realizedPnl: pos.realizedPnl || pos.realized_pnl || 0
        }));
        
        // Validate positions - check for suspicious values
        const validPositions = positions.filter((pos: Position) => {
          const size = parseFloat(pos.size);
          const price = parseFloat(pos.avgPrice);
          
          // Flag suspicious positions
          if (size > 1000 && price > 0.5) {
            console.warn('Suspicious position detected:', pos);
            return false; // Filter out clearly wrong positions
          }
          
          return true;
        });
        
        return validPositions;
      }
      
      // Fallback to Gamma API if CLOB fails or returns empty
      console.log('Falling back to Gamma API for positions');
      const gammaResponse = await this.api.get(`/gamma-positions`, {
        params: { address: address.toLowerCase() }
      });
      
      return gammaResponse.data || [];
      
    } catch (error) {
      console.error('Error fetching positions:', error);
      
      // Try Gamma API as final fallback
      try {
        const gammaResponse = await this.api.get(`/gamma-positions`, {
          params: { address: address.toLowerCase() }
        });
        return gammaResponse.data || [];
      } catch (gammaError) {
        console.error('Gamma API also failed:', gammaError);
        return [];
      }
    }
  }

  async getMarket(marketId: string): Promise<Market | null> {
    try {
      const response = await this.api.get(`/markets`, {
        params: { id: marketId }
      });
      const market = response.data;
      
      return {
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
      
      const response = await this.api.get('/markets', { params });
      
      return response.data.map((market: any) => ({
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
      // Note: Order book endpoint still needs direct CLOB access
      // This might need a separate proxy route if CORS issues persist
      const response = await axios.get(`${CLOB_API_URL}/book`, {
        params: {
          token_id: `${marketId}-${outcomeId}`
        }
      });
      
      return {
        market: marketId,
        asset_id: outcomeId,
        bids: response.data.bids || [],
        asks: response.data.asks || [],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching order book:', error);
      return null;
    }
  }

  async getOpenOrders(address: string): Promise<any[]> {
    try {
      const response = await this.api.get(`/orders`, {
        params: {
          address: address.toLowerCase(),
          state: 'OPEN'
        }
      });
      
      return response.data || [];
    } catch (error) {
      console.error('Error fetching open orders:', error);
      return [];
    }
  }

  async getTradeHistory(address: string, limit: number = 50): Promise<any[]> {
    try {
      // Use local proxy API to avoid CORS issues
      const response = await this.api.get('/trades', {
        params: {
          address: address.toLowerCase(),
          limit
        }
      });
      
      return response.data || [];
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
      // If no current price provided, try to fetch it
      if (currentPrice === undefined && position.market_id && position.token_id) {
        // Try to get current market price
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

      // Calculate unrealized P&L
      const unrealized = size * (current - avgPrice);
      
      // Realized P&L should come from trades data
      const realized = position.realizedPnl || 0;

      return { unrealized, realized };
    } catch (error) {
      console.error('Error calculating P&L:', error);
      return { unrealized: 0, realized: 0 };
    }
  }
}

export const polymarketService = new PolymarketService();