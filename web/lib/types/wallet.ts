export interface WalletBalance {
  address: string;
  usdc: number;
  matic: number;
  totalValueUSD: number;
  lastUpdated: string;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  token: 'USDC' | 'MATIC';
  type: 'deposit' | 'withdrawal' | 'trade';
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: string;
  blockNumber?: number;
  gasUsed?: string;
}