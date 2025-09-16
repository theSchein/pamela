export interface Market {
  id: string;
  question: string;
  slug: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  outcomes: string[];
  outcomePrices: number[];
  volume: number;
  liquidity: number;
  startDate: string;
  endDate: string;
  description?: string;
  tags?: string[];
  lastUpdated: string;
}

export interface MarketPosition {
  marketId: string;
  marketQuestion: string;
  outcome: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  value: number;
}

export interface OrderBook {
  bids: Array<{
    price: number;
    size: number;
  }>;
  asks: Array<{
    price: number;
    size: number;
  }>;
  spread: number;
  midPrice: number;
}

export interface Trade {
  id: string;
  marketId: string;
  marketQuestion: string;
  side: 'buy' | 'sell';
  outcome: string;
  quantity: number;
  price: number;
  total: number;
  timestamp: string;
  status: 'pending' | 'filled' | 'cancelled';
  txHash?: string;
}