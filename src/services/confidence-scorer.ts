import { logger } from "@elizaos/core";
import type { NewsSignal } from "./news-service";

export interface MarketMetrics {
  volume24h: number;
  liquidity: number;
  spread: number;
  volatility: number;
}

export interface ConfidenceFactors {
  newsSentiment: {
    score: number; // 0-1
    weight: number;
    signal: "positive" | "negative" | "neutral";
  };
  marketVolume: {
    score: number; // 0-1
    weight: number;
    level: "high" | "medium" | "low";
  };
  timeToResolution: {
    score: number; // 0-1
    weight: number;
    urgency: "urgent" | "normal" | "distant";
  };
}

export interface ConfidenceResult {
  totalScore: number; // 0-100
  factors: ConfidenceFactors;
  recommendation: "strong_yes" | "yes" | "neutral" | "no" | "strong_no";
  reasoning: string;
}

export class ConfidenceScorerService {
  // Thresholds for market volume classification
  private readonly volumeThresholds = {
    high: 100000, // $100k+ daily volume
    medium: 25000, // $25k-100k daily volume
    low: 5000, // $5k-25k daily volume
  };

  // Time urgency thresholds (in days)
  private readonly timeThresholds = {
    urgent: 7, // Less than 7 days
    normal: 30, // 7-30 days
    distant: 90, // 30+ days
  };

  // Factor weights (must sum to 1.0)
  private readonly defaultWeights = {
    newsSentiment: 0.4, // 40% weight on news
    marketVolume: 0.3, // 30% weight on volume
    timeToResolution: 0.3, // 30% weight on timing
  };

  constructor() {
    logger.info("Confidence Scorer Service initialized");
  }

  /**
   * Calculate overall confidence score for a trading opportunity
   */
  async calculateConfidence(
    newsSignal: NewsSignal | null,
    marketMetrics: MarketMetrics,
    daysUntilResolution: number,
    currentPrice: number,
    predictedProbability?: number,
  ): Promise<ConfidenceResult> {
    // Factor 1: News Sentiment
    const newsSentimentFactor = this.scoreNewsSentiment(newsSignal);

    // Factor 2: Market Volume
    const marketVolumeFactor = this.scoreMarketVolume(marketMetrics.volume24h);

    // Factor 3: Time to Resolution
    const timeToResolutionFactor = this.scoreTimeToResolution(daysUntilResolution);

    // Calculate weighted total score
    const totalScore = Math.round(
      (newsSentimentFactor.score * newsSentimentFactor.weight +
        marketVolumeFactor.score * marketVolumeFactor.weight +
        timeToResolutionFactor.score * timeToResolutionFactor.weight) * 100
    );

    // Generate recommendation based on score and price
    const recommendation = this.generateRecommendation(
      totalScore,
      currentPrice,
      predictedProbability,
      newsSignal?.signal,
    );

    // Generate reasoning
    const reasoning = this.generateReasoning(
      newsSentimentFactor,
      marketVolumeFactor,
      timeToResolutionFactor,
      totalScore,
    );

    return {
      totalScore,
      factors: {
        newsSentiment: newsSentimentFactor,
        marketVolume: marketVolumeFactor,
        timeToResolution: timeToResolutionFactor,
      },
      recommendation,
      reasoning,
    };
  }

  /**
   * Score news sentiment (0-1)
   */
  private scoreNewsSentiment(newsSignal: NewsSignal | null): ConfidenceFactors["newsSentiment"] {
    if (!newsSignal || newsSignal.articles.length === 0) {
      return {
        score: 0.3, // Low confidence without news
        weight: this.defaultWeights.newsSentiment,
        signal: "neutral",
      };
    }

    let score: number;
    let signal: "positive" | "negative" | "neutral";

    switch (newsSignal.signal) {
      case "bullish":
        score = Math.min(0.95, 0.6 + newsSignal.confidence * 0.4);
        signal = "positive";
        break;
      case "bearish":
        score = Math.min(0.95, 0.6 + newsSignal.confidence * 0.4);
        signal = "negative";
        break;
      default:
        score = 0.5;
        signal = "neutral";
    }

    // Boost score if we have multiple confirming articles
    if (newsSignal.articles.length >= 5) {
      score = Math.min(0.95, score * 1.1);
    }

    return {
      score,
      weight: this.defaultWeights.newsSentiment,
      signal,
    };
  }

  /**
   * Score market volume (0-1)
   */
  private scoreMarketVolume(volume24h: number): ConfidenceFactors["marketVolume"] {
    let score: number;
    let level: "high" | "medium" | "low";

    if (volume24h >= this.volumeThresholds.high) {
      score = 0.9;
      level = "high";
    } else if (volume24h >= this.volumeThresholds.medium) {
      score = 0.7;
      level = "medium";
    } else if (volume24h >= this.volumeThresholds.low) {
      score = 0.5;
      level = "low";
    } else {
      score = 0.3; // Very low volume = low confidence
      level = "low";
    }

    return {
      score,
      weight: this.defaultWeights.marketVolume,
      level,
    };
  }

