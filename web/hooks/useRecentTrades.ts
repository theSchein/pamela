import { useQuery } from '@tanstack/react-query';
import { polymarketService } from '@/lib/services/polymarket';
import type { Trade } from '@/lib/types';

export function useRecentTrades(address: string) {
  return useQuery<Trade[]>({
    queryKey: ['recent-trades', address],
    queryFn: async () => {
      const orders = await polymarketService.getOrders(address);
      
      // Transform orders to trades format
      return orders.map(order => ({
        id: order.id,
        marketId: order.marketId,
        marketQuestion: order.marketQuestion || 'Unknown Market',
        side: order.side as 'buy' | 'sell',
        outcome: order.outcome,
        quantity: order.size,
        price: order.price,
        total: order.size * order.price,
        timestamp: order.createdAt,
        status: order.status === 'matched' ? 'filled' as const : 
                order.status === 'cancelled' ? 'cancelled' as const : 
                'pending' as const,
        txHash: order.transactionHash,
      }));
    },
    refetchInterval: 20000, // Refetch every 20 seconds
    enabled: !!address && address !== '0x0000000000000000000000000000000000000000',
  });
}