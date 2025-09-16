import { useQuery } from '@tanstack/react-query';
import { polymarketService } from '@/lib/services/polymarket';
import type { MarketPosition } from '@/lib/types';

export function useMarketPositions(address: string) {
  return useQuery<MarketPosition[]>({
    queryKey: ['market-positions', address],
    queryFn: async () => {
      const positions = await polymarketService.getPositions(address);
      
      // Calculate P&L for each position
      return positions.map(position => {
        const currentValue = position.quantity * position.currentPrice;
        const costBasis = position.quantity * position.avgPrice;
        const pnl = currentValue - costBasis;
        const pnlPercent = (pnl / costBasis) * 100;
        
        return {
          ...position,
          pnl,
          pnlPercent,
          value: currentValue,
        };
      });
    },
    refetchInterval: 15000, // Refetch every 15 seconds
    enabled: !!address && address !== '0x0000000000000000000000000000000000000000',
  });
}