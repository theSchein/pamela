/**
 * Confidence Scoring Configuration Module
 * 
 * This module defines the configuration structure for the confidence scoring system.
 * It provides a flexible framework for tuning how trading confidence is calculated
 * based on multiple factors including news sentiment, market volume, time urgency,
 * and risk adjustments.
 * 
 * The confidence scorer uses a weighted multi-factor model where each factor
 * contributes to an overall confidence score (0-100), which then maps to
 * trading recommendations.
 */

/**
 * ConfidenceBand Interface
 * Defines score ranges and their corresponding trading recommendations
 * 
 * @property name - Identifier for the confidence band (e.g., "very_high", "low")
 * @property minScore - Minimum score for this band (inclusive)
 * @property maxScore - Maximum score for this band (inclusive)
 * @property recommendation - Trading action recommended for this confidence level
 * @property description - Human-readable explanation of this confidence level
 */
export interface ConfidenceBand {
  name: string;
  minScore: number;
  maxScore: number;
  recommendation: "strong_yes" | "yes" | "neutral" | "no" | "strong_no";
  description: string;
}

/**
 * FactorWeight Interface
 * Controls the relative importance of different confidence factors
 * 
 * @property name - Factor identifier (must match factor calculation methods)
 * @property weight - Relative weight (0-1), enabled weights should sum to 1.0
 * @property enabled - Whether this factor should be included in calculations
 */
export interface FactorWeight {
  name: string;
  weight: number;
  enabled: boolean;
}

/**
 * VolumeThreshold Interface
 * Maps trading volume levels to confidence scores
 * 
 * @property level - Categorical volume level
 * @property minVolume - Minimum 24h volume in USD for this level
 * @property score - Confidence score (0-1) assigned to this volume level
 * @property description - Human-readable description of liquidity implications
 */
export interface VolumeThreshold {
  level: "high" | "medium" | "low" | "very_low";
  minVolume: number;
  score: number;
  description: string;
}

/**
 * TimeUrgencyThreshold Interface
 * Maps time until market resolution to confidence scores
 * 
 * @property urgency - Categorical urgency level
 * @property maxDays - Maximum days until resolution for this level
 * @property score - Confidence score (0-1) assigned to this urgency level
 * @property description - Human-readable description of timing implications
 */
export interface TimeUrgencyThreshold {
  urgency: "immediate" | "urgent" | "normal" | "distant";
  maxDays: number;
  score: number;
  description: string;
}

/**
 * EdgeThreshold Interface
 * Defines minimum edge requirements for different confidence levels
 * 
 * @property level - Quality of the trading edge
 * @property minEdge - Minimum price edge (predicted - current) required
 * @property minConfidence - Minimum confidence score required for this edge level
 * @property description - Human-readable description of the edge quality
 */
export interface EdgeThreshold {
  level: "strong" | "good" | "moderate" | "weak";
  minEdge: number;
  minConfidence: number;
  description: string;
}

/**
 * RiskAdjustment Interface
 * Defines factors that should reduce confidence due to increased risk
 * 
 * @property factor - Risk factor identifier
 * @property threshold - Value above which this adjustment applies
 * @property adjustment - Multiplier applied to confidence (< 1.0 reduces confidence)
 * @property description - Human-readable explanation of the risk factor
 */
export interface RiskAdjustment {
  factor: string;
  threshold: number;
  adjustment: number;
  description: string;
}

/**
 * ConfidenceConfig Interface
 * Main configuration structure for the confidence scoring system
 * 
 * @property confidenceBands - Score ranges and their trading recommendations
 * @property factorWeights - Relative importance of different confidence factors
 * @property volumeThresholds - Volume-based confidence scoring
 * @property timeUrgencyThresholds - Time-based confidence scoring
 * @property edgeThresholds - Minimum edge requirements for trading
 * @property riskAdjustments - Factors that reduce confidence
 * @property settings - Global configuration parameters
 */
