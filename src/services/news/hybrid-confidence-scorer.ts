import { elizaLogger } from "@elizaos/core";
import { NewsSignal, NewsArticle } from "./news-service";

export interface HybridConfidenceScore {
  priceConfidence: number;      // Confidence from price edge (0-1)
  newsConfidence: number;        // Confidence from news signals (0-1)
  combinedConfidence: number;    // Final hybrid confidence (0-1)
  shouldTrade: boolean;          // Whether to execute trade
  reasoning: string;             // Explanation of decision
  supportingArticles: NewsArticle[];  // Top supporting news articles
}

export class HybridConfidenceScorer {
  private readonly MIN_PRICE_CONFIDENCE = 0.6;  // Minimum confidence from price alone
  private readonly MIN_NEWS_CONFIDENCE = 0.5;   // Minimum confidence from news alone
  private readonly MIN_COMBINED_CONFIDENCE = 0.7; // Minimum combined confidence to trade
  private readonly NEWS_WEIGHT = 0.4;           // Weight of news in final score (40%)
  private readonly PRICE_WEIGHT = 0.6;          // Weight of price in final score (60%)

  /**
   * Calculate hybrid confidence score combining price edge and news signals
   * 
   * @param priceEdge The price difference from threshold (0.02 = 2% edge)
   * @param newsSignal News analysis results for the market
   * @param outcome The outcome being considered (YES/NO)
   * @returns Hybrid confidence score and trading decision
   */
  calculateHybridConfidence(
    priceEdge: number,
    newsSignal: NewsSignal,
    outcome: "YES" | "NO"
  ): HybridConfidenceScore {
    // Calculate price-based confidence (higher edge = higher confidence)
    const priceConfidence = this.calculatePriceConfidence(priceEdge);
    
    // Calculate news-based confidence
    const newsConfidence = this.calculateNewsConfidence(newsSignal, outcome);
    
    // Combine scores with weighting
    let combinedConfidence = 
      (priceConfidence * this.PRICE_WEIGHT) + 
      (newsConfidence * this.NEWS_WEIGHT);
    
    // Apply bonus/penalty based on alignment
    combinedConfidence = this.applyAlignmentAdjustment(
      combinedConfidence,
      priceConfidence,
      newsConfidence,
      newsSignal.signal
    );
    
    // Determine if we should trade
    const shouldTrade = this.evaluateTradingDecision(
      priceConfidence,
      newsConfidence,
      combinedConfidence,
      newsSignal.articles.length
    );
    
    // Generate reasoning
    const reasoning = this.generateReasoning(
      priceEdge,
      priceConfidence,
      newsConfidence,
      combinedConfidence,
      newsSignal,
      outcome,
      shouldTrade
    );
    
    elizaLogger.info(`Hybrid confidence for ${outcome}: ${(combinedConfidence * 100).toFixed(1)}%`);
    elizaLogger.info(`  Price confidence: ${(priceConfidence * 100).toFixed(1)}%, News confidence: ${(newsConfidence * 100).toFixed(1)}%`);
    
    return {
      priceConfidence,
      newsConfidence,
      combinedConfidence,
      shouldTrade,
      reasoning,
      supportingArticles: newsSignal.articles.slice(0, 3)
    };
  }
  
  private calculatePriceConfidence(priceEdge: number): number {
    // Convert price edge to confidence (0.02 edge = 60% confidence, 0.10 edge = 90% confidence)
    const baseConfidence = 0.5; // Start at 50%
    const edgeMultiplier = 4;   // Each 1% edge adds 4% confidence
    
    const confidence = baseConfidence + (priceEdge * edgeMultiplier);
    return Math.min(0.95, Math.max(0, confidence));
  }
  
  private calculateNewsConfidence(newsSignal: NewsSignal, outcome: "YES" | "NO"): number {
    // No news = neutral confidence
    if (newsSignal.articles.length === 0) {
      return 0.5;
    }
    
    // Check if news signal aligns with the outcome we're considering
    const signalAlignment = this.checkSignalAlignment(newsSignal.signal, outcome);
    
    if (signalAlignment === "aligned") {
      // News supports our position
      return newsSignal.confidence;
    } else if (signalAlignment === "opposed") {
      // News opposes our position - invert confidence
      return 1 - newsSignal.confidence;
    } else {
      // Neutral news
      return 0.5;
    }
  }
  
  private checkSignalAlignment(
    signal: "bullish" | "bearish" | "neutral",
    outcome: "YES" | "NO"
  ): "aligned" | "opposed" | "neutral" {
    if (signal === "neutral") return "neutral";
    
    // Bullish news supports YES, opposes NO
    if (signal === "bullish") {
      return outcome === "YES" ? "aligned" : "opposed";
    }
    
    // Bearish news supports NO, opposes YES
    if (signal === "bearish") {
      return outcome === "NO" ? "aligned" : "opposed";
    }
    
    return "neutral";
  }
  
