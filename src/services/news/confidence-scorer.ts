import { logger } from "@elizaos/core";
import type { NewsSignal } from "./news-service";
import { 
  ConfidenceConfig, 
  loadConfidenceConfig, 
  getConfidenceBand,
  getVolumeLevel,
  getTimeUrgency,
  getEdgeLevel
} from "./confidence-config";

export interface MarketMetrics {
  volume24h: number;
  liquidity: number;
  spread: number;
  volatility: number;
}

export interface ConfidenceFactors {
  newsSentiment: {
    score: number;
    weight: number;
    signal: "positive" | "negative" | "neutral";
    enabled: boolean;
  };
  marketVolume: {
    score: number;
    weight: number;
    level: "high" | "medium" | "low" | "very_low";
    enabled: boolean;
  };
  timeToResolution: {
    score: number;
    weight: number;
    urgency: "immediate" | "urgent" | "normal" | "distant";
    enabled: boolean;
  };
  [key: string]: {
    score: number;
    weight: number;
    enabled: boolean;
    [key: string]: any;
  };
}

export interface ConfidenceResult {
  totalScore: number;
  factors: ConfidenceFactors;
  recommendation: "strong_yes" | "yes" | "neutral" | "no" | "strong_no";
  reasoning: string;
  confidenceBand: string;
  edgeQuality?: string;
}

export class ConfidenceScorerService {
  private config: ConfidenceConfig;

  constructor(customConfig?: Partial<ConfidenceConfig>) {
    this.config = loadConfidenceConfig(customConfig);
    logger.info("Confidence Scorer Service initialized with custom configuration");
    this.logConfiguration();
  }

  private logConfiguration(): void {
    const enabledFactors = this.config.factorWeights
      .filter(f => f.enabled)
      .map(f => `${f.name}(${(f.weight * 100).toFixed(0)}%)`);
    
    logger.info(`Confidence factors: ${enabledFactors.join(", ")}`);
    logger.info(`Min confidence threshold: ${this.config.settings.minConfidenceThreshold}`);
    logger.info(`Risk adjustment: ${this.config.settings.enableRiskAdjustment ? "enabled" : "disabled"}`);
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
    const factors: ConfidenceFactors = {} as ConfidenceFactors;
    let totalWeightedScore = 0;
    let totalWeight = 0;

    // Process each enabled factor
    for (const factorWeight of this.config.factorWeights) {
      if (!factorWeight.enabled) continue;

      let factorData: any;
      
      switch (factorWeight.name) {
        case "newsSentiment":
          factorData = this.scoreNewsSentiment(newsSignal);
          break;
        case "marketVolume":
          factorData = this.scoreMarketVolume(marketMetrics.volume24h);
          break;
        case "timeToResolution":
          factorData = this.scoreTimeToResolution(daysUntilResolution);
          break;
        default:
          continue;
      }

      factorData.weight = factorWeight.weight;
      factorData.enabled = true;
      factors[factorWeight.name] = factorData;
      
      totalWeightedScore += factorData.score * factorWeight.weight;
      totalWeight += factorWeight.weight;
    }

    // Normalize if weights don't sum to 1
    if (totalWeight > 0) {
      totalWeightedScore = totalWeightedScore / totalWeight;
    }

    const totalScore = Math.round(totalWeightedScore * 100);
    
    // Get confidence band
    const band = getConfidenceBand(totalScore, this.config);
    const confidenceBand = band?.name || "unknown";

    // Generate recommendation
    const recommendation = this.generateRecommendation(
      totalScore,
      currentPrice,
      predictedProbability,
      newsSignal?.signal,
    );

    // Check edge quality if probability is provided
    let edgeQuality: string | undefined;
    if (predictedProbability !== undefined) {
      const edge = predictedProbability - currentPrice;
      const edgeLevel = getEdgeLevel(edge, totalScore, this.config);
      edgeQuality = edgeLevel?.level;
    }

    // Generate reasoning
    const reasoning = this.generateReasoning(factors, totalScore, confidenceBand);

    return {
      totalScore,
      factors,
      recommendation,
      reasoning,
      confidenceBand,
      edgeQuality,
    };
  }

  /**
   * Score news sentiment
   */
  private scoreNewsSentiment(newsSignal: NewsSignal | null): any {
    if (!newsSignal || newsSignal.articles.length === 0) {
      return {
        score: 0.3,
        signal: "neutral",
      };
    }

    let score: number;
    let signal: "positive" | "negative" | "neutral";

    switch (newsSignal.signal) {
      case "bullish":
        score = Math.min(this.config.settings.maxConfidenceScore / 100, 0.6 + newsSignal.confidence * 0.4);
        signal = "positive";
        break;
      case "bearish":
        score = Math.min(this.config.settings.maxConfidenceScore / 100, 0.6 + newsSignal.confidence * 0.4);
        signal = "negative";
        break;
      default:
        score = 0.5;
        signal = "neutral";
    }

    // Boost score if we have multiple confirming articles
    if (newsSignal.articles.length >= 5) {
      score = Math.min(this.config.settings.maxConfidenceScore / 100, score * 1.1);
    }

    return { score, signal };
  }

  /**
   * Score market volume
   */
  private scoreMarketVolume(volume24h: number): any {
    const volumeLevel = getVolumeLevel(volume24h, this.config);
    
    return {
      score: volumeLevel.score,
      level: volumeLevel.level,
    };
  }