export interface ConfidenceConfig {
  confidenceBands: ConfidenceBand[];
  factorWeights: FactorWeight[];
  volumeThresholds: VolumeThreshold[];
  timeUrgencyThresholds: TimeUrgencyThreshold[];
  edgeThresholds: EdgeThreshold[];
  riskAdjustments: RiskAdjustment[];
  settings: {
    minConfidenceThreshold: number;
    maxConfidenceScore: number;
    neutralZoneWidth: number;
    enableRiskAdjustment: boolean;
    enableDynamicWeights: boolean;
  };
}

/**
 * Default Confidence Configuration
 * 
 * This configuration implements a conservative trading strategy that:
 * - Requires high confidence (70+) for positive recommendations
 * - Weighs news sentiment heavily (40% of score)
 * - Favors high-volume, near-term markets
 * - Applies risk adjustments for large positions and portfolio concentration
 * 
 * The scoring model is designed to prevent overtrading by requiring
 * multiple positive signals before recommending trades.
 */
export const defaultConfidenceConfig: ConfidenceConfig = {
  // Confidence bands map scores to trading actions
  // These thresholds can be adjusted to be more or less conservative
  confidenceBands: [
    {
      name: "very_high",
      minScore: 85,
      maxScore: 100,
      recommendation: "strong_yes", // Strong buy signal
      description: "Very high confidence - strong trading signal"
    },
    {
      name: "high",
      minScore: 70,
      maxScore: 84,
      recommendation: "yes", // Buy signal
      description: "High confidence - good trading opportunity"
    },
    {
      name: "moderate",
      minScore: 50,
      maxScore: 69,
      recommendation: "neutral", // No action
      description: "Moderate confidence - consider other factors"
    },
    {
      name: "low",
      minScore: 30,
      maxScore: 49,
      recommendation: "no", // Avoid or sell signal
      description: "Low confidence - avoid trading"
    },
    {
      name: "very_low",
      minScore: 0,
      maxScore: 29,
      recommendation: "strong_no", // Strong sell/avoid signal
      description: "Very low confidence - strong avoid signal"
    }
  ],
  
  // Factor weights control the contribution of each factor to the total score
  // Weights for enabled factors should sum to 1.0 for normalized scoring
  factorWeights: [
    {
      name: "newsSentiment",
      weight: 0.40, // 40% of score from news analysis
      enabled: true
    },
    {
      name: "marketVolume",
      weight: 0.30, // 30% from market liquidity
      enabled: true
    },
    {
      name: "timeToResolution",
      weight: 0.30, // 30% from timing factors
      enabled: true
    },
    {
      name: "technicalIndicators",
      weight: 0.0, // Reserved for future technical analysis
      enabled: false
    },
    {
      name: "socialSentiment",
      weight: 0.0, // Reserved for social media analysis
      enabled: false
    }
  ],
  
  // Volume thresholds determine confidence based on market liquidity
  // Higher volume = more reliable price discovery = higher confidence
  volumeThresholds: [
    {
      level: "high",
      minVolume: 100000, // $100k+ daily volume
      score: 0.90, // 90% confidence contribution
      description: "$100k+ daily volume - excellent liquidity"
    },
    {
      level: "medium",
      minVolume: 25000, // $25k-100k daily volume
      score: 0.70, // 70% confidence contribution
      description: "$25k-100k daily volume - good liquidity"
    },
    {
      level: "low",
      minVolume: 5000, // $5k-25k daily volume
      score: 0.50, // 50% confidence contribution
      description: "$5k-25k daily volume - acceptable liquidity"
    },
    {
      level: "very_low",
      minVolume: 0, // Under $5k daily volume
      score: 0.30, // 30% confidence contribution
      description: "Under $5k daily volume - poor liquidity"
    }
  ],
  
  // Time urgency affects confidence - nearer events are more predictable
  // Immediate events have less uncertainty, distant events more uncertainty
  timeUrgencyThresholds: [
    {
      urgency: "immediate",
      maxDays: 1, // Resolution within 24 hours
      score: 0.95, // 95% confidence contribution
      description: "Resolution within 24 hours - maximum clarity"
    },
    {
      urgency: "urgent",
      maxDays: 7, // Resolution within a week
      score: 0.85, // 85% confidence contribution
      description: "Resolution within a week - high clarity"
    },
    {
      urgency: "normal",
      maxDays: 30, // Resolution within a month
      score: 0.70, // 70% confidence contribution
      description: "Resolution within a month - moderate clarity"
    },
    {
      urgency: "distant",
      maxDays: Infinity, // Resolution beyond a month
      score: 0.40, // 40% confidence contribution
      description: "Resolution beyond a month - low clarity"
    }
  ],
  
  // Edge thresholds define minimum profit margins for different confidence levels
  // Higher confidence required for smaller edges
  edgeThresholds: [
    {
      level: "strong",
      minEdge: 0.15, // 15%+ price difference
      minConfidence: 80, // Requires 80% confidence
      description: "15%+ edge with high confidence"
    },
    {
      level: "good",
      minEdge: 0.08, // 8%+ price difference
      minConfidence: 70, // Requires 70% confidence
      description: "8%+ edge with good confidence"
    },
    {
      level: "moderate",
      minEdge: 0.05, // 5%+ price difference
      minConfidence: 60, // Requires 60% confidence
      description: "5%+ edge with moderate confidence"
    },
    {
      level: "weak",
      minEdge: 0.03, // 3%+ price difference
      minConfidence: 50, // Requires 50% confidence
      description: "3%+ edge - minimum threshold"
    }
  ],
  
  // Risk adjustments reduce confidence when certain risk factors are present
  // These act as safety mechanisms to prevent overleveraging
  riskAdjustments: [
    {
      factor: "large_position",
      threshold: 0.20, // Position > 20% of portfolio
      adjustment: 0.90, // Reduce confidence by 10%
      description: "Position > 20% of portfolio"
    },
    {
      factor: "portfolio_concentration",
      threshold: 3, // 3+ existing positions
      adjustment: 0.85, // Reduce confidence by 15%
      description: "3+ existing positions"
    },
    {
      factor: "high_volatility",
      threshold: 0.30, // Volatility > 30%
      adjustment: 0.92, // Reduce confidence by 8%
      description: "Market volatility > 30%"
    },
    {
      factor: "low_liquidity",
      threshold: 10000, // Volume < $10k
      adjustment: 0.88, // Reduce confidence by 12%
      description: "Volume < $10k"
    },
    {
      factor: "news_uncertainty",
      threshold: 0.5, // Mixed signals threshold
      adjustment: 0.95, // Reduce confidence by 5%
      description: "Mixed news signals"
    }
  ],
  
  // Global settings for the confidence scoring system
  settings: {
    minConfidenceThreshold: 70, // Minimum score to consider trading
    maxConfidenceScore: 95, // Cap confidence at 95% (never 100% certain)
    neutralZoneWidth: 0.05, // ±5% price range considered neutral
    enableRiskAdjustment: true, // Apply risk adjustments
    enableDynamicWeights: false // Allow weights to adapt over time (future feature)
  }
};

