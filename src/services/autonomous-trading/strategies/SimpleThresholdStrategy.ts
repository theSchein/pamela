/**
 * Simple Threshold Trading Strategy
 * 
 * This strategy trades based on simple price thresholds.
 * It buys when prices are below a threshold and sells when above.
 * This is the default strategy for basic autonomous trading.
 */

import { elizaLogger } from "@elizaos/core";
import { BaseStrategy } from "./BaseStrategy";
import { MarketOpportunity, MarketData } from "../types";
import { getNewsService, NewsSignal } from "../../news/news-service";
import { HybridConfidenceScorer } from "../../news/hybrid-confidence-scorer";

export interface SimpleThresholdConfig {
  enabled: boolean;
  buyThreshold: number;  // Buy when price below this (e.g., 0.3)
  sellThreshold: number; // Sell when price above this (e.g., 0.7)
  minEdge: number;       // Minimum edge required to trade
  useHardcodedMarkets: boolean;
  useNewsSignals: boolean;
}

export class SimpleThresholdStrategy extends BaseStrategy {
  private newsService: any;
  private hybridScorer: HybridConfidenceScorer;

  constructor(config: SimpleThresholdConfig) {
    super(
      "SimpleThresholdStrategy",
      "Trades based on simple price thresholds with optional news signals",
      config
    );
    this.newsService = getNewsService();
    this.hybridScorer = new HybridConfidenceScorer();
  }

  async findOpportunities(openPositions: Map<string, any>): Promise<MarketOpportunity[]> {
    if (!this.isActive()) {
      return [];
    }

    const config = this.config as SimpleThresholdConfig;
    const opportunities: MarketOpportunity[] = [];

    try {
      let marketIds: string[] = [];

      if (config.useHardcodedMarkets) {
        const { getMarketsToMonitor } = await import("../../../config/hardcoded-markets.js");
        marketIds = getMarketsToMonitor() || [];
      } else {
        // Could fetch trending markets or use other sources
        marketIds = await this.fetchTrendingMarkets();
      }

      if (!marketIds || marketIds.length === 0) {
        elizaLogger.warn("No markets configured for simple strategy");
        return [];
      }

      elizaLogger.info(
        `Simple strategy: Checking ${marketIds.length} markets for threshold opportunities`
      );

      for (const conditionId of marketIds) {
        if (openPositions.has(conditionId)) {
          elizaLogger.debug(
            `Skipping ${conditionId.slice(0, 10)}... - already have position`
          );
          continue;
        }

        const market = await this.fetchMarketData(conditionId);
        if (!market) continue;

        const marketOpportunities = await this.analyzeMarket(market, config);
        opportunities.push(...marketOpportunities);
      }

      elizaLogger.info(
        `Found ${opportunities.length} simple strategy opportunities`
      );
      return opportunities;
    } catch (error) {
      elizaLogger.error("Error finding simple strategy opportunities: " + error);
      return [];
    }
  }

  async analyzeMarket(market: MarketData, config?: any): Promise<MarketOpportunity[]> {
    const stratConfig = (config || this.config) as SimpleThresholdConfig;
    const opportunities: MarketOpportunity[] = [];
    
    elizaLogger.debug(`Analyzing market: ${market.question}`);

    // Get news signals if enabled
    let newsSignal: NewsSignal | null = null;
    if (stratConfig.useNewsSignals) {
      try {
        newsSignal = await this.newsService.getMarketSignals(market.question);
        if (newsSignal && newsSignal.articles.length > 0) {
          elizaLogger.info(`  Found ${newsSignal.articles.length} news articles for market analysis`);
        }
      } catch (error) {
        elizaLogger.warn(`Failed to get news signals: ${error}`);
      }
    }

    const outcomes = JSON.parse(market.outcomes);
    const prices = this.extractPrices(market);

    for (let i = 0; i < outcomes.length; i++) {
      const outcomeName = outcomes[i].toUpperCase();
      const price = prices[i] || 0.5;

      // Buy when price is BELOW threshold (cheap)
      if (price <= stratConfig.buyThreshold) {
        const edge = stratConfig.buyThreshold - price;

        if (edge >= stratConfig.minEdge) {
          const opportunity = await this.createOpportunity(
            market,
            outcomeName as "YES" | "NO",
            price,
            edge,
            newsSignal,
            false
          );

          if (opportunity) {
            opportunities.push(opportunity);
          }
        }
      }

      // Look for NO being cheap (YES being expensive)
      if (outcomeName === "YES" && price >= stratConfig.sellThreshold) {
        const noPrice = 1 - price;
        const edge = price - stratConfig.sellThreshold;

        if (edge >= stratConfig.minEdge && noPrice <= stratConfig.buyThreshold) {
          const opportunity = await this.createOpportunity(
            market,
            "NO",
            noPrice,
            edge,
            newsSignal,
            true
          );

          if (opportunity) {
            opportunities.push(opportunity);
          }
        }
      }
    }

    return opportunities;
  }

  private async createOpportunity(
    market: MarketData,
    outcome: "YES" | "NO",
    price: number,
    edge: number,
    newsSignal: NewsSignal | null,
    isInverse: boolean
  ): Promise<MarketOpportunity | null> {
    const config = this.config as SimpleThresholdConfig;

    // Use hybrid confidence scoring if news is available
    let confidence = 0.8; // Default confidence
    let newsSignalTexts = [
      isInverse 
        ? `Price edge: NO at ${(price * 100).toFixed(1)}% (YES expensive)`
        : `Price edge: ${outcome} at ${(price * 100).toFixed(1)}%`
    ];
    let shouldTrade = true;
    
    if (newsSignal && newsSignal.articles.length > 0 && config.useNewsSignals) {
      const hybridScore = this.hybridScorer.calculateHybridConfidence(
        edge,
        newsSignal,
        outcome
      );
      
      confidence = hybridScore.combinedConfidence;
      shouldTrade = hybridScore.shouldTrade;
      newsSignalTexts.push(hybridScore.reasoning);
      
      // Add article headlines as signals
      hybridScore.supportingArticles.forEach(article => {
        newsSignalTexts.push(`📰 ${article.title}`);
      });
    }

    if (!shouldTrade) {
      elizaLogger.info(
        `Opportunity rejected by hybrid scorer: ${market.question} - ${outcome}`
      );
      return null;
    }

    elizaLogger.info(
      `Simple strategy opportunity: ${market.question}`
    );
    elizaLogger.info(
      `  ${outcome} at ${(price * 100).toFixed(1)}% with ${(confidence * 100).toFixed(1)}% confidence`
    );

    return {
      marketId: market.conditionId,
      question: market.question,
      outcome: outcome,
      currentPrice: price,
      predictedProbability: price + edge,
      confidence: confidence,
      expectedValue: edge * 100 * confidence,
      newsSignals: newsSignalTexts,
      riskScore: this.calculateRiskScore(market, edge),
    };
  }

  private async fetchTrendingMarkets(): Promise<string[]> {
    try {
      const url = `https://gamma-api.polymarket.com/markets?active=true&closed=false&order=volume&limit=20`;
      const response = await fetch(url);
      
      if (!response.ok) {
        return [];
      }

      const markets = await response.json() as any[];
      return markets
        .filter((m: any) => m.volume > 50000)
        .map((m: any) => m.conditionId)
        .filter(Boolean);
    } catch (error) {
      elizaLogger.error(`Error fetching trending markets: ${error}`);
      return [];
    }
  }
}