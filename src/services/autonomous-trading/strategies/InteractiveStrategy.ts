/**
 * Interactive Trading Strategy (Pamela Agent)
 * 
 * This strategy combines multiple signals including news, market sentiment,
 * and price movements to make trading decisions. It's designed to be more
 * sophisticated and interactive, responding to various market conditions.
 */

import { elizaLogger } from "@elizaos/core";
import { BaseStrategy } from "./BaseStrategy";
import { MarketOpportunity, MarketData } from "../types";
import { getNewsService, NewsSignal } from "../../news/news-service";
import { HybridConfidenceScorer } from "../../news/hybrid-confidence-scorer";

export interface InteractiveStrategyConfig {
  enabled: boolean;
  useNewsSignals: boolean;
  minConfidenceThreshold: number; // Minimum confidence to trade (e.g., 0.7)
  priceEdgeThreshold: number; // Minimum price edge to consider (e.g., 0.15)
  volumeThreshold: number; // Minimum volume for market consideration
  maxPositionSize: number; // Maximum USDC per position
  sentimentWeight: number; // Weight for news sentiment (0-1)
  priceWeight: number; // Weight for price signals (0-1)
  volumeWeight: number; // Weight for volume signals (0-1)
  checkTrendingTopics: boolean; // Monitor trending topics for opportunities
}

export class InteractiveStrategy extends BaseStrategy {
  private newsService: any;
  private hybridScorer: HybridConfidenceScorer;
  private trendingTopics: Set<string> = new Set();

  constructor(config: InteractiveStrategyConfig) {
    super(
      "InteractiveStrategy",
      "Sophisticated multi-signal trading strategy with news and sentiment analysis",
      config
    );
    this.newsService = getNewsService();
    this.hybridScorer = new HybridConfidenceScorer();
  }

  async findOpportunities(openPositions: Map<string, any>): Promise<MarketOpportunity[]> {
    if (!this.isActive()) {
      return [];
    }

    const config = this.config as InteractiveStrategyConfig;
    elizaLogger.info("Interactive strategy: Scanning markets with multi-signal analysis");

    try {
      const opportunities: MarketOpportunity[] = [];
      
      // Get markets to analyze
      const markets = await this.getMarketsToAnalyze(config);
      
      elizaLogger.info(`Analyzing ${markets.length} markets for interactive opportunities`);

      for (const conditionId of markets) {
        // Skip if we already have a position
        if (openPositions.has(conditionId)) {
          continue;
        }

        const market = await this.fetchMarketData(conditionId);
        if (!market) continue;

        const marketOpportunities = await this.analyzeMarket(market, config);
        opportunities.push(...marketOpportunities);
      }

      // Sort by expected value and confidence
      opportunities.sort((a, b) => {
        const scoreA = a.expectedValue * a.confidence;
        const scoreB = b.expectedValue * b.confidence;
        return scoreB - scoreA;
      });

      elizaLogger.info(`Found ${opportunities.length} interactive strategy opportunities`);
      return opportunities.slice(0, 10); // Return top 10 opportunities
    } catch (error) {
      elizaLogger.error(`Interactive strategy error: ${error}`);
      return [];
    }
  }

