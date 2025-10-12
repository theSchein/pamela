/**
 * Base Strategy Class
 * 
 * Abstract base class that provides common functionality for all strategies.
 * Extend this class to create new trading strategies.
 */

import { elizaLogger } from "@elizaos/core";
import { IStrategy, StrategyConfig } from "./IStrategy";
import { MarketOpportunity, MarketData } from "../types";

export abstract class BaseStrategy implements IStrategy {
  protected config: StrategyConfig;
  
  constructor(
    public readonly name: string,
    public readonly description: string,
    config: StrategyConfig
  ) {
    this.config = config;
  }

  abstract findOpportunities(openPositions: Map<string, any>): Promise<MarketOpportunity[]>;
  
  abstract analyzeMarket(market: MarketData, config?: any): Promise<MarketOpportunity[]>;

  isActive(): boolean {
    return this.config.enabled;
  }

  getConfig(): StrategyConfig {
    return this.config;
  }

  updateConfig(config: any): void {
    this.config = { ...this.config, ...config };
    elizaLogger.info(`${this.name} strategy config updated: ${JSON.stringify(this.config)}`);
  }

  /**
   * Helper method to fetch market data from Polymarket API
   */
  protected async fetchMarketData(conditionId: string): Promise<MarketData | null> {
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

  /**
   * Helper method to extract prices from market data
   */
  protected extractPrices(market: MarketData): number[] {
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

  /**
   * Helper method to calculate risk score for a market
   */
  protected calculateRiskScore(market: MarketData, edgeSize: number): number {
    const volumeRisk = market.volume && market.volume < 50000 ? 0.3 : 0;
    const timeRisk =
      market.endDate &&
      new Date(market.endDate).getTime() - Date.now() < 86400000
        ? 0.3
        : 0;
    const edgeRisk = edgeSize < 0.1 ? 0.4 : 0;

    return volumeRisk + timeRisk + edgeRisk;
  }
}