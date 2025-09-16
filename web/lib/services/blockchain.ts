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

  // Transaction history is now fetched from Polymarket's API
  // These methods are kept for potential future use but return empty data
  async getRecentTransactions(address: string, limit: number = 10): Promise<any[]> {
    return [];
  }
}

export const blockchainService = new BlockchainService();