  async analyzeMarket(market: MarketData, config?: any): Promise<MarketOpportunity[]> {
    const stratConfig = (config || this.config) as InteractiveStrategyConfig;
    const opportunities: MarketOpportunity[] = [];

    // Skip low volume markets
    if (market.volume && market.volume < stratConfig.volumeThreshold) {
      return opportunities;
    }

    // Get news signals if enabled
    let newsSignal: NewsSignal | null = null;
    if (stratConfig.useNewsSignals) {
      try {
        newsSignal = await this.newsService.getMarketSignals(market.question);
      } catch (error) {
        elizaLogger.debug(`Could not fetch news for market: ${error}`);
      }
    }

    const prices = this.extractPrices(market);
    const outcomes = JSON.parse(market.outcomes);

    for (let i = 0; i < outcomes.length; i++) {
      const price = prices[i] || 0.5;
      const outcomeName = outcomes[i].toUpperCase() as "YES" | "NO";

      // Calculate various signals
      const priceSignal = this.calculatePriceSignal(price, outcomeName);
      const volumeSignal = this.calculateVolumeSignal(market.volume || 0);
      const newsSignalScore = newsSignal ? this.calculateNewsSignal(newsSignal, outcomeName) : 0.5;

      // Combine signals with weights
      const combinedScore = 
        (priceSignal * stratConfig.priceWeight) +
        (volumeSignal * stratConfig.volumeWeight) +
        (newsSignalScore * stratConfig.sentimentWeight);

      const normalizedScore = combinedScore / 
        (stratConfig.priceWeight + stratConfig.volumeWeight + stratConfig.sentimentWeight);

      // Calculate edge and confidence
      const edge = Math.abs(normalizedScore - 0.5);
      const shouldBuy = normalizedScore > 0.5;

      if (edge >= stratConfig.priceEdgeThreshold) {
        const confidence = this.calculateConfidence(
          edge,
          newsSignal,
          market.volume || 0,
          priceSignal
        );

        if (confidence >= stratConfig.minConfidenceThreshold) {
          const targetOutcome = shouldBuy ? outcomeName : (outcomeName === "YES" ? "NO" : "YES");
          const targetPrice = shouldBuy ? price : (1 - price);

          const signals = this.buildSignals(
            market,
            targetOutcome,
            priceSignal,
            volumeSignal,
            newsSignalScore,
            newsSignal
          );

          opportunities.push({
            marketId: market.conditionId,
            question: market.question,
            outcome: targetOutcome,
            currentPrice: targetPrice,
            predictedProbability: normalizedScore,
            confidence: confidence,
            expectedValue: edge * 100 * confidence,
            newsSignals: signals,
            riskScore: this.calculateRiskScore(market, edge),
          });

          elizaLogger.info(
            `🎯 Interactive opportunity: ${market.question.slice(0, 50)}...`
          );
          elizaLogger.info(
            `   ${targetOutcome} at ${(targetPrice * 100).toFixed(1)}% | Confidence: ${(confidence * 100).toFixed(1)}% | Score: ${normalizedScore.toFixed(3)}`
          );
        }
      }
    }

    return opportunities;
  }

  private async getMarketsToAnalyze(config: InteractiveStrategyConfig): Promise<string[]> {
    const markets: string[] = [];

    // Start with hardcoded markets
    const { getMarketsToMonitor } = await import("../../../config/hardcoded-markets.js");
    const monitoredMarkets = getMarketsToMonitor() || [];
    markets.push(...monitoredMarkets);

    // Add trending markets if enabled
    if (config.checkTrendingTopics) {
      const trendingMarkets = await this.fetchTrendingMarkets();
      markets.push(...trendingMarkets);
    }

    // Remove duplicates
    return [...new Set(markets)];
  }

  private async fetchTrendingMarkets(): Promise<string[]> {
    try {
      const url = `https://gamma-api.polymarket.com/markets?active=true&closed=false&order=volume&limit=50`;
      const response = await fetch(url);
      
      if (!response.ok) {
        return [];
      }

      const markets = await response.json() as any[];
      return markets
        .filter((m: any) => m.volume > 100000) // High volume markets
        .map((m: any) => m.conditionId)
        .filter(Boolean);
    } catch (error) {
      elizaLogger.error(`Error fetching trending markets: ${error}`);
      return [];
    }
  }

