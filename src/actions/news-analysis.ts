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
import { getNewsService, type NewsArticle } from "../services/news";

// Helper methods for extended news functionality
async function getRelevantNews(newsService: any, topic: string, limit: number): Promise<NewsArticle[]> {
  const articles = topic 
    ? await newsService.searchNews(topic)
    : await newsService.getLatestHeadlines();
  return articles.slice(0, limit);
}

async function getNewsSentiment(newsService: any, topic: string): Promise<'positive' | 'negative' | 'neutral'> {
  const signal = await newsService.getMarketSignals(topic);
  if (signal.signal === 'bullish') return 'positive';
  if (signal.signal === 'bearish') return 'negative';
  return 'neutral';
}

/**
 * News Analysis Action
 * Allows the agent to discuss news updates that may affect prediction markets
 */
export const newsAnalysisAction: Action = {
  name: "NEWS_ANALYSIS",
  similes: [
    "NEWS_UPDATE",
    "MARKET_NEWS",
    "NEWS_SUMMARY",
    "BREAKING_NEWS",
    "NEWS_REPORT",
    "MARKET_UPDATE",
    "NEWS_CHECK",
    "RECENT_NEWS",
    "NEWS_BRIEF",
    "NEWS_IMPACT",
  ],
  description: "Analyze and discuss news that may affect prediction markets",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || "";
    
    // Check for news-related keywords
    const newsKeywords = [
      "news",
      "update",
      "breaking",
      "recent",
      "latest",
      "happening",
      "events",
      "headlines",
      "report",
      "announcement",
      "developments",
      "what's new",
      "what is new",
      "market news",
      "any news",
      "news affect",
      "news impact",
    ];

    const hasNewsKeyword = newsKeywords.some(keyword => text.includes(keyword));
    
    // Also check for market/prediction related context
    const marketContext = [
      "market",
      "prediction",
      "trading",
      "polymarket",
      "affect",
      "impact",
      "influence",
    ];
    
    const hasMarketContext = marketContext.some(keyword => text.includes(keyword));
    
    // Validate if it's a news query (news keyword OR market context with question)
    const isQuestion = text.includes("?") || text.includes("what") || text.includes("any") || text.includes("how");
    
    const isValid = hasNewsKeyword || (hasMarketContext && isQuestion);
    
    if (isValid) {
      logger.info(`[NewsAnalysisAction] Validated news query: "${text}"`);
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
    logger.info("[NewsAnalysisAction] Analyzing news for market impact");

    try {
      const newsService = getNewsService();
      const text = message.content?.text || "";
      
      // Determine if user is asking about specific topic
      let topic = "";
      const topicKeywords = [
        "election", "politics", "president", "congress",
        "economy", "inflation", "recession", "fed",
        "crypto", "bitcoin", "ethereum",
        "sports", "nfl", "nba", "championship",
        "tech", "ai", "technology",
        "climate", "energy", "oil",
      ];
      
      for (const keyword of topicKeywords) {
        if (text.toLowerCase().includes(keyword)) {
          topic = keyword;
          break;
        }
      }
      
      // Get relevant news
      const news = await getRelevantNews(newsService, topic, 5);
      const sentiment = topic ? await getNewsSentiment(newsService, topic) : "neutral";
      
      let responseText = "";
      
      if (news.length === 0) {
        responseText = `📰 **No Recent Market-Relevant News**

I haven't found any significant news ${topic ? `about ${topic}` : ""} that would impact prediction markets in the last few hours.

The markets are relatively quiet right now, which often means:
• Lower volatility in predictions
• Stable prices on existing markets
• Good opportunity to research positions without FOMO

I'll keep monitoring for breaking news that could create trading opportunities.`;
      } else {
        // Analyze impact on markets
        const marketImpact = analyzeMarketImpact(news, sentiment);
        
        responseText = `📰 **News Analysis for Prediction Markets**
${topic ? `\n🔍 **Topic**: ${topic.charAt(0).toUpperCase() + topic.slice(1)}` : ""}
📊 **Overall Sentiment**: ${sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
⚡ **Market Impact**: ${marketImpact.level}

**Top Stories Affecting Markets:**
${news.slice(0, 3).map((article, i) => 
  `${i + 1}. **${article.title}**
   ${article.description?.substring(0, 100)}...
   📅 ${new Date(article.publishedAt).toLocaleString()}
   🔗 Source: ${article.source}`
).join("\n\n")}

**💡 Trading Implications:**
${marketImpact.implications.join("\n")}

**🎯 Markets to Watch:**
${marketImpact.marketsToWatch.join("\n")}

${marketImpact.confidence > 70 ? 
  "**🚨 High Confidence Alert**: This news creates strong trading signals. Consider taking positions soon." :
  marketImpact.confidence > 50 ?
  "**📈 Moderate Signal**: Some trading opportunities emerging. Monitor closely for entry points." :
  "**⏳ Low Signal**: News is developing. Wait for more clarity before taking positions."
}`;
      }

      const content: Content = {
        text: responseText,
        actions: ["NEWS_ANALYSIS"],
        data: {
          newsCount: news.length,
          sentiment,
          topic: topic || "general",
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
      logger.error(`[NewsAnalysisAction] Error analyzing news: ${error}`);
      
      const errorContent: Content = {
        text: `⚠️ **News Service Temporarily Unavailable**

I'm having trouble accessing the news service right now. This might be due to:
• API rate limits
• Network connectivity issues
• Service maintenance

You can still:
• Check market volumes for activity signals
• Review recent price movements
• Analyze resolution dates for urgency

I'll try to restore news access shortly.`,
        actions: ["NEWS_ANALYSIS"],
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
          text: "Any news updates that may affect prediction markets?",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "Let me check the latest news for market-moving events...",
          action: "NEWS_ANALYSIS",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "What's the latest news on the election markets?",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll analyze recent election news and its impact on prediction markets...",
          action: "NEWS_ANALYSIS",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "Are there any breaking news affecting crypto predictions?",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "Checking crypto-related news that could impact prediction markets...",
          action: "NEWS_ANALYSIS",
        },
      },
    ],
  ],
};

/**
 * Analyze market impact based on news
 */
function analyzeMarketImpact(
  news: any[],
  sentiment: string
): {
  level: string;
  confidence: number;
  implications: string[];
  marketsToWatch: string[];
} {
  const implications: string[] = [];
  const marketsToWatch: string[] = [];
  let confidence = 50; // Base confidence

  // Adjust confidence based on news volume
  if (news.length >= 4) {
    confidence += 20;
    implications.push("• High news volume indicates significant market movement potential");
  } else if (news.length >= 2) {
    confidence += 10;
    implications.push("• Moderate news flow suggests some trading opportunities");
  } else {
    implications.push("• Limited news coverage means lower volatility expected");
  }

  // Adjust based on sentiment
  if (sentiment === "positive") {
    confidence += 15;
    implications.push("• Positive sentiment favors YES positions on related markets");
    marketsToWatch.push("• Bullish outcome markets (economic growth, tech advancement)");
  } else if (sentiment === "negative") {
    confidence += 15;
    implications.push("• Negative sentiment favors NO positions or contrarian plays");
    marketsToWatch.push("• Bearish outcome markets (recession, conflict escalation)");
  } else {
    implications.push("• Mixed sentiment requires careful market selection");
    marketsToWatch.push("• Focus on markets with clear binary outcomes");
  }

  // Check for specific high-impact topics in news
  const newsText = news.map(n => `${n.title} ${n.description}`).join(" ").toLowerCase();
  
  if (newsText.includes("election") || newsText.includes("poll")) {
    marketsToWatch.push("• Political outcome markets");
    confidence += 10;
  }
  
  if (newsText.includes("fed") || newsText.includes("interest rate")) {
    marketsToWatch.push("• Economic policy markets");
    confidence += 10;
  }
  
  if (newsText.includes("earnings") || newsText.includes("ipo")) {
    marketsToWatch.push("• Corporate performance markets");
    confidence += 5;
  }

  // Determine impact level
  let level = "Low";
  if (confidence >= 80) {
    level = "High - Strong Trading Signals";
  } else if (confidence >= 60) {
    level = "Moderate - Some Opportunities";
  } else {
    level = "Low - Limited Impact";
  }

  // Add timing implications
  const now = new Date();
  const hour = now.getHours();
  
  if (hour >= 9 && hour <= 16) {
    implications.push("• US market hours - expect higher activity and liquidity");
  } else {
    implications.push("• Off-peak hours - may find better entry prices");
  }

  return {
    level,
    confidence: Math.min(100, confidence),
    implications,
    marketsToWatch: marketsToWatch.length > 0 ? marketsToWatch : ["• No specific markets identified - monitor broadly"],
  };
}