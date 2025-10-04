/**
 * Strategy Interface for Autonomous Trading
 * 
 * Defines the contract that all trading strategies must implement.
 * This allows the autonomous trading service to work with different
 * strategies in a uniform way.
 */

import { MarketOpportunity, MarketData } from "../types";

export interface IStrategy {
  /**
   * Strategy name for logging and configuration
   */
  name: string;

  /**
   * Strategy description for documentation
   */
  description: string;

  /**
   * Find trading opportunities using this strategy
   * @param openPositions Map of currently open positions
   * @returns Array of market opportunities found
   */
  findOpportunities(openPositions: Map<string, any>): Promise<MarketOpportunity[]>;

  /**
   * Analyze a single market for opportunities
   * @param market Market data to analyze
   * @param config Strategy-specific configuration
   * @returns Array of opportunities found in this market
   */
  analyzeMarket(market: MarketData, config?: any): Promise<MarketOpportunity[]>;

  /**
   * Check if the strategy should be active at this time
   * @returns True if strategy should run
   */
  isActive(): boolean;

  /**
   * Get strategy-specific configuration
   * @returns Configuration object
   */
  getConfig(): any;

  /**
   * Update strategy configuration dynamically
   * @param config New configuration values
   */
  updateConfig(config: any): void;
}

export interface StrategyConfig {
  enabled: boolean;
  [key: string]: any;
}