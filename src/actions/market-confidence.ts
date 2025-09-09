import {
  type Action,
  type ActionResult,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
} from "@elizaos/core";
import { 
  getConfidenceScorer, 
  getNewsService,
  type ConfidenceResult as BaseConfidenceResult,
  type MarketMetrics
} from "../services/news";

// Define local types for compatibility
interface MarketData {
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

interface ConfidenceResult {
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
 * Calculate market confidence using the confidence scorer
 */
async function calculateMarketConfidence(
  runtime: IAgentRuntime,
  market: MarketData,
  side: 'yes' | 'no'
): Promise<ConfidenceResult> {
  try {
    const confidenceScorer = getConfidenceScorer();
    const newsService = getNewsService();
    
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

/**
 * Market Confidence Action
 * Allows the agent to explain confidence scoring and analyze specific markets
 */
export const marketConfidenceAction: Action = {
  name: "MARKET_CONFIDENCE",
  similes: [
    "CONFIDENCE_ANALYSIS",
    "MARKET_SCORE",
    "TRADING_CONFIDENCE",
    "CONFIDENCE_CHECK",
    "ANALYZE_MARKET",
    "MARKET_ANALYSIS",
    "CONFIDENCE_LEVEL",
    "TRADING_SIGNAL",
    "MARKET_RATING",
  ],
  description: "Analyze and explain confidence scores for prediction markets",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || "";
    
    // Check for confidence-related keywords
    const confidenceKeywords = [
      "confidence",
      "confident",
      "score",
      "scoring",
      "analyze",
      "analysis",
      "should i bet",
      "should i trade",
      "good bet",
      "good trade",
      "worth betting",
      "worth trading",
      "rating",
      "signal",
      "recommendation",
      "what do you think",
      "your opinion",
      "assessment",
    ];

    const hasConfidenceKeyword = confidenceKeywords.some(keyword => text.includes(keyword));
    
    // Also check for market context
    const marketContext = text.includes("market") || 
                         text.includes("prediction") || 
                         text.includes("polymarket") ||
                         text.includes("position") ||
                         text.includes("trade");
    
    const isValid = hasConfidenceKeyword && marketContext;
    
    if (isValid) {
      logger.info(`[MarketConfidenceAction] Validated confidence query: "${text}"`);
    }
    
    return isValid;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    logger.info("[MarketConfidenceAction] Analyzing market confidence");

    try {
      const confidenceScorer = getConfidenceScorer();
      const newsService = getNewsService();
      const text = message.content?.text || "";
      
      // Check if user is asking about specific market
      // This is a simplified example - in production you'd parse the actual market
      const hasSpecificMarket = text.includes("market id:") || 
                               text.includes("about") ||
                               text.match(/["']([^"']+)["']/);
      
      let responseText = "";
      
      if (hasSpecificMarket) {
        // Analyze specific market (example with mock data)
        const mockMarket = {
          id: "example-market",
          question: "Will the Fed raise interest rates?",
          volume24hr: 45000,
          endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          currentPrices: { yes: 0.65, no: 0.35 },
        };
        
        const confidence = await calculateMarketConfidence(runtime, mockMarket, "yes");
        
        responseText = `🎯 **Market Confidence Analysis**

**Market**: ${mockMarket.question}
**Confidence Score**: ${confidence.overall}% ${getConfidenceEmoji(confidence.overall)}
**Recommendation**: ${confidence.recommendation.replace("_", " ").toUpperCase()}

**📊 Scoring Breakdown:**
• **News Sentiment**: ${confidence.factors.newsSentiment} (${confidence.factors.newsSentimentScore}%)
  ${getFactorExplanation("news", confidence.factors.newsSentiment)}
  
• **Market Volume**: ${confidence.factors.marketVolume} ($${(mockMarket.volume24hr || 0).toLocaleString()})
  Score: ${confidence.factors.marketVolumeScore}%
  ${getFactorExplanation("volume", confidence.factors.marketVolume)}
  
• **Time to Resolution**: ${confidence.factors.timeToResolution}
  Score: ${confidence.factors.timeToResolutionScore}%
  ${getFactorExplanation("time", confidence.factors.timeToResolution)}

**💭 My Analysis**:
${confidence.reasoning}

**🎲 Trading Decision**:
${getTradingAdvice(confidence.overall, confidence.recommendation)}

**⚠️ Risk Factors**:
${getRiskFactors(confidence.factors)}`;
      } else {
        // General explanation of confidence scoring
        responseText = `📊 **How I Calculate Market Confidence**

I use a **3-factor scoring system** to evaluate every prediction market:

**1️⃣ News Sentiment (40% weight)**
• I analyze recent news related to the market topic
• Positive news → Higher confidence for YES positions
• Negative news → Higher confidence for NO positions
• More relevant articles → Stronger signal

**2️⃣ Market Volume (30% weight)**
• High volume (>$50k) = Strong market interest ✅
• Medium volume ($10k-$50k) = Decent liquidity 🔄
• Low volume (<$10k) = Risky, may skip ⚠️

**3️⃣ Time to Resolution (30% weight)**
• Urgent (<3 days) = More predictable outcomes 🎯
• Normal (3-14 days) = Balanced risk/reward ⚖️
• Distant (>14 days) = Higher uncertainty 🌫️

**🎯 Confidence Thresholds:**
• **80-100%**: Strong signal - I'll trade automatically
• **70-79%**: Good opportunity - I'll likely trade
• **50-69%**: Moderate - Need more analysis
• **Below 50%**: Skip - Too risky or unclear

**💡 Price Adjustments:**
I also consider entry prices:
• Favorable price (<40%) → +10% confidence boost
• High price (>70%) → -15% confidence penalty

**My Current Settings:**
• Minimum confidence to trade: 70%
• Maximum concurrent positions: 3
• Position size: 10% of portfolio (1 unit)

Would you like me to analyze a specific market using this system? Just share the market details or question!`;
      }

      const content: Content = {
        text: responseText,
        actions: ["MARKET_CONFIDENCE"],
        data: {
          hasSpecificMarket,
          timestamp: new Date().toISOString(),
        },
      };

      if (callback) {
        await callback(content);
      }

      return {
        success: true,
        text: content.text,
        data: content.data as Record<string, any>,
      };
    } catch (error) {
      logger.error(`[MarketConfidenceAction] Error analyzing confidence: ${error}`);
      
      const errorContent: Content = {
        text: `⚠️ I'm having trouble analyzing market confidence right now. 

However, I can tell you that I generally look for:
• Strong news signals
• High market volume
• Near-term resolution dates
• Favorable entry prices

Please try again in a moment, or ask about specific market factors.`,
        actions: ["MARKET_CONFIDENCE"],
        data: { error: true },
      };

      if (callback) {
        await callback(errorContent);
      }

      return {
        success: false,
        text: errorContent.text,
        data: errorContent.data as Record<string, any>,
      };
    }
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: {
          text: "How confident are you about this market?",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "Let me analyze the confidence factors for this market...",
          action: "MARKET_CONFIDENCE",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "Can you explain your confidence scoring for markets?",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll explain how I calculate confidence scores for prediction markets...",
          action: "MARKET_CONFIDENCE",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "What's your confidence analysis on the election market?",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "Analyzing confidence factors for the election market...",
          action: "MARKET_CONFIDENCE",
        },
      },
    ],
  ],
};

/**
 * Get emoji based on confidence level
 */
function getConfidenceEmoji(confidence: number): string {
  if (confidence >= 80) return "🟢🔥";
  if (confidence >= 70) return "🟢";
  if (confidence >= 50) return "🟡";
  if (confidence >= 30) return "🟠";
  return "🔴";
}

/**
 * Get explanation for factor values
 */
function getFactorExplanation(
  factor: string, 
  value: string
): string {
  const explanations: Record<string, Record<string, string>> = {
    news: {
      positive: "Recent news supports a YES position",
      negative: "Recent news suggests a NO position might be better",
      neutral: "News signals are mixed or limited",
    },
    volume: {
      high: "Excellent liquidity, easy to enter/exit positions",
      medium: "Decent activity, reasonable spreads expected",
      low: "Limited liquidity, wider spreads, harder to exit",
    },
    time: {
      urgent: "Resolution soon, less time for surprises",
      normal: "Balanced timeframe for analysis and profit",
      distant: "Long wait, many variables could change",
    },
  };
  
  return explanations[factor]?.[value] || "Standard market conditions";
}

/**
 * Get trading advice based on confidence
 */
function getTradingAdvice(confidence: number, recommendation: string): string {
  if (recommendation === "strong_yes") {
    return `✅ **Strong BUY Signal**: This is a high-confidence opportunity. I would take a position immediately with 1 unit (10% of portfolio).`;
  } else if (recommendation === "yes") {
    return `✅ **BUY Signal**: Good opportunity. Consider taking a position if it aligns with your risk tolerance.`;
  } else if (recommendation === "no") {
    return `⏸️ **HOLD**: Marginal opportunity. Wait for better entry points or stronger signals.`;
  } else if (recommendation === "strong_no") {
    return `❌ **AVOID**: Low confidence. Too many risk factors. Look for other markets.`;
  } else {
    return `⏭️ **SKIP**: This market doesn't meet minimum criteria. Not worth the risk.`;
  }
}

/**
 * Get risk factors based on confidence factors
 */
function getRiskFactors(factors: any): string {
  const risks: string[] = [];
  
  if (factors.marketVolume === "low") {
    risks.push("• Low liquidity could mean high slippage");
  }
  
  if (factors.timeToResolution === "distant") {
    risks.push("• Long resolution time increases uncertainty");
  }
  
  if (factors.newsSentiment === "neutral") {
    risks.push("• Unclear news signals reduce conviction");
  }
  
  if (factors.marketVolumeScore < 30) {
    risks.push("• Very low volume suggests limited interest");
  }
  
  if (factors.timeToResolutionScore < 30) {
    risks.push("• Resolution timing is problematic");
  }
  
  return risks.length > 0 ? risks.join("\n") : "• Market conditions appear favorable";
}