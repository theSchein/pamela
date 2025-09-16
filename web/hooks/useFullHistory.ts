import { useQuery } from '@tanstack/react-query';

export interface HistoryItem {
  id: string;
  type: 'position' | 'closed_position' | 'redemption';
  status: string;
  market_id?: string;
  marketQuestion?: string;
  outcome?: string;
  size?: string;
  avgPrice?: string;
  currentValue?: number;
  unrealizedPnl?: number;
  realizedPnl?: number;
  amount?: string;
  timestamp: string;
}

export interface HistoryStats {
  totalPositions: number;
  totalClosedPositions: number;
  totalRedemptions: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  totalRedeemed: number;
}

export function useFullHistory(address: string | undefined) {
  return useQuery({
    queryKey: ['full-history', address],
    queryFn: async () => {
      if (!address) return { history: [], stats: {} };
      
      try {
        const response = await fetch(`/api/polymarket/data-api/full-history?address=${address}`);
        if (!response.ok) {
          console.error('Failed to fetch full history:', response.statusText);
          return { history: [], stats: {} };
        }
        
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error fetching full history:', error);
        return { history: [], stats: {} };
      }
    },
    enabled: !!address,
    refetchInterval: 30 * 1000, // Refresh every 30 seconds
    retry: 2,
    staleTime: 20 * 1000,
  });
}