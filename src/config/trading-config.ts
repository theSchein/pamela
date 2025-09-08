export interface TradingConfig {
  unsupervisedMode: boolean;
  maxPositionSize: number;
  minConfidenceThreshold: number;
  maxDailyTrades: number;
  maxOpenPositions: number;
  riskLimitPerTrade: number;
  autoRedemptionEnabled: boolean;
  socialBroadcastEnabled: boolean;
  simpleStrategyEnabled: boolean;
  useHardcodedMarkets: boolean;
  tradingHoursRestriction?: {
    startHour: number;
    endHour: number;
    timezone: string;
  };
}

export const DEFAULT_TRADING_CONFIG: TradingConfig = {
  unsupervisedMode: process.env.UNSUPERVISED_MODE === "true",
  maxPositionSize: Number(process.env.MAX_POSITION_SIZE) || 100,
  minConfidenceThreshold: Number(process.env.MIN_CONFIDENCE_THRESHOLD) || 0.7,
  maxDailyTrades: Number(process.env.MAX_DAILY_TRADES) || 10,
  maxOpenPositions: Number(process.env.MAX_OPEN_POSITIONS) || 20,
  riskLimitPerTrade: Number(process.env.RISK_LIMIT_PER_TRADE) || 50,
  autoRedemptionEnabled: process.env.AUTO_REDEMPTION === "true",
  socialBroadcastEnabled: process.env.SOCIAL_BROADCAST === "true",
  simpleStrategyEnabled: process.env.SIMPLE_STRATEGY_ENABLED === "true",
  useHardcodedMarkets: process.env.USE_HARDCODED_MARKETS === "true",
};

export function validateTradingConfig(config: TradingConfig): boolean {
  if (config.minConfidenceThreshold < 0 || config.minConfidenceThreshold > 1) {
    throw new Error("minConfidenceThreshold must be between 0 and 1");
  }
  if (config.maxPositionSize <= 0) {
    throw new Error("maxPositionSize must be positive");
  }
  if (config.maxDailyTrades <= 0) {
    throw new Error("maxDailyTrades must be positive");
  }
  if (
    config.riskLimitPerTrade <= 0 ||
    config.riskLimitPerTrade > config.maxPositionSize
  ) {
    throw new Error(
      "riskLimitPerTrade must be positive and less than maxPositionSize",
    );
  }
  return true;
}
