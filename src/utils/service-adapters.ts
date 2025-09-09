/**
 * Service Adapters
 * Provides adapter functions to bridge between the existing services and new actions
 */

import { type IAgentRuntime, logger } from "@elizaos/core";
import { NewsService } from "../services/news-service";
import { ConfidenceScorerService } from "../services/confidence-scorer";

// Singleton instances
let newsServiceInstance: NewsService | null = null;
let confidenceScorerInstance: ConfidenceScorerService | null = null;

/**
 * Extended NewsService interface for compatibility
 */
export interface ExtendedNewsService extends NewsService {
  getRelevantNews(topic: string, limit: number): Promise<any[]>;
  getNewsSentiment(topic: string): Promise<'positive' | 'negative' | 'neutral'>;
  getNewsSummary(): Promise<string>;
}

/**
 * Get or create news service instance with extended methods
 */
export function getNewsService(runtime: IAgentRuntime): ExtendedNewsService {
  if (!newsServiceInstance) {
    const apiKey = runtime.getSetting("NEWS_API_KEY");
    newsServiceInstance = new NewsService(apiKey || undefined);
  }
  
  // Add wrapper methods for compatibility
  const extendedService = newsServiceInstance as ExtendedNewsService;
  
  // Add getRelevantNews method
  if (!extendedService.getRelevantNews) {
    extendedService.getRelevantNews = async (topic: string, limit: number) => {
      const articles = topic 
        ? await newsServiceInstance!.searchNews(topic)
        : await newsServiceInstance!.getLatestHeadlines();
      return articles.slice(0, limit);
    };
  }
  
  // Add getNewsSentiment method
  if (!extendedService.getNewsSentiment) {
    extendedService.getNewsSentiment = async (topic: string) => {
      const signal = await newsServiceInstance!.getMarketSignals(topic);
      if (signal.signal === 'bullish') return 'positive';
      if (signal.signal === 'bearish') return 'negative';
      return 'neutral';
    };
  }
  
  // Add getNewsSummary method
  if (!extendedService.getNewsSummary) {
    extendedService.getNewsSummary = async () => {
      const articles = await newsServiceInstance!.getLatestHeadlines();
      if (articles.length === 0) {
        return "No recent market-relevant news available.";
      }
      
      const summary = articles.slice(0, 5).map((article: any, index: number) => 
        `${index + 1}. **${article.title}**\n   ${article.description || "No description available"}\n   Source: ${article.source} | ${new Date(article.publishedAt).toLocaleString()}`
      ).join("\n\n");
      
      return `📰 **Recent Market News**\n\n${summary}`;
    };
  }
  
  return extendedService;
}

/**
 * Get or create confidence scorer instance
 */
export function getConfidenceScorer(runtime: IAgentRuntime): ConfidenceScorerService {
  if (!confidenceScorerInstance) {
    confidenceScorerInstance = new ConfidenceScorerService();
  }
  return confidenceScorerInstance;
}

/**
 * Adapter for market data to match confidence scorer expectations
 */
export interface MarketData {
  id: string;
  question: string;
  description?: string;
  volume24hr?: number;
  liquidityNum?: number;
  endDate?: string;
  currentPrices?: {
    yes: number;
    no: number;
  };
}

/**
 * Adapter for confidence result to match action expectations
 */
export interface ConfidenceResult {
  overall: number;
  factors: {
    newsSentiment: string;
    newsSentimentScore: number;
    marketVolume: string;
    marketVolumeScore: number;
    timeToResolution: string;
    timeToResolutionScore: number;
  };
  recommendation: string;
  reasoning: string;
}

/**
 * Calculate confidence using the existing confidence scorer with adapted interface
 */
export async function calculateMarketConfidence(
  runtime: IAgentRuntime,
  market: MarketData,
  side: 'yes' | 'no'
): Promise<ConfidenceResult> {
  try {
    const confidenceScorer = getConfidenceScorer(runtime);
    const newsService = getNewsService(runtime);
    
    // Get news signal if available
    let newsSignal = null;
    try {
      newsSignal = await newsService.getMarketSignals(market.question);
    } catch (error) {
      logger.warn("Failed to get news signal:", error);
    }
    
    // Calculate days until resolution
    const daysUntilResolution = market.endDate 
      ? Math.max(0, (new Date(market.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 30; // Default to 30 days if no end date
    
    // Get current price for the side
    const currentPrice = side === 'yes' 
      ? (market.currentPrices?.yes || 0.5)
      : (market.currentPrices?.no || 0.5);
    
    // Calculate confidence
    const result = await confidenceScorer.calculateConfidence(
      newsSignal,
      {
        volume24h: market.volume24hr || 0,
        liquidity: market.liquidityNum || 0,
        spread: 0.02, // Default spread
        volatility: 0.1, // Default volatility
      },
      daysUntilResolution,
      currentPrice
    );
    
    // Adapt the result to match expected interface
    return {
      overall: result.totalScore,
      factors: {
        newsSentiment: result.factors.newsSentiment.signal,
        newsSentimentScore: result.factors.newsSentiment.score * 100,
        marketVolume: result.factors.marketVolume.level,
        marketVolumeScore: result.factors.marketVolume.score * 100,
        timeToResolution: result.factors.timeToResolution.urgency,
        timeToResolutionScore: result.factors.timeToResolution.score * 100,
      },
      recommendation: result.recommendation.replace("_", " "),
      reasoning: result.reasoning,
    };
  } catch (error) {
    logger.error("Error calculating market confidence:", error);
    // Return default low confidence result
    return {
      overall: 0,
      factors: {
        newsSentiment: "neutral",
        newsSentimentScore: 50,
        marketVolume: "low",
        marketVolumeScore: 0,
        timeToResolution: "distant",
        timeToResolutionScore: 0,
      },
      recommendation: "skip",
      reasoning: "Unable to calculate confidence due to error",
    };
  }
}