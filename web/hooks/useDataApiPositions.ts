import { useQuery } from '@tanstack/react-query';

export interface DataApiPosition {
  proxyWallet: string;
  asset: string;
  conditionId: string;
  size: number;
  avgPrice: number;
  initialValue: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  totalBought: number;
  realizedPnl: number;
  percentRealizedPnl: number;
  curPrice: number;
  redeemable: boolean;
  mergeable: boolean;
  title: string;
  slug: string;
  icon: string;
  eventSlug: string;
  outcome: string;
  outcomeIndex: number;
  oppositeOutcome: string;
  oppositeAsset: string;
  endDate: string;
  negativeRisk: boolean;
}

export function useDataApiPositions(address: string | undefined) {
  return useQuery({
    queryKey: ['data-api', 'positions', address],
    queryFn: async () => {
      if (!address) return [];
      
      try {
        const response = await fetch(`/api/polymarket/data-api/positions?address=${address}`);
        if (!response.ok) {
          console.error('Failed to fetch positions:', response.statusText);
          return [];
        }
        
        const data = await response.json();
        
        // Transform the data to match our existing Position interface
        return data.map((pos: any) => ({
          market_id: pos.market_id || pos.conditionId,
          token_id: pos.token_id || pos.asset,
          outcome: pos.outcome,
          size: pos.size?.toString() || '0',
          avgPrice: pos.avgPrice?.toString() || '0',
          unrealizedPnl: pos.unrealizedPnl || pos.cashPnl || 0,
          realizedPnl: pos.realizedPnl || 0,
          percentPnl: pos.percentPnl || 0,
          currentValue: pos.currentValue || 0,
          market: {
            question: pos.title || pos.marketQuestion || 'Unknown Market',
            end_date_iso: pos.endDate,
            active: true,
            resolved: false,
            outcomes: [
              {
                id: pos.outcome,
                price: pos.curPrice || pos.avgPrice || 0,
                outcome: pos.outcome
              }
            ]
          }
        }));
      } catch (error) {
        console.error('Error fetching positions from Data API:', error);
        return [];
      }
    },
    enabled: !!address,
    refetchInterval: 30 * 1000, // Refresh every 30 seconds
  });
}