/**
 * Load Confidence Configuration
 * 
 * Merges custom configuration with defaults and validates the result.
 * Ensures that factor weights sum to 1.0 for proper normalization.
 * 
 * @param customConfig - Partial configuration to override defaults
 * @returns Complete ConfidenceConfig with validated weights
 * 
 * @example
 * // Make the system more conservative
 * const config = loadConfidenceConfig({
 *   settings: { minConfidenceThreshold: 80 }
 * });
 * 
 * @example
 * // Adjust factor weights
 * const config = loadConfidenceConfig({
 *   factorWeights: [
 *     { name: "newsSentiment", weight: 0.5, enabled: true },
 *     { name: "marketVolume", weight: 0.3, enabled: true },
 *     { name: "timeToResolution", weight: 0.2, enabled: true }
 *   ]
 * });
 */
export function loadConfidenceConfig(customConfig?: Partial<ConfidenceConfig>): ConfidenceConfig {
  // Check for environment variable override
  const envMinConfidence = process.env.MIN_CONFIDENCE_THRESHOLD;
  
  // Merge configurations
  const config = {
    ...defaultConfidenceConfig,
    ...customConfig,
    confidenceBands: customConfig?.confidenceBands || defaultConfidenceConfig.confidenceBands,
    factorWeights: customConfig?.factorWeights || defaultConfidenceConfig.factorWeights,
    volumeThresholds: customConfig?.volumeThresholds || defaultConfidenceConfig.volumeThresholds,
    timeUrgencyThresholds: customConfig?.timeUrgencyThresholds || defaultConfidenceConfig.timeUrgencyThresholds,
    edgeThresholds: customConfig?.edgeThresholds || defaultConfidenceConfig.edgeThresholds,
    riskAdjustments: customConfig?.riskAdjustments || defaultConfidenceConfig.riskAdjustments,
    settings: {
      ...defaultConfidenceConfig.settings,
      ...customConfig?.settings,
      // Environment variable takes precedence
      minConfidenceThreshold: envMinConfidence 
        ? parseFloat(envMinConfidence) 
        : customConfig?.settings?.minConfidenceThreshold || defaultConfidenceConfig.settings.minConfidenceThreshold
    }
  };
  
  // Validate and normalize factor weights
  // Ensures that enabled weights sum to 1.0 for proper scoring
  const enabledWeights = config.factorWeights
    .filter(fw => fw.enabled)
    .reduce((sum, fw) => sum + fw.weight, 0);
  
  if (Math.abs(enabledWeights - 1.0) > 0.001) {
    console.warn(`Factor weights sum to ${enabledWeights}, normalizing to 1.0`);
    const scale = 1.0 / enabledWeights;
    config.factorWeights.forEach(fw => {
      if (fw.enabled) fw.weight *= scale;
    });
  }
  
  return config;
}

