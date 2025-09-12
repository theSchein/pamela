import { useQuery } from '@tanstack/react-query';
import { polymarketService, Position, Market } from '@/lib/services/polymarket';

export function usePositions(address: string | undefined) {
  return useQuery({
    queryKey: ['polymarket', 'positions', address],
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
      
      const pnl = polymarketService.calculateTotalPnl(positions);
      const totalValue = positions.reduce((sum, pos) => {
        const size = parseFloat(pos.size);
        const price = parseFloat(pos.avgPrice);
        return sum + (size * price);
      }, 0);
      
      const activePositions = positions.filter(p => p.market?.active);
      const resolvedPositions = positions.filter(p => p.market?.resolved);
      
      return {
        pnl,
        totalValue,
        positionCount: positions.length,
        activeCount: activePositions.length,
        resolvedCount: resolvedPositions.length,
        positions
      };
    },
    enabled: !!positions && positions.length > 0,
  });
}