import { useQuery } from '@tanstack/react-query';
import { polymarketService } from '@/lib/services/polymarket';
import type { Trade } from '@/lib/types';

export function useRecentTrades(address: string) {
  return useQuery<Trade[]>({
    queryKey: ['recent-trades', address],
    queryFn: async () => {
      // Get both open orders and trade history
      const [openOrders, tradeHistory] = await Promise.all([
        polymarketService.getOpenOrders(address),
        polymarketService.getTradeHistory(address)
      ]);
      
      // Combine and transform to trades format
      const allOrders = [...openOrders, ...tradeHistory];
      
      return allOrders.map(order => ({
        id: order.id || Math.random().toString(36),
        marketId: order.market || order.marketId || '',
        marketQuestion: order.marketQuestion || 'Unknown Market',
        side: (order.side || order.type || 'buy') as 'buy' | 'sell',
        outcome: order.outcome || 'Yes',
        quantity: parseFloat(order.size || order.amount || '0'),
        price: parseFloat(order.price || '0'),
        total: parseFloat(order.size || order.amount || '0') * parseFloat(order.price || '0'),
        timestamp: order.createdAt || order.timestamp || new Date().toISOString(),
        status: order.status === 'matched' || order.status === 'filled' ? 'filled' as const : 
                order.status === 'cancelled' ? 'cancelled' as const : 
                'pending' as const,
        txHash: order.transactionHash || order.txHash,
      }));
    },
    refetchInterval: 20000, // Refetch every 20 seconds
    enabled: !!address && address !== '0x0000000000000000000000000000000000000000',
  });
}