  /**
   * Score time to resolution
   */
  private scoreTimeToResolution(daysUntilResolution: number): any {
    const timeUrgency = getTimeUrgency(daysUntilResolution, this.config);
    
    return {
      score: timeUrgency.score,
      urgency: timeUrgency.urgency,
    };
  }

  /**
   * Generate trading recommendation
   */
  private generateRecommendation(
    totalScore: number,
    currentPrice: number,
    predictedProbability?: number,
    newsSignal?: "bullish" | "bearish" | "neutral",
  ): ConfidenceResult["recommendation"] {
    // First check if we have edge-based recommendation
    if (predictedProbability !== undefined) {
      const edge = predictedProbability - currentPrice;
      const edgeLevel = getEdgeLevel(edge, totalScore, this.config);
      
      if (edgeLevel) {
        if (edgeLevel.level === "strong") {
          return edge > 0 ? "strong_yes" : "strong_no";
        } else if (edgeLevel.level === "good") {
          return edge > 0 ? "yes" : "no";
        }
      }
    }

    // Fall back to confidence band recommendation
    const band = getConfidenceBand(totalScore, this.config);
    if (band) {
      // Adjust for news signal direction if available
      if (newsSignal === "bearish" && (band.recommendation === "yes" || band.recommendation === "strong_yes")) {
        // Downgrade bullish recommendation if news is bearish
        return band.recommendation === "strong_yes" ? "yes" : "neutral";
      }
      return band.recommendation;
    }

    return "neutral";
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    factors: ConfidenceFactors,
    totalScore: number,
    confidenceBand: string,
  ): string {
    const parts: string[] = [];

    // Add factor-specific reasoning
    if (factors.newsSentiment?.enabled) {
      const sentiment = factors.newsSentiment;
      if (sentiment.signal === "positive") {
        parts.push(`positive news (${Math.round(sentiment.score * 100)}%)`);
      } else if (sentiment.signal === "negative") {
        parts.push(`negative news (${Math.round(sentiment.score * 100)}%)`);
      } else {
        parts.push("neutral news");
      }
    }

    if (factors.marketVolume?.enabled) {
      const volume = factors.marketVolume;
      const volumeThreshold = this.config.volumeThresholds.find(t => t.level === volume.level);
      if (volumeThreshold) {
        parts.push(volumeThreshold.description.toLowerCase());
      }
    }

    if (factors.timeToResolution?.enabled) {
      const time = factors.timeToResolution;
      const timeThreshold = this.config.timeUrgencyThresholds.find(t => t.urgency === time.urgency);
      if (timeThreshold) {
        parts.push(timeThreshold.description.toLowerCase());
      }
    }

    // Get band description
    const band = this.config.confidenceBands.find(b => b.name === confidenceBand);
    const assessment = band ? band.description : `Confidence score: ${totalScore}/100`;

    return `${assessment} based on ${parts.join(", ")}.`;
  }

  /**
   * Quick confidence check
   */
  isConfidentEnough(score: number): boolean {
    return score >= this.config.settings.minConfidenceThreshold;
  }

  /**
   * Adjust confidence for risk factors
   */
  adjustForRisk(
    baseConfidence: number,
    positionSize: number,
    portfolioValue: number,
    existingPositions: number,
    marketVolatility?: number,
  ): number {
    if (!this.config.settings.enableRiskAdjustment) {
      return baseConfidence;
    }

    let adjustedConfidence = baseConfidence;

    for (const adjustment of this.config.riskAdjustments) {
      let shouldApply = false;

      switch (adjustment.factor) {
        case "large_position":
          shouldApply = (positionSize / portfolioValue) > adjustment.threshold;
          break;
        case "portfolio_concentration":
          shouldApply = existingPositions >= adjustment.threshold;
          break;
        case "high_volatility":
          shouldApply = marketVolatility ? marketVolatility > adjustment.threshold : false;
          break;
        case "low_liquidity":
          // This would need to be passed in or calculated
          break;
      }

      if (shouldApply) {
        adjustedConfidence *= adjustment.adjustment;
        logger.info(`Applied risk adjustment: ${adjustment.description} (${adjustment.adjustment}x)`);
      }
    }

    // Never exceed max confidence
    return Math.min(this.config.settings.maxConfidenceScore, adjustedConfidence);
  }

  /**
   * Update configuration dynamically
   */
  updateConfig(newConfig: Partial<ConfidenceConfig>): void {
    this.config = loadConfidenceConfig({ ...this.config, ...newConfig });
    logger.info("Confidence scorer configuration updated");
    this.logConfiguration();
  }

  /**
   * Get current configuration
   */
  getConfig(): ConfidenceConfig {
    return this.config;
  }

  /**
   * Get recommendation for a specific score
   */
  getRecommendationForScore(score: number): string {
    const band = getConfidenceBand(score, this.config);
    return band ? band.recommendation : "neutral";
  }
}

// Singleton instance
let confidenceScorerInstance: ConfidenceScorerService | null = null;

export function getConfidenceScorer(customConfig?: Partial<ConfidenceConfig>): ConfidenceScorerService {
  if (!confidenceScorerInstance) {
    confidenceScorerInstance = new ConfidenceScorerService(customConfig);
  }
  return confidenceScorerInstance;
}