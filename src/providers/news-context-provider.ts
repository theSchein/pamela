import {
  type IAgentRuntime,
  type Memory,
  type Provider,
  type ProviderResult,
  type State,
  logger,
} from "@elizaos/core";
import { getNewsService, type NewsArticle } from "../services/news";

// Helper methods for extended news functionality
async function getNewsSummary(newsService: any): Promise<string> {
  const articles = await newsService.getLatestHeadlines();
  if (articles.length === 0) {
    return "No recent market-relevant news available.";
  }
  
  const summary = articles.slice(0, 5).map((article: NewsArticle, index: number) => 
    `${index + 1}. **${article.title}**\n   ${article.description || "No description available"}\n   Source: ${article.source} | ${new Date(article.publishedAt).toLocaleString()}`
  ).join("\n\n");
  
  return `📰 **Recent Market News**\n\n${summary}`;
}

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
 * News Context Provider
 * Adds recent news context to agent conversations
 */
export const newsContextProvider: Provider = {
  name: "NEWS_CONTEXT",
  description: "Provides recent news context for market discussions",

  get: async (runtime: IAgentRuntime, message: Memory, state: State): Promise<ProviderResult> => {
    try {
      const newsService = getNewsService();
      
      // Check if news service is available
      if (!runtime.getSetting("NEWS_API_KEY")) {
        return { text: "", values: {}, data: {} };
      }

      // Get recent news summary (cached, so won't hit API every time)
      const summary = await getNewsSummary(newsService);
      
      // Only include if there's actual news
      if (summary.includes("No recent market-relevant news")) {
        return { text: "", values: {}, data: {} };
      }

      // Return formatted context
      const contextText = `
## Recent Market News Context
${summary}

## Current Market Sentiment
Based on recent news, the overall market sentiment appears to be ${await getOverallSentiment(newsService)}.
This context may be relevant for discussing prediction markets and trading opportunities.
`;
      
      return {
        text: contextText,
        values: { hasNews: true },
        data: { newsAvailable: true }
      };
    } catch (error) {
      logger.warn(`[NewsContextProvider] Error getting news context: ${error}`);
      return { text: "", values: {}, data: {} };
    }
  },
};

/**
 * Get overall market sentiment from news
 */
async function getOverallSentiment(newsService: any): Promise<string> {
  try {
    // Sample a few key topics
    const topics = ["economy", "election", "crypto"];
    const sentiments = await Promise.all(
      topics.map(topic => getNewsSentiment(newsService, topic))
    );
    
    const positiveCount = sentiments.filter(s => s === "positive").length;
    const negativeCount = sentiments.filter(s => s === "negative").length;
    
    if (positiveCount > negativeCount) {
      return "generally positive with opportunities for YES positions";
    } else if (negativeCount > positiveCount) {
      return "generally negative, favoring NO positions or contrarian plays";
    } else {
      return "mixed, requiring careful market selection";
    }
  } catch (error) {
    return "uncertain";
  }
}

/**
 * Market Intelligence Provider
 * Provides structured market intelligence for trading decisions
 */
export const marketIntelligenceProvider: Provider = {
  name: "MARKET_INTELLIGENCE",
  description: "Provides market intelligence and signals for trading decisions",

  get: async (runtime: IAgentRuntime, message: Memory, state: State): Promise<ProviderResult> => {
    try {
      const newsService = getNewsService();
      const text = message?.content?.text || "";
      
      // Only provide intelligence if discussing markets or trading
      const isMarketDiscussion = [
        "market", "trade", "trading", "position", "bet", "prediction",
        "polymarket", "confidence", "news", "update", "signal"
      ].some(keyword => text.toLowerCase().includes(keyword));
      
      if (!isMarketDiscussion) {
        return { text: "", values: {}, data: {} };
      }

      // Get topic-specific news if mentioned
      let topic = "";
      const topicKeywords = [
        "election", "politics", "economy", "crypto", "bitcoin",
        "sports", "nfl", "nba", "tech", "ai", "climate"
      ];
      
      for (const keyword of topicKeywords) {
        if (text.toLowerCase().includes(keyword)) {
          topic = keyword;
          break;
        }
      }

      if (!topic) {
        return { text: "", values: {}, data: {} };
      }

      // Get relevant news and sentiment
      const news = await getRelevantNews(newsService, topic, 3);
      const sentiment = await getNewsSentiment(newsService, topic);
      
      if (news.length === 0) {
        return { text: "", values: {}, data: {} };
      }

      const intelligenceText = `
## Market Intelligence: ${topic.toUpperCase()}
### Recent Developments
${news.map((article: any, i: number) => `${i + 1}. ${article.title} (${article.source})`).join("\n")}

### Sentiment Analysis
Current ${topic} sentiment: **${sentiment}**
News volume: ${news.length > 3 ? "High" : news.length > 1 ? "Moderate" : "Low"}

### Trading Implications
${sentiment === "positive" ? 
  `• Bullish signals for ${topic}-related YES positions` :
  sentiment === "negative" ?
  `• Bearish signals favoring NO positions on ${topic} markets` :
  `• Mixed signals require careful analysis of specific ${topic} markets`}
`;
      
      return {
        text: intelligenceText,
        values: { topic, sentiment },
        data: { newsCount: news.length }
      };
    } catch (error) {
      logger.warn(`[MarketIntelligenceProvider] Error getting intelligence: ${error}`);
      return { text: "", values: {}, data: {} };
    }
  },
};

/**
 * Trading Signals Provider
 * Provides active trading signals based on news and confidence
 */
export const tradingSignalsProvider: Provider = {
  name: "TRADING_SIGNALS",
  description: "Provides active trading signals and opportunities",

  get: async (runtime: IAgentRuntime, message: Memory, state: State): Promise<ProviderResult> => {
    try {
      // Only provide signals if explicitly discussing trading
      const text = message?.content?.text?.toLowerCase() || "";
      const isTradingQuery = [
        "should i trade", "should i bet", "good trade", "good bet",
        "opportunity", "signal", "position", "recommendation"
      ].some(phrase => text.includes(phrase));
      
      if (!isTradingQuery) {
        return { text: "", values: {}, data: {} };
      }

      const newsService = getNewsService();
      
      // Get hot topics with strong sentiment
      const hotTopics: string[] = [];
      const topics = ["election", "economy", "crypto", "tech"];
      
      for (const topic of topics) {
        const sentiment = await getNewsSentiment(newsService, topic);
        const news = await getRelevantNews(newsService, topic, 2);
        
        if (news.length >= 2 && sentiment !== "neutral") {
          hotTopics.push(`${topic} (${sentiment})`);
        }
      }

      if (hotTopics.length === 0) {
        return { text: "", values: {}, data: {} };
      }

      const signalsText = `
## Active Trading Signals
### Hot Topics with Strong Sentiment
${hotTopics.map(t => `• ${t}`).join("\n")}

### Signal Strength
${hotTopics.length >= 3 ? "🟢 STRONG - Multiple opportunities detected" :
  hotTopics.length >= 2 ? "🟡 MODERATE - Some opportunities available" :
  "🟠 WEAK - Limited signals, be selective"}

Note: These are news-based signals. Always check market volume and prices before trading.
`;
      
      return {
        text: signalsText,
        values: { signalCount: hotTopics.length },
        data: { hotTopics }
      };
    } catch (error) {
      logger.warn(`[TradingSignalsProvider] Error getting signals: ${error}`);
      return { text: "", values: {}, data: {} };
    }
  },
};