  private calculatePriceSignal(price: number, outcome: "YES" | "NO"): number {
    // Look for price extremes that suggest opportunity
    if (outcome === "YES") {
      if (price < 0.2) return 0.8; // Very cheap YES
      if (price < 0.35) return 0.65; // Moderately cheap YES
      if (price > 0.8) return 0.2; // Very expensive YES
      if (price > 0.65) return 0.35; // Moderately expensive YES
    } else {
      if (price < 0.2) return 0.8; // Very cheap NO
      if (price < 0.35) return 0.65; // Moderately cheap NO
      if (price > 0.8) return 0.2; // Very expensive NO
      if (price > 0.65) return 0.35; // Moderately expensive NO
    }
    return 0.5; // Neutral
  }

  private calculateVolumeSignal(volume: number): number {
    // Higher volume = stronger signal
    if (volume > 1000000) return 0.9;
    if (volume > 500000) return 0.75;
    if (volume > 100000) return 0.6;
    if (volume > 50000) return 0.5;
    return 0.3; // Low volume = weak signal
  }

  private calculateNewsSignal(newsSignal: NewsSignal, outcome: "YES" | "NO"): number {
    if (!newsSignal || newsSignal.articles.length === 0) {
      return 0.5; // Neutral
    }

    // Use sentiment from news articles
    let totalSentiment = 0;
    let articleCount = 0;

    for (const article of newsSignal.articles) {
      if (article.sentiment) {
        // Adjust sentiment based on outcome
        // Handle sentiment as a label or score
        let sentimentScore = 0.5; // neutral default
        if (typeof article.sentiment === 'object' && 'score' in article.sentiment) {
          sentimentScore = (article.sentiment as any).score;
        } else if (article.sentiment === 'positive') {
          sentimentScore = 0.7;
        } else if (article.sentiment === 'negative') {
          sentimentScore = 0.3;
        }
        
        const sentiment = outcome === "YES" ? 
          sentimentScore : 
          (1 - sentimentScore);
        
        totalSentiment += sentiment;
        articleCount++;
      }
    }

    if (articleCount === 0) return 0.5;
    
    return totalSentiment / articleCount;
  }

  private calculateConfidence(
    edge: number,
    newsSignal: NewsSignal | null,
    volume: number,
    priceSignal: number
  ): number {
    let confidence = 0.5; // Base confidence

    // Price edge contribution
    confidence += edge * 0.3;

    // Volume contribution
    if (volume > 500000) confidence += 0.2;
    else if (volume > 100000) confidence += 0.1;

    // News signal contribution
    if (newsSignal && newsSignal.articles.length > 0) {
      confidence += Math.min(newsSignal.articles.length * 0.05, 0.2);
    }

    // Price signal contribution
    if (priceSignal > 0.7 || priceSignal < 0.3) {
      confidence += 0.1; // Strong price signal
    }

    return Math.min(confidence, 0.95); // Cap at 95%
  }

  private buildSignals(
    market: MarketData,
    outcome: string,
    priceSignal: number,
    volumeSignal: number,
    newsScore: number,
    newsSignal: NewsSignal | null
  ): string[] {
    const signals: string[] = [];

    // Add price signal
    signals.push(`Price signal: ${(priceSignal * 100).toFixed(1)}%`);

    // Add volume signal
    signals.push(`Volume: $${((market.volume || 0) / 1000).toFixed(0)}k (signal: ${(volumeSignal * 100).toFixed(0)}%)`);

    // Add news signal
    if (newsSignal && newsSignal.articles.length > 0) {
      signals.push(`News sentiment: ${(newsScore * 100).toFixed(0)}% (${newsSignal.articles.length} articles)`);
      
      // Add top headlines
      newsSignal.articles.slice(0, 2).forEach(article => {
        signals.push(`📰 ${article.title}`);
      });
    }

    // Add market metrics
    if (market.endDate) {
      const hoursToExpiry = (new Date(market.endDate).getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursToExpiry < 168) { // Less than a week
        signals.push(`⏰ Expires in ${hoursToExpiry.toFixed(0)} hours`);
      }
    }

    return signals;
  }
}