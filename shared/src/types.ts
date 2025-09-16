export interface Position {
  id: string
  marketId: string
  marketSlug: string
  marketQuestion: string
  outcome: 'YES' | 'NO'
  quantity: number
  averagePrice: number
  currentPrice?: number
  pnl?: number
  pnlPercent?: number
  timestamp: string
}

export interface Market {
  id: string
  slug: string
  question: string
  description?: string
  endDate: string
  volumeTraded: number
  liquidityVolume?: number
  outcomes: MarketOutcome[]
  active: boolean
  resolved?: boolean
  resolutionOutcome?: 'YES' | 'NO' | 'CANCEL'
}

export interface MarketOutcome {
  name: 'YES' | 'NO'
  price: number
  volume?: number
}

export interface WalletBalance {
  address: string
  usdc: number
  eth?: number
  timestamp: string
}

export interface Transaction {
  hash: string
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRADE' | 'REDEMPTION'
  amount: number
  status: 'PENDING' | 'CONFIRMED' | 'FAILED'
  timestamp: string
  metadata?: Record<string, any>
}

export interface AgentMessage {
  id: string
  type: 'ANALYSIS' | 'TRADE' | 'INFO' | 'ERROR'
  content: string
  metadata?: {
    marketId?: string
    confidence?: number
    action?: string
  }
  timestamp: string
}

export interface PerformanceMetrics {
  totalPositions: number
  winningPositions: number
  losingPositions: number
  winRate: number
  totalPnl: number
  totalVolume: number
  sharpeRatio?: number
  maxDrawdown?: number
}

export interface TradingConfig {
  maxPositionSize: number
  minConfidenceThreshold: number
  tradingEnabled: boolean
  unsupervisedMode: boolean
  maxDailyTrades: number
  maxOpenPositions: number
  riskLimitPerTrade: number
}