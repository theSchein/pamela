/**
 * Market Scanner Module
 * 
 * Responsible for discovering and identifying trading opportunities in Polymarket.
 * This module fetches market data and applies various strategies to find profitable trades.
 * 
 * Strategies supported:
 * - Simple Threshold: Trades when prices hit configured buy/sell thresholds
 * - ML-based (planned): Uses machine learning models for opportunity detection
 * 
 * The scanner filters out markets where we already have positions and respects
 * configured market lists for focused trading.
 */

import { elizaLogger } from "@elizaos/core";
import {
  getMarketsToMonitor,
  getSimpleStrategyConfig,
} from "../../config/hardcoded-markets.js";
import { MarketOpportunity, MarketData } from "./types.js";
import { getNewsService, NewsSignal } from "../news/news-service.js";
import { HybridConfidenceScorer } from "../news/hybrid-confidence-scorer.js";

export class MarketScanner {
  private openPositions: Map<string, any>;
  private newsService: any;
  private hybridScorer: HybridConfidenceScorer;

  constructor(openPositions: Map<string, any>) {
    this.openPositions = openPositions;
    this.newsService = getNewsService();
    this.hybridScorer = new HybridConfidenceScorer();
  }

  async findOpportunities(): Promise<MarketOpportunity[]> {
    const simpleConfig = getSimpleStrategyConfig();
    if (simpleConfig.ENABLED && simpleConfig.USE_HARDCODED_ONLY) {
      return this.findSimpleStrategyOpportunities();
    }

    elizaLogger.info("ML-based market scanning not yet implemented with plugin");
    return [];
  }