/**
 * Get Confidence Band
 * 
 * Finds the confidence band that contains a given score.
 * Used to map numeric scores to categorical recommendations.
 * 
 * @param score - Confidence score (0-100)
 * @param config - Configuration to use
 * @returns The matching confidence band, or undefined if score is out of range
 */
export function getConfidenceBand(score: number, config: ConfidenceConfig): ConfidenceBand | undefined {
  return config.confidenceBands.find(
    band => score >= band.minScore && score <= band.maxScore
  );
}

/**
 * Get Volume Level
 * 
 * Determines the volume threshold category for a given trading volume.
 * Thresholds are checked in descending order of volume.
 * 
 * @param volume - 24-hour trading volume in USD
 * @param config - Configuration to use
 * @returns The matching volume threshold
 */
export function getVolumeLevel(volume: number, config: ConfidenceConfig): VolumeThreshold {
  // Find first threshold where volume exceeds minimum
  for (const threshold of config.volumeThresholds) {
    if (volume >= threshold.minVolume) {
      return threshold;
    }
  }
  // Return lowest threshold if no match (shouldn't happen with minVolume: 0)
  return config.volumeThresholds[config.volumeThresholds.length - 1];
}

/**
 * Get Time Urgency
 * 
 * Determines the urgency category based on days until market resolution.
 * Nearer events have higher urgency and typically higher confidence.
 * 
 * @param days - Days until market resolution
 * @param config - Configuration to use
 * @returns The matching time urgency threshold
 */
export function getTimeUrgency(days: number, config: ConfidenceConfig): TimeUrgencyThreshold {
  // Find first threshold where days is within limit
  for (const threshold of config.timeUrgencyThresholds) {
    if (days <= threshold.maxDays) {
      return threshold;
    }
  }
  // Return most distant threshold if no match
  return config.timeUrgencyThresholds[config.timeUrgencyThresholds.length - 1];
}

/**
 * Get Edge Level
 * 
 * Determines if a price edge meets the minimum requirements for trading
 * based on the edge size and current confidence level.
 * 
 * @param edge - Price edge (predicted - current price)
 * @param confidence - Current confidence score
 * @param config - Configuration to use
 * @returns The matching edge threshold, or undefined if requirements not met
 */
export function getEdgeLevel(edge: number, confidence: number, config: ConfidenceConfig): EdgeThreshold | undefined {
  const absEdge = Math.abs(edge);
  // Check thresholds in order of quality (best first)
  for (const threshold of config.edgeThresholds) {
    if (absEdge >= threshold.minEdge && confidence >= threshold.minConfidence) {
      return threshold;
    }
  }
  return undefined;
}