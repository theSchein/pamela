import { useQuery } from '@tanstack/react-query';
import { blockchainService } from '@/lib/services/blockchain';
import type { WalletBalance } from '@/lib/types';

export function useWalletBalance(address: string) {
  return useQuery<WalletBalance>({
    queryKey: ['wallet-balance', address],
    queryFn: async () => {
      const [usdcBalance, maticBalance] = await Promise.all([
        blockchainService.getUSDCBalance(address),
        blockchainService.getMaticBalance(address),
      ]);

      const usdc = parseFloat(usdcBalance);
      const matic = parseFloat(maticBalance);
      
      return {
        address,
        usdc,
        matic,
        totalValueUSD: usdc + matic * 0.5, // Approximate MATIC price
        lastUpdated: new Date().toISOString(),
      };
    },
    refetchInterval: 10000, // Refetch every 10 seconds
    enabled: !!address && address !== '0x0000000000000000000000000000000000000000',
  });
}