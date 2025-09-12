/**
 * Hardcoded markets for testing the trading pipeline
 * These markets are monitored continuously for trading opportunities
 */

// Simply add condition IDs here - all market details will be fetched automatically
// You can find condition IDs from Polymarket URLs:
// https://polymarket.com/event/[slug]?conditionId=0x...
export const HARDCODED_MARKET_IDS: string[] = [
  // Live active markets for testing (low volatility, high liquidity):
  "0x4319532e181605cb15b1bd677759a3bc7f7394b2fdf145195b700eeaedfd5221", // Fed rate hike in 2025? (4.5% Yes, 95.5% No)
  "0xfa48a99317daef1654d5b03e30557c4222f276657275628d9475e141c64b545d", // US recession in 2025? (7.5% Yes, 92.5% No)
  // Add more condition IDs as needed
  // Empty array = scan all markets (original behavior)
];

// Simple trading strategy configuration
export const getSimpleStrategyConfig = () => ({
  // Buy when any outcome is below this price (represents high confidence)
  BUY_THRESHOLD: 0.1, // 10% - buy when something is very cheap (90% confidence on opposite)

  // Sell when any outcome is above this price (take profits)
  SELL_THRESHOLD: 0.9, // 90% - sell when something is very expensive

  // Minimum edge required to place a trade (price difference from threshold)
  MIN_EDGE: 0.02, // 2% minimum edge

  // Position size for test trades (in USDC)
  TEST_POSITION_SIZE: 10, // $10 per trade for testing

  // Enable the simple strategy (overrides ML-based decisions)
  ENABLED: process.env.SIMPLE_STRATEGY_ENABLED === "true",

  // Use hardcoded markets only (ignore market scanning)
  USE_HARDCODED_ONLY: process.env.USE_HARDCODED_MARKETS === "true",
});

export const SIMPLE_STRATEGY_CONFIG = getSimpleStrategyConfig();

/**
 * Get the list of market IDs to monitor
 * Returns hardcoded market IDs if enabled, otherwise returns null to scan all
 */
export function getMarketsToMonitor(): string[] | null {
  const config = getSimpleStrategyConfig();
  if (config.USE_HARDCODED_ONLY && HARDCODED_MARKET_IDS.length > 0) {
    return HARDCODED_MARKET_IDS;
  }
  return null;
}

/**
 * Check if a market is in the hardcoded list
 */
export function isHardcodedMarket(conditionId: string): boolean {
  return HARDCODED_MARKET_IDS.includes(conditionId);
}
