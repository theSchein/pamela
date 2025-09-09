/**
 * News and Confidence Scoring Module
 * 
 * This module provides a comprehensive system for aggregating news data
 * and calculating trading confidence scores for prediction markets.
 * 
 * Key Components:
 * - NewsService: Aggregates and analyzes news from multiple sources
 * - ConfidenceScorerService: Calculates multi-factor confidence scores
 * - NewsConfig: Tunable parameters for news categorization and analysis
 * - ConfidenceConfig: Tunable parameters for confidence scoring
 * 
 * The module is designed to be highly configurable, allowing users to:
 * - Add or modify news sources and categories
 * - Adjust confidence thresholds and factor weights
 * - Customize sentiment analysis keywords
 * - Fine-tune risk adjustments
 * 
 * Usage:
 * ```typescript
 * import { getNewsService, getConfidenceScorer } from './services/news';
 * 
 * const newsService = getNewsService();
 * const confidenceScorer = getConfidenceScorer();
 * ```
 */

export * from "./news-service";
export * from "./confidence-scorer";
export * from "./news-config";
export * from "./confidence-config";