/**
 * Index Trading Strategy
 * 
 * Follows SPMC index allocations and rebalances portfolio accordingly.
 * This strategy integrates with the IndexTradingService to maintain
 * portfolio alignment with the target index.
 */

import { elizaLogger } from "@elizaos/core";
import { BaseStrategy } from "./BaseStrategy";
import { MarketOpportunity, MarketData } from "../types";
import { IndexTradingService } from "../../IndexTradingService";

export interface IndexStrategyConfig {
  enabled: boolean;
  indexId: string;
  rebalanceThreshold: number; // Minimum deviation to trigger rebalance (e.g., 0.05 for 5%)
  checkInterval: number; // How often to check for rebalancing needs (minutes)
  maxPositionDeviation: number; // Maximum allowed deviation from target
}

export class IndexStrategy extends BaseStrategy {
  private indexService: IndexTradingService | null = null;
  private lastCheck: Date = new Date(0);

  constructor(config: IndexStrategyConfig) {
    super(
      "IndexStrategy",
      "Follows SPMC index allocations and maintains portfolio alignment",
      config
    );
  }

  async initialize(): Promise<void> {
    if (this.config.enabled) {
      this.indexService = IndexTradingService.getInstance();
      elizaLogger.info(`Index strategy initialized for index: ${(this.config as IndexStrategyConfig).indexId}`);
    }
  }

  async findOpportunities(openPositions: Map<string, any>): Promise<MarketOpportunity[]> {
    const config = this.config as IndexStrategyConfig;
    
    if (!this.isActive() || !this.indexService) {
      return [];
    }

    // Check if enough time has passed since last check
    const now = new Date();
    const minutesSinceLastCheck = (now.getTime() - this.lastCheck.getTime()) / (1000 * 60);
    
    if (minutesSinceLastCheck < config.checkInterval) {
      elizaLogger.debug(`Index strategy: Skipping check, only ${minutesSinceLastCheck.toFixed(1)} minutes since last check`);
      return [];
    }

    this.lastCheck = now;
    elizaLogger.info("Index strategy: Checking for rebalancing opportunities");

    try {
      // Get index status to see if rebalancing is needed
      const indexStatus = await this.indexService.getIndexStatus();
      
      if (!indexStatus || !indexStatus.targetAllocations) {
        elizaLogger.warn("Index strategy: Could not fetch index status");
        return [];
      }

      const opportunities: MarketOpportunity[] = [];

      // Check each target allocation
      for (const target of indexStatus.targetAllocations) {
        const currentPosition = openPositions.get(target.conditionId);
        const currentAllocation = currentPosition ? currentPosition.size : 0;
        const targetAllocation = target.targetShares;
        
        const deviation = Math.abs(targetAllocation - currentAllocation) / (targetAllocation || 1);
        
        // If deviation exceeds threshold, create opportunity
        if (deviation > config.rebalanceThreshold) {
          const market = await this.fetchMarketData(target.conditionId);
          
          if (market) {
            const prices = this.extractPrices(market);
            const needToBuy = targetAllocation > currentAllocation;
            
            opportunities.push({
              marketId: target.conditionId,
              question: market.question,
              outcome: target.outcome as "YES" | "NO",
              currentPrice: prices[0] || 0.5,
              predictedProbability: prices[0] || 0.5, // Index doesn't predict, just follows
              confidence: 0.9, // High confidence for index following
              expectedValue: 0, // Not based on edge, but on index allocation
              newsSignals: [`Index rebalancing: ${needToBuy ? 'BUY' : 'SELL'} to match ${config.indexId} allocation`],
              riskScore: 0.1, // Low risk for index following
            });

            elizaLogger.info(
              `Index opportunity: ${market.question} - ${needToBuy ? 'BUY' : 'SELL'} ${Math.abs(targetAllocation - currentAllocation)} shares`
            );
          }
        }
      }

      // Also check for positions we hold that are no longer in the index
      for (const [conditionId, position] of openPositions) {
        const inIndex = indexStatus.targetAllocations.some((t: any) => t.conditionId === conditionId);
        
        if (!inIndex && position.size > 0) {
          const market = await this.fetchMarketData(conditionId);
          
          if (market) {
            const prices = this.extractPrices(market);
            
            opportunities.push({
              marketId: conditionId,
              question: market.question,
              outcome: position.outcome as "YES" | "NO",
              currentPrice: prices[0] || 0.5,
              predictedProbability: 0, // Sell target
              confidence: 0.95, // Very high confidence to exit non-index positions
              expectedValue: 0,
              newsSignals: [`Index rebalancing: EXIT position not in ${config.indexId}`],
              riskScore: 0.05,
            });

            elizaLogger.info(
              `Index exit opportunity: ${market.question} - SELL entire position (not in index)`
            );
          }
        }
      }

      return opportunities;
    } catch (error) {
      elizaLogger.error(`Index strategy error: ${error}`);
      return [];
    }
  }

  async analyzeMarket(market: MarketData, _config?: any): Promise<MarketOpportunity[]> {
    // Index strategy doesn't analyze individual markets
    // It only follows index allocations
    return [];
  }
}