  private async findSimpleStrategyOpportunities(): Promise<MarketOpportunity[]> {
    const opportunities: MarketOpportunity[] = [];
    const config = getSimpleStrategyConfig();

    try {
      const marketIds = getMarketsToMonitor();
      if (!marketIds || marketIds.length === 0) {
        elizaLogger.warn("No hardcoded markets configured");
        return [];
      }

      elizaLogger.info(
        `Checking ${marketIds.length} hardcoded markets for simple strategy opportunities`
      );

      for (const conditionId of marketIds) {
        if (this.openPositions.has(conditionId)) {
          elizaLogger.debug(
            `Skipping ${conditionId.slice(0, 10)}... - already have position`
          );
          continue;
        }

        const market = await this.fetchMarketData(conditionId);
        if (!market) continue;

        const marketOpportunities = await this.analyzeMarketForOpportunities(
          market,
          config
        );
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

  private async fetchMarketData(conditionId: string): Promise<MarketData | null> {
    try {
      const marketUrl = `https://gamma-api.polymarket.com/markets?condition_ids=${conditionId}`;
      const response = await fetch(marketUrl);

      if (!response.ok) {
        elizaLogger.debug(`Failed to fetch market ${conditionId.slice(0, 10)}...`);
        return null;
      }

      const marketData = (await response.json()) as any[];
      const market = marketData[0];

      if (!market || !market.active) {
        elizaLogger.debug(
          `Market ${conditionId.slice(0, 10)}... not found or inactive`
        );
        return null;
      }

      return {
        id: market.id,
        conditionId: conditionId,
        question: market.question,
        active: market.active,
        outcomes: market.outcomes || '["Yes", "No"]',
        clobTokenIds: market.clobTokenIds || "[]",
        outcomePrices: market.outcomePrices,
        marketMakerData: market.marketMakerData,
        bestBid: market.bestBid,
        bestAsk: market.bestAsk,
        volume: market.volume,
        endDate: market.endDate,
      };
    } catch (error) {
      elizaLogger.error(`Error fetching market ${conditionId}: ${error}`);
      return null;
    }
  }

  private async analyzeMarketForOpportunities(
    market: MarketData,
    config: any
  ): Promise<MarketOpportunity[]> {
    const opportunities: MarketOpportunity[] = [];
    
    elizaLogger.debug(`Analyzing market: ${market.question}`);

    // Get news signals for this market
    let newsSignal: NewsSignal | null = null;
    try {
      newsSignal = await this.newsService.getMarketSignals(market.question);
      if (newsSignal && newsSignal.articles.length > 0) {
        elizaLogger.info(`  Found ${newsSignal.articles.length} news articles for market analysis`);
      }
    } catch (error) {
      elizaLogger.warn(`Failed to get news signals: ${error}`);
    }

    const outcomes = JSON.parse(market.outcomes);
    const prices = this.extractPrices(market);

    for (let i = 0; i < outcomes.length; i++) {
      const outcomeName = outcomes[i].toUpperCase();
      const price = prices[i] || 0.5;

      // Buy when price is BELOW threshold (cheap)
      if (price <= config.BUY_THRESHOLD) {
        const edge = config.BUY_THRESHOLD - price;

        if (edge >= config.MIN_EDGE) {
          // Use hybrid confidence scoring if news is available
          let confidence = 0.8; // Default confidence
          let newsSignalTexts = [`Price edge: ${outcomeName} at ${(price * 100).toFixed(1)}%`];
          let shouldTrade = true;
          
          if (newsSignal && newsSignal.articles.length > 0) {
            const hybridScore = this.hybridScorer.calculateHybridConfidence(
              edge,
              newsSignal,
              outcomeName as "YES" | "NO"
            );
            
            confidence = hybridScore.combinedConfidence;
            shouldTrade = hybridScore.shouldTrade;
            newsSignalTexts.push(hybridScore.reasoning);
            
            // Add article headlines as signals
            hybridScore.supportingArticles.forEach(article => {
              newsSignalTexts.push(`📰 ${article.title}`);
            });
          }

          if (shouldTrade) {
            elizaLogger.info(
              `Hybrid strategy opportunity found: ${market.question}`
            );
            elizaLogger.info(
              `  ${outcomeName} at ${(price * 100).toFixed(1)}% with ${(confidence * 100).toFixed(1)}% confidence`
            );

            opportunities.push({
              marketId: market.conditionId,
              question: market.question,
              outcome: outcomeName as "YES" | "NO",
              currentPrice: price,
              predictedProbability: price + edge,
              confidence: confidence,
              expectedValue: edge * 100 * confidence,
              newsSignals: newsSignalTexts,
              riskScore: 1 - confidence,
            });
          } else {
            elizaLogger.info(
              `Opportunity rejected by hybrid scorer: ${market.question} - ${outcomeName}`
            );
          }
        }
      }

      // Look for NO being cheap (YES being expensive)
      if (outcomeName === "YES" && price >= config.SELL_THRESHOLD) {
        const noPrice = 1 - price;
        const edge = price - config.SELL_THRESHOLD;

        if (edge >= config.MIN_EDGE && noPrice <= config.BUY_THRESHOLD) {
          // Use hybrid confidence scoring if news is available
          let confidence = 0.8; // Default confidence
          let newsSignalTexts = [`Price edge: NO at ${(noPrice * 100).toFixed(1)}% (YES expensive)`];
          let shouldTrade = true;
          
          if (newsSignal && newsSignal.articles.length > 0) {
            const hybridScore = this.hybridScorer.calculateHybridConfidence(
              edge,
              newsSignal,
              "NO"
            );
            
            confidence = hybridScore.combinedConfidence;
            shouldTrade = hybridScore.shouldTrade;
            newsSignalTexts.push(hybridScore.reasoning);
            
            // Add article headlines as signals
            hybridScore.supportingArticles.forEach(article => {
              newsSignalTexts.push(`📰 ${article.title}`);
            });
          }

          if (shouldTrade) {
            elizaLogger.info(
              `Hybrid strategy opportunity found (inverse): ${market.question}`
            );
            elizaLogger.info(
              `  NO at ${(noPrice * 100).toFixed(1)}% with ${(confidence * 100).toFixed(1)}% confidence`
            );

            opportunities.push({
              marketId: market.conditionId,
              question: market.question,
              outcome: "NO",
              currentPrice: noPrice,
              predictedProbability: noPrice + edge,
              confidence: confidence,
              expectedValue: edge * 100 * confidence,
              newsSignals: newsSignalTexts,
              riskScore: 1 - confidence,
            });
          } else {
            elizaLogger.info(
              `Opportunity rejected by hybrid scorer: ${market.question} - NO`
            );
          }
        }
      }
    }

    return opportunities;
  }

  private extractPrices(market: MarketData): number[] {
    let prices: number[] = [];
    
    if (market.outcomePrices) {
      const priceStrings = JSON.parse(market.outcomePrices);
      prices = priceStrings.map((p: string) => parseFloat(p));
    } else if (market.marketMakerData) {
      const mmData = JSON.parse(market.marketMakerData || "{}");
      prices = mmData.prices || [];
    } else if (market.bestBid && market.bestAsk) {
      const bid = parseFloat(market.bestBid || "0.5");
      const ask = parseFloat(market.bestAsk || "0.5");
      prices = [(bid + ask) / 2];
    }

    return prices;
  }

  async getNewsSignals(_question: string): Promise<string[]> {
    // In production, this would query news from database
    // For now, return empty signals
    return [];
  }

  async calculateProbability(
    market: any,
    _newsSignals: string[]
  ): Promise<number> {
    try {
      // In production, this would use the runtime's LLM with a prompt
      // analyzing the market question, prices, volume, and news signals
      const response = market?.outcomes ? "0.5" : "0.5";
      const probability = parseFloat(response.trim());
      return isNaN(probability) ? 0.5 : Math.max(0, Math.min(1, probability));
    } catch (error) {
      elizaLogger.error("Error calculating probability: " + error);
      return 0.5;
    }
  }

  calculateRiskScore(market: any, edgeSize: number): number {
    const volumeRisk = market.volume < 50000 ? 0.3 : 0;
    const timeRisk =
      market.endDate &&
      new Date(market.endDate).getTime() - Date.now() < 86400000
        ? 0.3
        : 0;
    const edgeRisk = edgeSize < 0.1 ? 0.4 : 0;

    return volumeRisk + timeRisk + edgeRisk;
  }
}