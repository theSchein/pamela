/**
 * Opportunity Evaluator Module
 * 
 * Evaluates trading opportunities identified by the MarketScanner and makes
 * the final decision on whether to trade, including position sizing.
 * 
 * Key responsibilities:
 * - Apply confidence thresholds and risk filters
 * - Calculate optimal position sizes using Kelly Criterion
 * - Generate detailed reasoning for trading decisions
 * - Enforce risk management rules (max position size, minimum edge)
 * 
 * The evaluator can be extended with custom position sizing algorithms
 * for different trading strategies.
 */

import { elizaLogger } from "@elizaos/core";
import { TradingConfig } from "../../config/trading-config.js";
import { getSimpleStrategyConfig } from "../../config/hardcoded-markets.js";
import { MarketOpportunity, TradingDecision } from "./types.js";

export class OpportunityEvaluator {
  private tradingConfig: TradingConfig;

  constructor(tradingConfig: TradingConfig) {
    this.tradingConfig = tradingConfig;
  }

  async evaluate(opportunity: MarketOpportunity): Promise<TradingDecision> {
    const simpleConfig = getSimpleStrategyConfig();
    const adjustedSize = simpleConfig.ENABLED
      ? simpleConfig.TEST_POSITION_SIZE
      : this.calculatePositionSize(opportunity);

    // Final confidence check with risk adjustment
    const finalConfidence = opportunity.confidence * (1 - opportunity.riskScore);

    // Override for simple strategy - use hybrid confidence thresholds
    const shouldTrade = simpleConfig.ENABLED
      ? adjustedSize > 0 && opportunity.confidence >= 0.7  // Lower threshold for hybrid strategy
      : finalConfidence >= this.tradingConfig.minConfidenceThreshold &&
        adjustedSize > 0 &&
        opportunity.expectedValue > 5; // Minimum $5 expected value

    const reasoning = this.generateTradingReasoning(opportunity, shouldTrade);

    return {
      shouldTrade,
      marketId: opportunity.marketId,
      outcome: opportunity.outcome,
      size: adjustedSize,
      price: opportunity.currentPrice,
      confidence: finalConfidence,
      reasoning,
    };
  }

  private calculatePositionSize(opportunity: MarketOpportunity): number {
    // Kelly Criterion-inspired sizing
    const edge = Math.abs(
      opportunity.predictedProbability - opportunity.currentPrice
    );
    const kellyFraction = edge / (1 - opportunity.currentPrice);

    // Apply conservative factor and limits
    const conservativeFactor = 0.25; // Use 25% of Kelly
    const rawSize =
      kellyFraction * conservativeFactor * this.tradingConfig.maxPositionSize;

    // Apply risk limit
    const riskAdjustedSize = Math.min(
      rawSize,
      this.tradingConfig.riskLimitPerTrade
    );

    // Round to nearest dollar
    return Math.floor(riskAdjustedSize);
  }

  private generateTradingReasoning(
    opportunity: MarketOpportunity,
    shouldTrade: boolean
  ): string {
    const reasons = [];

    if (shouldTrade) {
      reasons.push(
        `Hybrid confidence: ${(opportunity.confidence * 100).toFixed(1)}%`
      );
      reasons.push(`Expected value: $${opportunity.expectedValue.toFixed(2)}`);

      // Include first news signal which contains our hybrid reasoning
      if (opportunity.newsSignals.length > 0) {
        const hybridReasoning = opportunity.newsSignals.find(s => 
          s.includes("Combined confidence") || s.includes("Price edge")
        );
        if (hybridReasoning) {
          reasons.push(hybridReasoning);
        }
        
        // Count actual news articles (those starting with 📰)
        const articleCount = opportunity.newsSignals.filter(s => s.startsWith("📰")).length;
        if (articleCount > 0) {
          reasons.push(`Supported by ${articleCount} relevant news articles`);
        }
      }

      reasons.push(
        `Price: ${(opportunity.currentPrice * 100).toFixed(1)}% → ${(opportunity.predictedProbability * 100).toFixed(1)}%`
      );
    } else {
      const simpleConfig = getSimpleStrategyConfig();
      const minConfidence = simpleConfig.ENABLED ? 0.7 : this.tradingConfig.minConfidenceThreshold;
      
      if (opportunity.confidence < minConfidence) {
        reasons.push(
          `Confidence below threshold (${(opportunity.confidence * 100).toFixed(1)}% < ${(minConfidence * 100).toFixed(0)}%)`
        );
      }
      if (opportunity.expectedValue <= 5) {
        reasons.push(
          `Expected value too small ($${opportunity.expectedValue.toFixed(2)})`
        );
      }
      if (opportunity.riskScore > 0.5) {
        reasons.push(
          `Risk score too high (${(opportunity.riskScore * 100).toFixed(1)}%)`
        );
      }
    }

    return reasons.join(". ");
  }
}