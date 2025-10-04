/**
 * Strategy Factory
 * 
 * Creates and manages trading strategies based on agent configuration.
 * This factory determines which strategy to use based on the agent's
 * character and environment configuration.
 */

import { elizaLogger } from "@elizaos/core";
import { IStrategy } from "./IStrategy";
import { SimpleThresholdStrategy } from "./SimpleThresholdStrategy";
import { IndexStrategy, IndexStrategyConfig } from "./IndexStrategy";
import { ExpiringMarketsStrategy, ExpiringMarketsConfig } from "./ExpiringMarketsStrategy";
import { InteractiveStrategy, InteractiveStrategyConfig } from "./InteractiveStrategy";

export enum StrategyType {
  SIMPLE_THRESHOLD = "SIMPLE_THRESHOLD",
  INDEX = "INDEX",
  EXPIRING_MARKETS = "EXPIRING_MARKETS",
  INTERACTIVE = "INTERACTIVE",
  HYBRID = "HYBRID" // Can combine multiple strategies
}

export class StrategyFactory {
  private strategies: Map<string, IStrategy> = new Map();

  /**
   * Create strategies based on agent configuration
   */
  async createStrategies(): Promise<IStrategy[]> {
    const activeStrategies: IStrategy[] = [];
    
    // Check environment variables to determine which strategies to enable
    const agentCharacter = process.env.AGENT_CHARACTER || "pamela";
    const enabledStrategies = this.getEnabledStrategies(agentCharacter);

    elizaLogger.info(`Creating strategies for agent: ${agentCharacter}`);
    elizaLogger.info(`Enabled strategies: ${enabledStrategies.join(", ")}`);

    for (const strategyType of enabledStrategies) {
      const strategy = await this.createStrategy(strategyType);
      if (strategy && strategy.isActive()) {
        activeStrategies.push(strategy);
        this.strategies.set(strategy.name, strategy);
      }
    }

    return activeStrategies;
  }

  /**
   * Determine which strategies should be enabled based on agent character
   */
  private getEnabledStrategies(agentCharacter: string): StrategyType[] {
    const strategies: StrategyType[] = [];

    // Check for explicit strategy configuration
    if (process.env.INDEX_TRADING_ENABLED === "true") {
      strategies.push(StrategyType.INDEX);
    }

    if (process.env.SIMPLE_STRATEGY_ENABLED === "true") {
      strategies.push(StrategyType.SIMPLE_THRESHOLD);
    }

    if (process.env.EXPIRING_MARKETS_ENABLED === "true") {
      strategies.push(StrategyType.EXPIRING_MARKETS);
    }

    if (process.env.INTERACTIVE_STRATEGY_ENABLED === "true") {
      strategies.push(StrategyType.INTERACTIVE);
    }

    // Agent-specific defaults if no explicit configuration
    if (strategies.length === 0) {
      switch (agentCharacter.toLowerCase()) {
        case "pamela":
          // Pamela uses interactive strategy by default
          strategies.push(StrategyType.INTERACTIVE);
          break;
        
        case "chalk-eater":
        case "chalk":
          // Chalk uses expiring markets strategy
          strategies.push(StrategyType.EXPIRING_MARKETS);
          break;
        
        case "lib-out":
        case "index-follower":
        case "spmc":
          // Index-following agents
          strategies.push(StrategyType.INDEX);
          break;
        
        case "nothing-ever-happens":
        case "trumped-up":
          // Default agents use simple threshold
          strategies.push(StrategyType.SIMPLE_THRESHOLD);
          break;
        
        default:
          // Default to simple threshold if nothing else specified
          if (process.env.TRADING_ENABLED === "true") {
            strategies.push(StrategyType.SIMPLE_THRESHOLD);
          }
      }
    }

    return strategies;
  }

