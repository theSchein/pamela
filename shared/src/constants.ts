export const POLYMARKET_POLYGON_ADDRESS = '0x4D953115678b15CE0B0396bCF95Db68003f86FB5'
export const USDC_POLYGON_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'

export const MARKET_STATUS = {
  ACTIVE: 'active',
  RESOLVED: 'resolved',
  CANCELED: 'canceled',
} as const

export const ORDER_TYPES = {
  MARKET: 'market',
  LIMIT: 'limit',
} as const

export const TRADE_SIDES = {
  BUY: 'buy',
  SELL: 'sell',
} as const

export const MESSAGE_TYPES = {
  ANALYSIS: 'ANALYSIS',
  TRADE: 'TRADE',
  INFO: 'INFO',
  ERROR: 'ERROR',
} as const

export const TRANSACTION_TYPES = {
  DEPOSIT: 'DEPOSIT',
  WITHDRAWAL: 'WITHDRAWAL',
  TRADE: 'TRADE',
  REDEMPTION: 'REDEMPTION',
} as const

export const DEFAULT_REFRESH_INTERVAL = 10000 // 10 seconds
export const DEFAULT_MAX_POSITION_SIZE = 100 // $100 USDC
export const DEFAULT_MIN_CONFIDENCE = 0.65 // 65% confidence