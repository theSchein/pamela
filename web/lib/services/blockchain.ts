import { ethers } from 'ethers';

const POLYGON_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://polygon-rpc.com';
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'; // USDC on Polygon
const USDC_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private usdcContract: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(POLYGON_RPC_URL);
    this.usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, this.provider);
  }

  async getUSDCBalance(address: string): Promise<string> {
    try {
      const balance = await this.usdcContract.balanceOf(address);
      // USDC has 6 decimals on Polygon - hardcode to avoid decimals() call error
      const decimals = 6;
      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      console.error('Error fetching USDC balance:', error);
      // Return 0 if there's an error
      return '0';
    }
  }

  async getMaticBalance(address: string): Promise<string> {
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error fetching MATIC balance:', error);
      throw error;
    }
  }

  async getRecentTransactions(address: string, limit: number = 10): Promise<any[]> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const maxBlockRange = 50; // Max blocks per request to avoid RPC limits
      const totalBlocksToSearch = 200; // Total blocks to search
      
      let allLogs: ethers.Log[] = [];
      
      // Query in chunks to avoid "Block range is too large" errors
      for (let i = 0; i < Math.ceil(totalBlocksToSearch / maxBlockRange); i++) {
        const toBlock = currentBlock - (i * maxBlockRange);
        const fromBlock = Math.max(0, toBlock - maxBlockRange + 1);
        
        if (toBlock < 0) break;
        
        const filter = {
          address: USDC_ADDRESS,
          topics: [
            ethers.id('Transfer(address,address,uint256)'),
            null,
            ethers.zeroPadValue(address, 32)
          ],
          fromBlock,
          toBlock
        };

        try {
          const logs = await this.provider.getLogs(filter);
          allLogs = [...allLogs, ...logs];
          
          if (allLogs.length >= limit) break;
        } catch (chunkError) {
          console.error(`Error fetching logs for blocks ${fromBlock}-${toBlock}:`, chunkError);
          continue;
        }
      }

      const decimals = 6;

      const transactions = await Promise.all(
        allLogs.slice(-limit).map(async (log) => {
          const block = await this.provider.getBlock(log.blockNumber);
          return {
            hash: log.transactionHash,
            from: ethers.getAddress('0x' + log.topics[1].slice(26)),
            to: ethers.getAddress('0x' + log.topics[2].slice(26)),
            amount: ethers.formatUnits(log.data, decimals),
            timestamp: block?.timestamp || 0,
            blockNumber: log.blockNumber
          };
        })
      );

      return transactions.reverse();
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }
  }

  async getBlockNumber(): Promise<number> {
    return await this.provider.getBlockNumber();
  }

  subscribeToTransfers(address: string, callback: (event: any) => void) {
    const filter = this.usdcContract.filters.Transfer(null, address);
    this.usdcContract.on(filter, (from, to, value, event) => {
      callback({
        from,
        to,
        amount: ethers.formatUnits(value, 6),
        transactionHash: event.log.transactionHash,
        blockNumber: event.log.blockNumber
      });
    });

    return () => {
      this.usdcContract.removeAllListeners(filter);
    };
  }
}

export const blockchainService = new BlockchainService();