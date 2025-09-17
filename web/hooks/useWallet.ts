import { useQuery } from '@tanstack/react-query';
import { blockchainService } from '@/lib/services/blockchain';

export function useWalletBalance(address: string | undefined) {
  return useQuery({
    queryKey: ['wallet', 'balance', address],
    queryFn: async () => {
      if (!address) throw new Error('No wallet address provided');
      
      const [usdcBalance, maticBalance] = await Promise.all([
        blockchainService.getUSDCBalance(address),
        blockchainService.getMaticBalance(address)
      ]);
      
      return {
        usdc: usdcBalance,
        matic: maticBalance,
        address
      };
    },
    enabled: !!address,
  });
}

export function useRecentTransactions(address: string | undefined, limit: number = 10) {
  return useQuery({
    queryKey: ['wallet', 'transactions', address, limit],
    queryFn: async () => {
      if (!address) throw new Error('No wallet address provided');
      return blockchainService.getRecentTransactions(address, limit);
    },
    enabled: !!address,
  });
}

export function useBlockNumber() {
  return useQuery({
    queryKey: ['blockchain', 'blockNumber'],
    queryFn: async () => {
      // Block number fetching not yet implemented
      // TODO: Implement getBlockNumber in BlockchainService
      return 0;
    },
    refetchInterval: 5000,
  });
}