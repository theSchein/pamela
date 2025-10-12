/**
 * Expiring Markets Strategy (Chalk Agent)
 * 
 * This strategy targets markets that are about to expire with extremely
 * high probability outcomes (>95%). The strategy assumes these markets
 * have likely resolved in practice and are safe bets for small profits.
 */

import { elizaLogger } from "@elizaos/core";
import { BaseStrategy } from "./BaseStrategy";
import { MarketOpportunity, MarketData } from "../types";

export interface ExpiringMarketsConfig {
  enabled: boolean;
  minProbability: number; // Minimum probability to consider (e.g., 0.95)
  maxHoursToExpiry: number; // Maximum hours until market expires (e.g., 48)
  minHoursToExpiry: number; // Minimum hours to avoid last-minute issues (e.g., 2)
  maxPositionSize: number; // Maximum USDC per position
  minVolume: number; // Minimum market volume to ensure liquidity
  checkAllMarkets: boolean; // Whether to scan all active markets or just monitored ones
}

export class ExpiringMarketsStrategy extends BaseStrategy {
  constructor(config: ExpiringMarketsConfig) {
    super(
      "ExpiringMarketsStrategy",
      "Targets shortly expiring markets with >95% probability outcomes",
      config
    );
  }

  async findOpportunities(openPositions: Map<string, any>): Promise<MarketOpportunity[]> {
    if (!this.isActive()) {
      return [];
    }

    const config = this.config as ExpiringMarketsConfig;
    elizaLogger.info("Expiring markets strategy: Scanning for high-probability expiring markets");

    try {
      const opportunities: MarketOpportunity[] = [];
      let markets: string[] = [];

      if (config.checkAllMarkets) {
        // Fetch all active markets
        markets = await this.fetchActiveMarkets();
      } else {
        // Use monitored markets from config
        const { getMarketsToMonitor } = await import("../../../config/hardcoded-markets.js");
        markets = getMarketsToMonitor() || [];
      }

      elizaLogger.info(`Checking ${markets.length} markets for expiring opportunities`);

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

      elizaLogger.info(`Found ${opportunities.length} expiring market opportunities`);
      return opportunities;
    } catch (error) {
      elizaLogger.error(`Expiring markets strategy error: ${error}`);
      return [];
    }
  }

  async analyzeMarket(market: MarketData, config?: any): Promise<MarketOpportunity[]> {
    const stratConfig = (config || this.config) as ExpiringMarketsConfig;
    const opportunities: MarketOpportunity[] = [];

    // Check if market is expiring soon
    if (!market.endDate) {
      return opportunities;
    }

    const now = Date.now();
    const endTime = new Date(market.endDate).getTime();
    const hoursToExpiry = (endTime - now) / (1000 * 60 * 60);

    // Check expiry window
    if (hoursToExpiry > stratConfig.maxHoursToExpiry || 
        hoursToExpiry < stratConfig.minHoursToExpiry) {
      return opportunities;
    }

    // Check volume requirement
    if (market.volume && market.volume < stratConfig.minVolume) {
      elizaLogger.debug(`Market ${market.question.slice(0, 50)}... has low volume: ${market.volume}`);
      return opportunities;
    }

    const prices = this.extractPrices(market);
    const outcomes = JSON.parse(market.outcomes);

    for (let i = 0; i < outcomes.length; i++) {
      const price = prices[i] || 0.5;
      const outcomeName = outcomes[i].toUpperCase();

      // Look for extremely high probability outcomes
      if (price >= stratConfig.minProbability) {
        const profitMargin = 1.0 - price; // Potential profit if outcome resolves YES
        const expectedReturn = profitMargin * 100; // Percentage return

        // Calculate confidence based on how close to 100% and time to expiry
        const priceConfidence = (price - stratConfig.minProbability) / (1 - stratConfig.minProbability);
        const timeConfidence = 1 - (hoursToExpiry / stratConfig.maxHoursToExpiry);
        const confidence = (priceConfidence + timeConfidence) / 2;

        opportunities.push({
          marketId: market.conditionId,
          question: market.question,
          outcome: outcomeName as "YES" | "NO",
          currentPrice: price,
          predictedProbability: 0.99, // We expect these to resolve YES
          confidence: Math.min(confidence, 0.95), // Cap confidence at 95%
          expectedValue: expectedReturn,
          newsSignals: [
            `Expiring in ${hoursToExpiry.toFixed(1)} hours`,
            `Current price: ${(price * 100).toFixed(1)}%`,
            `Expected return: ${expectedReturn.toFixed(1)}%`
          ],
          riskScore: 1 - price, // Risk inversely proportional to probability
        });

        elizaLogger.info(
          `📈 Expiring opportunity: ${market.question.slice(0, 50)}...`
        );
        elizaLogger.info(
          `   ${outcomeName} at ${(price * 100).toFixed(1)}% | Expires in ${hoursToExpiry.toFixed(1)}h | Return: ${expectedReturn.toFixed(1)}%`
        );
      }

      // Also look for extremely low probability NO outcomes (inverse opportunity)
      if (price <= (1 - stratConfig.minProbability)) {
        const noPrice = 1 - price;
        const profitMargin = 1.0 - noPrice;
        const expectedReturn = profitMargin * 100;

        const priceConfidence = (noPrice - stratConfig.minProbability) / (1 - stratConfig.minProbability);
        const timeConfidence = 1 - (hoursToExpiry / stratConfig.maxHoursToExpiry);
        const confidence = (priceConfidence + timeConfidence) / 2;

        opportunities.push({
          marketId: market.conditionId,
          question: market.question,
          outcome: "NO",
          currentPrice: noPrice,
          predictedProbability: 0.99,
          confidence: Math.min(confidence, 0.95),
          expectedValue: expectedReturn,
          newsSignals: [
            `Expiring in ${hoursToExpiry.toFixed(1)} hours`,
            `NO price: ${(noPrice * 100).toFixed(1)}% (YES at ${(price * 100).toFixed(1)}%)`,
            `Expected return: ${expectedReturn.toFixed(1)}%`
          ],
          riskScore: 1 - noPrice,
        });

        elizaLogger.info(
          `📉 Expiring opportunity (inverse): ${market.question.slice(0, 50)}...`
        );
        elizaLogger.info(
          `   NO at ${(noPrice * 100).toFixed(1)}% | Expires in ${hoursToExpiry.toFixed(1)}h | Return: ${expectedReturn.toFixed(1)}%`
        );
      }
    }

    return opportunities;
  }

  private async fetchActiveMarkets(): Promise<string[]> {
    try {
      // Fetch markets sorted by volume and activity
      const url = `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100`;
      const response = await fetch(url);
      
      if (!response.ok) {
        elizaLogger.error("Failed to fetch active markets");
        return [];
      }

      const markets = await response.json() as any[];
      return markets.map((m: any) => m.conditionId).filter(Boolean);
    } catch (error) {
      elizaLogger.error(`Error fetching active markets: ${error}`);
      return [];
    }
  }
}