  /**
   * Create a specific strategy instance
   */
  private async createStrategy(type: StrategyType): Promise<IStrategy | null> {
    try {
      switch (type) {
        case StrategyType.SIMPLE_THRESHOLD:
          return this.createSimpleThresholdStrategy();
        
        case StrategyType.INDEX:
          return await this.createIndexStrategy();
        
        case StrategyType.EXPIRING_MARKETS:
          return this.createExpiringMarketsStrategy();
        
        case StrategyType.INTERACTIVE:
          return this.createInteractiveStrategy();
        
        default:
          elizaLogger.warn(`Unknown strategy type: ${type}`);
          return null;
      }
    } catch (error) {
      elizaLogger.error(`Failed to create strategy ${type}: ${error}`);
      return null;
    }
  }

  private createSimpleThresholdStrategy(): IStrategy {
    const config = {
      enabled: true,
      buyThreshold: Number(process.env.SIMPLE_BUY_THRESHOLD) || 0.3,
      sellThreshold: Number(process.env.SIMPLE_SELL_THRESHOLD) || 0.7,
      minEdge: Number(process.env.SIMPLE_MIN_EDGE) || 0.15,
      useHardcodedMarkets: process.env.USE_HARDCODED_MARKETS === "true",
      useNewsSignals: process.env.USE_NEWS_SIGNALS !== "false",
    };

    return new SimpleThresholdStrategy(config);
  }

  private async createIndexStrategy(): Promise<IStrategy> {
    const config: IndexStrategyConfig = {
      enabled: true,
      indexId: process.env.SPMC_INDEX_ID || "",
      rebalanceThreshold: Number(process.env.INDEX_REBALANCE_THRESHOLD) || 0.05,
      checkInterval: Number(process.env.INDEX_CHECK_INTERVAL) || 60,
      maxPositionDeviation: Number(process.env.INDEX_MAX_DEVIATION) || 0.1,
    };

    const strategy = new IndexStrategy(config);
    await strategy.initialize();
    return strategy;
  }

  private createExpiringMarketsStrategy(): IStrategy {
    const config: ExpiringMarketsConfig = {
      enabled: true,
      minProbability: Number(process.env.EXPIRING_MIN_PROBABILITY) || 0.95,
      maxHoursToExpiry: Number(process.env.EXPIRING_MAX_HOURS) || 48,
      minHoursToExpiry: Number(process.env.EXPIRING_MIN_HOURS) || 2,
      maxPositionSize: Number(process.env.MAX_POSITION_SIZE) || 100,
      minVolume: Number(process.env.EXPIRING_MIN_VOLUME) || 10000,
      checkAllMarkets: process.env.EXPIRING_CHECK_ALL_MARKETS === "true",
    };

    return new ExpiringMarketsStrategy(config);
  }

  private createInteractiveStrategy(): IStrategy {
    const config: InteractiveStrategyConfig = {
      enabled: true,
      useNewsSignals: process.env.USE_NEWS_SIGNALS !== "false", // Default true
      minConfidenceThreshold: Number(process.env.MIN_CONFIDENCE_THRESHOLD) || 0.7,
      priceEdgeThreshold: Number(process.env.INTERACTIVE_PRICE_EDGE) || 0.15,
      volumeThreshold: Number(process.env.INTERACTIVE_MIN_VOLUME) || 50000,
      maxPositionSize: Number(process.env.MAX_POSITION_SIZE) || 100,
      sentimentWeight: Number(process.env.SENTIMENT_WEIGHT) || 0.3,
      priceWeight: Number(process.env.PRICE_WEIGHT) || 0.4,
      volumeWeight: Number(process.env.VOLUME_WEIGHT) || 0.3,
      checkTrendingTopics: process.env.CHECK_TRENDING_TOPICS === "true",
    };

    return new InteractiveStrategy(config);
  }

  /**
   * Get a strategy by name
   */
  getStrategy(name: string): IStrategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * Get all active strategies
   */
  getAllStrategies(): IStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Update configuration for a specific strategy
   */
  updateStrategyConfig(name: string, config: any): boolean {
    const strategy = this.strategies.get(name);
    if (strategy) {
      strategy.updateConfig(config);
      return true;
    }
    return false;
  }
}