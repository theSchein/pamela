import { useQuery } from '@tanstack/react-query';
import { polymarketService } from '@/lib/services/polymarket';
import type { MarketPosition } from '@/lib/types';

export function useMarketPositions(address: string) {
  return useQuery<MarketPosition[]>({
    queryKey: ['market-positions', address],
    queryFn: async () => {
      const positions = await polymarketService.getPositions(address);
      
      // Map positions to MarketPosition type with P&L calculations
      const marketPositions: MarketPosition[] = await Promise.all(
        positions.map(async (position) => {
          // Get current market data for price
          const market = await polymarketService.getMarket(position.market_id);
          // Find the outcome price from the market
          const outcomePrice = market?.outcomes?.find(o => o.outcome === position.outcome)?.price;
          const currentPrice = outcomePrice || parseFloat(position.avgPrice);
          
          const quantity = parseFloat(position.size);
          const avgPrice = parseFloat(position.avgPrice);
          const currentValue = quantity * currentPrice;
          const costBasis = quantity * avgPrice;
          const pnl = currentValue - costBasis;
          const pnlPercent = costBasis !== 0 ? (pnl / costBasis) * 100 : 0;
          
          return {
            marketId: position.market_id,
            marketQuestion: market?.question || 'Loading...',
            outcome: position.outcome,
            quantity,
            avgPrice,
            currentPrice,
            pnl,
            pnlPercent,
            value: currentValue,
          };
        })
      );
      
      return marketPositions;
    },
    refetchInterval: 15000, // Refetch every 15 seconds
    enabled: !!address && address !== '0x0000000000000000000000000000000000000000',
  });
}