// Shared types between frontend and backend

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface Market {
  id: string;
  tokenId: string;
  question: string;
  description?: string;
  outcomes: MarketOutcome[];
  volume: number;
  liquidity: number;
  endDate: Date;
  isActive: boolean;
  category?: string;
  tags?: string[];
}

export interface MarketOutcome {
  id: string;
  name: string;
  price: number;
  probability: number;
}

export interface Position {
  id: string;
  marketId: string;
  outcomeId: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

export interface Order {
  id: string;
  marketId: string;
  outcomeId: string;
  side: 'buy' | 'sell';
  type: 'limit' | 'market';
  price?: number;
  amount: number;
  status: 'pending' | 'filled' | 'cancelled' | 'failed';
  createdAt: Date;
  filledAt?: Date;
}

export interface Portfolio {
  totalValue: number;
  availableBalance: number;
  positions: Position[];
  openOrders: Order[];
  totalPnl: number;
  totalPnlPercent: number;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// WebSocket message types
export interface WsMessage<T = any> {
  type: string;
  payload: T;
  timestamp: Date;
}

export interface MarketUpdatePayload {
  marketId: string;
  updates: Partial<Market>;
}

export interface PriceUpdatePayload {
  marketId: string;
  outcomeId: string;
  price: number;
  timestamp: Date;
}

export interface OrderUpdatePayload {
  order: Order;
  previousStatus?: Order['status'];
}

export interface PositionUpdatePayload {
  position: Position;
  action: 'created' | 'updated' | 'closed';
}