  private applyAlignmentAdjustment(
    combinedConfidence: number,
    priceConfidence: number,
    newsConfidence: number,
    newsSignal: "bullish" | "bearish" | "neutral"
  ): number {
    // Strong alignment bonus (both signals strong and aligned)
    if (priceConfidence > 0.7 && newsConfidence > 0.7) {
      combinedConfidence *= 1.1; // 10% bonus
      elizaLogger.info("  Applied 10% alignment bonus for strong agreement");
    }
    
    // Conflict penalty (signals disagree significantly)
    else if (Math.abs(priceConfidence - newsConfidence) > 0.4) {
      combinedConfidence *= 0.9; // 10% penalty
      elizaLogger.info("  Applied 10% penalty for conflicting signals");
    }
    
    // Neutral news penalty (no clear news signal)
    else if (newsSignal === "neutral") {
      combinedConfidence *= 0.95; // 5% penalty
      elizaLogger.info("  Applied 5% penalty for neutral news");
    }
    
    return Math.min(0.95, Math.max(0, combinedConfidence));
  }
  
  private evaluateTradingDecision(
    priceConfidence: number,
    newsConfidence: number,
    combinedConfidence: number,
    articleCount: number
  ): boolean {
    // Must meet minimum combined threshold
    if (combinedConfidence < this.MIN_COMBINED_CONFIDENCE) {
      return false;
    }
    
    // If price signal is very strong, trade even with weak news
    if (priceConfidence > 0.85) {
      return true;
    }
    
    // If news signal is very strong with multiple articles, consider trading
    if (newsConfidence > 0.8 && articleCount >= 3) {
      return true;
    }
    
    // Both signals must be reasonably strong
    return priceConfidence >= this.MIN_PRICE_CONFIDENCE && 
           newsConfidence >= this.MIN_NEWS_CONFIDENCE;
  }
  
  private generateReasoning(
    priceEdge: number,
    priceConfidence: number,
    newsConfidence: number,
    combinedConfidence: number,
    newsSignal: NewsSignal,
    outcome: "YES" | "NO",
    shouldTrade: boolean
  ): string {
    const parts: string[] = [];
    
    // Price reasoning
    parts.push(`Price edge of ${(priceEdge * 100).toFixed(1)}% gives ${(priceConfidence * 100).toFixed(0)}% confidence`);
    
    // News reasoning
    if (newsSignal.articles.length > 0) {
      const alignment = this.checkSignalAlignment(newsSignal.signal, outcome);
      if (alignment === "aligned") {
        parts.push(`News is ${newsSignal.signal} (${newsSignal.articles.length} articles), supporting ${outcome}`);
      } else if (alignment === "opposed") {
        parts.push(`News is ${newsSignal.signal} but we're considering ${outcome} (contrarian)`);
      } else {
        parts.push(`News sentiment is neutral (${newsSignal.articles.length} articles)`);
      }
    } else {
      parts.push("No recent news found");
    }
    
    // Combined reasoning
    parts.push(`Combined confidence: ${(combinedConfidence * 100).toFixed(0)}%`);
    
    // Decision
    if (shouldTrade) {
      parts.push("✅ Trade approved - signals aligned");
    } else {
      if (combinedConfidence < this.MIN_COMBINED_CONFIDENCE) {
        parts.push(`❌ Below minimum confidence threshold (${(this.MIN_COMBINED_CONFIDENCE * 100).toFixed(0)}%)`);
      } else if (priceConfidence < this.MIN_PRICE_CONFIDENCE) {
        parts.push("❌ Price edge too small");
      } else if (newsConfidence < this.MIN_NEWS_CONFIDENCE) {
        parts.push("❌ News signal too weak or conflicting");
      }
    }
    
    return parts.join(". ");
  }
  
  /**
   * Update configuration thresholds
   */
  updateThresholds(config: {
    minPriceConfidence?: number;
    minNewsConfidence?: number;
    minCombinedConfidence?: number;
    newsWeight?: number;
  }): void {
    if (config.minPriceConfidence !== undefined) {
      (this as any).MIN_PRICE_CONFIDENCE = config.minPriceConfidence;
    }
    if (config.minNewsConfidence !== undefined) {
      (this as any).MIN_NEWS_CONFIDENCE = config.minNewsConfidence;
    }
    if (config.minCombinedConfidence !== undefined) {
      (this as any).MIN_COMBINED_CONFIDENCE = config.minCombinedConfidence;
    }
    if (config.newsWeight !== undefined) {
      (this as any).NEWS_WEIGHT = config.newsWeight;
      (this as any).PRICE_WEIGHT = 1 - config.newsWeight;
    }
    
    elizaLogger.info("Hybrid confidence thresholds updated");
  }
}