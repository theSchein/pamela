/**
 * Market Scanner Module (Refactored)
 * 
 * Responsible for discovering and identifying trading opportunities in Polymarket.
 * This refactored version improves code organization and reduces duplication.
 */

import { elizaLogger } from "@elizaos/core";
import {
  getMarketsToMonitor,
  getSimpleStrategyConfig,
} from "../../config/hardcoded-markets.js";
import { MarketOpportunity, MarketData } from "./types.js";
import { getNewsService, NewsSignal } from "../news/news-service.js";
import { HybridConfidenceScorer, HybridConfidenceScore } from "../news/hybrid-confidence-scorer.js";

// Constants
const DEFAULT_CONFIDENCE = 0.8;
const DEFAULT_PRICE = 0.5;
const NEWS_ARTICLE_PREFIX = "📰";

interface PriceOpportunity {
  outcome: "YES" | "NO";
  price: number;
  edge: number;
  isInverse: boolean;
}

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
    elizaLogger.debug(`Analyzing market: ${market.question}`);

    // Fetch news signals once for the market
    const newsSignal = await this.fetchNewsSignals(market.question);
    
    // Identify price opportunities
    const priceOpportunities = this.identifyPriceOpportunities(market, config);
    
    // Evaluate each opportunity with news
    const opportunities: MarketOpportunity[] = [];
    for (const priceOpp of priceOpportunities) {
      const opportunity = await this.evaluateOpportunityWithNews(
        market,
        priceOpp,
        newsSignal,
        config
      );
      
      if (opportunity) {
        opportunities.push(opportunity);
      }
    }

    return opportunities;
  }

  private async fetchNewsSignals(marketQuestion: string): Promise<NewsSignal | null> {
    try {
      const newsSignal = await this.newsService.getMarketSignals(marketQuestion);
      if (newsSignal && newsSignal.articles.length > 0) {
        elizaLogger.info(`  Found ${newsSignal.articles.length} news articles for market analysis`);
      }
      return newsSignal;
    } catch (error) {
      elizaLogger.warn(`Failed to get news signals: ${error}`);
      return null;
    }
  }

  private identifyPriceOpportunities(
    market: MarketData,
    config: any
  ): PriceOpportunity[] {
    const opportunities: PriceOpportunity[] = [];
    const outcomes = JSON.parse(market.outcomes);
    const prices = this.extractPrices(market);

    for (let i = 0; i < outcomes.length; i++) {
      const outcomeName = outcomes[i].toUpperCase();
      const price = prices[i] || DEFAULT_PRICE;

      // Check for cheap YES opportunity
      if (price <= config.BUY_THRESHOLD) {
        const edge = config.BUY_THRESHOLD - price;
        if (edge >= config.MIN_EDGE) {
          opportunities.push({
            outcome: outcomeName as "YES" | "NO",
            price,
            edge,
            isInverse: false
          });
        }
      }

      // Check for cheap NO opportunity (expensive YES)
      if (outcomeName === "YES" && price >= config.SELL_THRESHOLD) {
        const noPrice = 1 - price;
        const edge = price - config.SELL_THRESHOLD;
        
        if (edge >= config.MIN_EDGE && noPrice <= config.BUY_THRESHOLD) {
          opportunities.push({
            outcome: "NO",
            price: noPrice,
            edge,
            isInverse: true
          });
        }
      }
    }

    return opportunities;
  }

  private async evaluateOpportunityWithNews(
    market: MarketData,
    priceOpp: PriceOpportunity,
    newsSignal: NewsSignal | null,
    config: any
  ): Promise<MarketOpportunity | null> {
    // Calculate hybrid confidence
    const hybridResult = this.calculateHybridConfidence(
      priceOpp,
      newsSignal
    );

    if (!hybridResult.shouldTrade) {
      elizaLogger.info(
        `Opportunity rejected by hybrid scorer: ${market.question} - ${priceOpp.outcome}`
      );
      return null;
    }

    // Log the opportunity
    this.logOpportunity(market.question, priceOpp, hybridResult);

    // Build and return the opportunity
    return this.buildOpportunity(
      market,
      priceOpp,
      hybridResult
    );
  }

  private calculateHybridConfidence(
    priceOpp: PriceOpportunity,
    newsSignal: NewsSignal | null
  ): HybridConfidenceScore & { newsSignalTexts: string[] } {
    // Build initial signal texts
    const newsSignalTexts = [this.formatPriceSignal(priceOpp)];
    
    // Default values if no news
    let confidence = DEFAULT_CONFIDENCE;
    let shouldTrade = true;
    let reasoning = "No news available, using price signal only";
    let supportingArticles: any[] = [];

    // Calculate hybrid score if news is available
    if (newsSignal && newsSignal.articles.length > 0) {
      const hybridScore = this.hybridScorer.calculateHybridConfidence(
        priceOpp.edge,
        newsSignal,
        priceOpp.outcome
      );
      
      confidence = hybridScore.combinedConfidence;
      shouldTrade = hybridScore.shouldTrade;
      reasoning = hybridScore.reasoning;
      supportingArticles = hybridScore.supportingArticles;
      
      // Add reasoning and article headlines
      newsSignalTexts.push(reasoning);
      supportingArticles.forEach(article => {
        newsSignalTexts.push(`${NEWS_ARTICLE_PREFIX} ${article.title}`);
      });
    }

    return {
      priceConfidence: confidence,
      newsConfidence: confidence,
      combinedConfidence: confidence,
      shouldTrade,
      reasoning,
      supportingArticles,
      newsSignalTexts
    };
  }

  private formatPriceSignal(priceOpp: PriceOpportunity): string {
    if (priceOpp.isInverse) {
      return `Price edge: NO at ${(priceOpp.price * 100).toFixed(1)}% (YES expensive)`;
    }
    return `Price edge: ${priceOpp.outcome} at ${(priceOpp.price * 100).toFixed(1)}%`;
  }

  private logOpportunity(
    question: string,
    priceOpp: PriceOpportunity,
    hybridResult: any
  ): void {
    const strategyType = priceOpp.isInverse ? "Hybrid strategy opportunity found (inverse)" : "Hybrid strategy opportunity found";
    elizaLogger.info(`${strategyType}: ${question}`);
    elizaLogger.info(
      `  ${priceOpp.outcome} at ${(priceOpp.price * 100).toFixed(1)}% with ${(hybridResult.combinedConfidence * 100).toFixed(1)}% confidence`
    );
  }

  private buildOpportunity(
    market: MarketData,
    priceOpp: PriceOpportunity,
    hybridResult: any
  ): MarketOpportunity {
    return {
      marketId: market.conditionId,
      question: market.question,
      outcome: priceOpp.outcome,
      currentPrice: priceOpp.price,
      predictedProbability: priceOpp.price + priceOpp.edge,
      confidence: hybridResult.combinedConfidence,
      expectedValue: priceOpp.edge * 100 * hybridResult.combinedConfidence,
      newsSignals: hybridResult.newsSignalTexts,
      riskScore: 1 - hybridResult.combinedConfidence,
    };
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