  /**
   * Score time to resolution (0-1)
   * Urgent markets get higher scores (more actionable)
   */
  private scoreTimeToResolution(daysUntilResolution: number): ConfidenceFactors["timeToResolution"] {
    let score: number;
    let urgency: "urgent" | "normal" | "distant";

    if (daysUntilResolution <= this.timeThresholds.urgent) {
      score = 0.9; // Urgent = high confidence (less uncertainty)
      urgency = "urgent";
    } else if (daysUntilResolution <= this.timeThresholds.normal) {
      score = 0.7;
      urgency = "normal";
    } else {
      score = 0.4; // Distant events = lower confidence
      urgency = "distant";
    }

    // Special case: if resolution is today or tomorrow, max confidence
    if (daysUntilResolution <= 1) {
      score = 0.95;
      urgency = "urgent";
    }

    return {
      score,
      weight: this.defaultWeights.timeToResolution,
      urgency,
    };
  }

  /**
   * Generate trading recommendation based on confidence and market conditions
   */
  private generateRecommendation(
    totalScore: number,
    currentPrice: number,
    predictedProbability?: number,
    newsSignal?: "bullish" | "bearish" | "neutral",
  ): ConfidenceResult["recommendation"] {
    // If we have a predicted probability, use it to determine direction
    if (predictedProbability !== undefined) {
      const edge = predictedProbability - currentPrice;
      const absEdge = Math.abs(edge);

      // Strong signal: high confidence + large edge
      if (totalScore >= 80 && absEdge > 0.15) {
        return edge > 0 ? "strong_yes" : "strong_no";
      }

      // Good signal: decent confidence + reasonable edge
      if (totalScore >= 70 && absEdge > 0.08) {
        return edge > 0 ? "yes" : "no";
      }
    }

    // Fall back to news signal if no predicted probability
    if (newsSignal === "bullish" && totalScore >= 70) {
      return totalScore >= 80 ? "strong_yes" : "yes";
    }

    if (newsSignal === "bearish" && totalScore >= 70) {
      return totalScore >= 80 ? "strong_no" : "no";
    }

    // Default to neutral if confidence is too low
    return "neutral";
  }

  /**
   * Generate human-readable reasoning for the confidence score
   */
  private generateReasoning(
    newsSentiment: ConfidenceFactors["newsSentiment"],
    marketVolume: ConfidenceFactors["marketVolume"],
    timeToResolution: ConfidenceFactors["timeToResolution"],
    totalScore: number,
  ): string {
    const parts: string[] = [];

    // News sentiment reasoning
    if (newsSentiment.signal === "positive") {
      parts.push(`Positive news sentiment (${Math.round(newsSentiment.score * 100)}%)`);
    } else if (newsSentiment.signal === "negative") {
      parts.push(`Negative news sentiment (${Math.round(newsSentiment.score * 100)}%)`);
    } else {
      parts.push("Neutral/mixed news sentiment");
    }

    // Market volume reasoning
    if (marketVolume.level === "high") {
      parts.push("high market liquidity");
    } else if (marketVolume.level === "medium") {
      parts.push("moderate market liquidity");
    } else {
      parts.push("low market liquidity");
    }

    // Time urgency reasoning
    if (timeToResolution.urgency === "urgent") {
      parts.push("urgent resolution timeframe");
    } else if (timeToResolution.urgency === "normal") {
      parts.push("reasonable time horizon");
    } else {
      parts.push("distant resolution date");
    }

    // Overall assessment
    const assessment = totalScore >= 80 
      ? "Very high" 
      : totalScore >= 70 
      ? "High" 
      : totalScore >= 50 
      ? "Moderate" 
      : "Low";

    return `${assessment} confidence (${totalScore}/100) based on ${parts.join(", ")}.`;
  }

  /**
   * Quick confidence check for simple yes/no decision
   */
  isConfidentEnough(score: number): boolean {
    const threshold = parseFloat(process.env.MIN_CONFIDENCE_THRESHOLD || "70");
    return score >= threshold;
  }

  /**
   * Adjust confidence based on additional risk factors
   */
  adjustForRisk(
    baseConfidence: number,
    positionSize: number,
    portfolioValue: number,
    existingPositions: number,
  ): number {
    let adjustedConfidence = baseConfidence;

    // Reduce confidence if position is large relative to portfolio
    const positionRatio = positionSize / portfolioValue;
    if (positionRatio > 0.2) {
      adjustedConfidence *= 0.9; // 10% reduction for large positions
    }

    // Reduce confidence if we already have many open positions
    if (existingPositions >= 3) {
      adjustedConfidence *= 0.85; // 15% reduction for portfolio concentration
    }

    // Never exceed 95% confidence
    return Math.min(95, adjustedConfidence);
  }
}

// Singleton instance
let confidenceScorerInstance: ConfidenceScorerService | null = null;

export function getConfidenceScorer(): ConfidenceScorerService {
  if (!confidenceScorerInstance) {
    confidenceScorerInstance = new ConfidenceScorerService();
  }
  return confidenceScorerInstance;
}