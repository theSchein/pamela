import { useQuery } from '@tanstack/react-query';
import { polymarketService, Position, Market } from '@/lib/services/polymarket';

export function usePositions(address: string | undefined, activeOnly: boolean = false) {
  return useQuery({
    queryKey: ['polymarket', 'positions', address, activeOnly],
    queryFn: async () => {
      if (!address) throw new Error('No wallet address provided');
      const positions = await polymarketService.getPositions(address);
      
      // Enrich positions with market data and P&L
      const enrichedPositions = await Promise.all(
        positions.map(async (position) => {
          const market = await polymarketService.getMarket(position.market_id);
          
          // Calculate P&L if we have market data
          let pnl = { unrealized: 0, realized: 0 };
          if (market && market.outcomes) {
            const outcome = market.outcomes.find(o => 
              o.outcome === position.outcome || 
              o.id === position.token_id?.split('-')[1]
            );
            if (outcome) {
              pnl = await polymarketService.calculatePositionPnl(position, outcome.price);
            }
          }
          
          // Make sure we preserve all original position data including avgPrice
          return {
            ...position,
            avgPrice: position.avgPrice, // Explicitly preserve avgPrice
            size: position.size, // Explicitly preserve size
            market,
            unrealizedPnl: pnl.unrealized,
            realizedPnl: pnl.realized
          };
        })
      );
      
      // Filter for active positions only if requested
      if (activeOnly) {
        return enrichedPositions.filter(pos => {
          // Position is active if market is not resolved and not ended
          if (!pos.market) return true; // Keep if we don't have market data
          
          // Check if market has ended (past end date)
          const hasEnded = pos.market.end_date_iso && 
            new Date(pos.market.end_date_iso) < new Date();
          
          // Active = not resolved and not ended
          return !pos.market.resolved && !hasEnded;
        });
      }
      
      return enrichedPositions;
    },
    enabled: !!address,
  });
}

export function useMarket(marketId: string | undefined) {
  return useQuery({
    queryKey: ['polymarket', 'market', marketId],
    queryFn: async () => {
      if (!marketId) throw new Error('No market ID provided');
      return polymarketService.getMarket(marketId);
    },
    enabled: !!marketId,
  });
}

export function useActiveMarkets() {
  return useQuery({
    queryKey: ['polymarket', 'markets', 'active'],
    queryFn: () => polymarketService.getMarkets(true),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useOpenOrders(address: string | undefined) {
  return useQuery({
    queryKey: ['polymarket', 'orders', address],
    queryFn: async () => {
      if (!address) throw new Error('No wallet address provided');
      return polymarketService.getOpenOrders(address);
    },
    enabled: !!address,
  });
}

export function useTradeHistory(address: string | undefined, limit: number = 50) {
  return useQuery({
    queryKey: ['polymarket', 'trades', address, limit],
    queryFn: async () => {
      if (!address) throw new Error('No wallet address provided');
      return polymarketService.getTradeHistory(address, limit);
    },
    enabled: !!address,
  });
}

export function usePortfolioStats(positions: (Position & { market: Market | null })[] | undefined) {
  return useQuery({
    queryKey: ['portfolio', 'stats', positions?.map(p => p.market_id)],
    queryFn: () => {
      if (!positions) return null;
      
      // Calculate total P&L from individual position P&L
      const unrealizedPnl = positions.reduce((sum, pos) => sum + (pos.unrealizedPnl || 0), 0);
      const realizedPnl = positions.reduce((sum, pos) => sum + (pos.realizedPnl || 0), 0);
      
      // Calculate total value based on current market prices
      const totalValue = positions.reduce((sum, pos) => {
        const size = parseFloat(pos.size);
        // Use current market price if available, otherwise use avg price
        let currentPrice = parseFloat(pos.avgPrice);
        if (pos.market && pos.market.outcomes) {
          const outcome = pos.market.outcomes.find(o => 
            o.outcome === pos.outcome || 
            o.id === pos.token_id?.split('-')[1]
          );
          if (outcome) {
            currentPrice = outcome.price;
          }
        }
        return sum + (size * currentPrice);
      }, 0);
      
      // Filter positions by market status
      const activePositions = positions.filter(p => {
        // Position is active if market is active or not resolved
        return p.market ? (!p.market.resolved && !p.market.closed) : true;
      });
      
      const resolvedPositions = positions.filter(p => {
        return p.market?.resolved === true;
      });
      
      const closedPositions = positions.filter(p => {
        return p.market?.closed === true && !p.market?.resolved;
      });
      
      return {
        pnl: {
          unrealized: unrealizedPnl,
          realized: realizedPnl,
          total: unrealizedPnl + realizedPnl
        },
        totalValue,
        positionCount: positions.length,
        activeCount: activePositions.length,
        resolvedCount: resolvedPositions.length,
        closedCount: closedPositions.length,
        positions
      };
    },
    enabled: !!positions && positions.length > 0,
  });
}