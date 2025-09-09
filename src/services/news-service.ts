import { logger } from "@elizaos/core";
import axios from "axios";

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: Date;
  sentiment?: "positive" | "negative" | "neutral";
  relevanceScore?: number;
}

export interface NewsSignal {
  market: string;
  signal: "bullish" | "bearish" | "neutral";
  confidence: number;
  articles: NewsArticle[];
}

export class NewsService {
  private readonly apiKey: string;
  private readonly baseUrl = "https://newsapi.org/v2";
  private readonly cacheTime = 30 * 60 * 1000; // 30 minutes
  private cache: Map<string, { data: NewsArticle[]; timestamp: number }> = new Map();
  private readonly fetchInterval = 15 * 60 * 1000; // 15 minutes
  private intervalId?: NodeJS.Timeout;

  // Market-relevant keywords for filtering
  private readonly relevantKeywords = [
    // Political
    "election", "president", "congress", "senate", "vote", "poll", "campaign",
    "trump", "biden", "desantis", "ukraine", "russia", "putin", "zelensky",
    "china", "taiwan", "israel", "gaza", "iran", "sanctions",
    
    // Economic
    "fed", "federal reserve", "interest rate", "inflation", "recession",
    "gdp", "unemployment", "stock market", "crypto", "bitcoin", "ethereum",
    "earnings", "ipo", "merger", "acquisition", "bankruptcy",
    
    // Sports
    "nfl", "nba", "mlb", "nhl", "world cup", "olympics", "championship",
    "super bowl", "playoffs", "retirement", "injury", "trade", "draft",
    
    // Tech & Business
    "ai", "artificial intelligence", "tesla", "apple", "google", "microsoft",
    "amazon", "meta", "twitter", "spacex", "openai", "nvidia",
    
    // Climate & Energy
    "climate change", "hurricane", "earthquake", "oil", "gas", "renewable",
    "electric vehicle", "solar", "nuclear", "pipeline",
  ];

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NEWS_API_KEY || "";
    if (!this.apiKey) {
      logger.warn("NewsAPI key not configured - news service will be limited");
    }
  }

  async start(): Promise<void> {
    logger.info("Starting news service");
    
    // Initial fetch
    await this.fetchLatestNews();
    
    // Set up periodic fetching
    this.intervalId = setInterval(async () => {
      await this.fetchLatestNews();
    }, this.fetchInterval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    logger.info("News service stopped");
  }

  private async fetchLatestNews(): Promise<NewsArticle[]> {
    if (!this.apiKey) {
      logger.warn("Cannot fetch news - API key not configured");
      return [];
    }

    const cacheKey = "latest_headlines";
    const cached = this.cache.get(cacheKey);
    
    // Return cached data if still fresh
    if (cached && Date.now() - cached.timestamp < this.cacheTime) {
      return cached.data;
    }

    try {
      logger.info("Fetching latest news from NewsAPI");
      
      const response = await axios.get(`${this.baseUrl}/top-headlines`, {
        params: {
          apiKey: this.apiKey,
          language: "en",
          pageSize: 100,
          // Focus on relevant categories
          category: "business,technology,sports,general",
        },
      });

      const articles: NewsArticle[] = response.data.articles
        .filter((article: any) => article.title && article.description)
        .map((article: any) => ({
          title: article.title,
          description: article.description,
          url: article.url,
          source: article.source.name,
          publishedAt: new Date(article.publishedAt),
          relevanceScore: this.calculateRelevance(
            `${article.title} ${article.description}`
          ),
        }))
        .filter((article: NewsArticle) => article.relevanceScore! > 0.3);

      // Cache the results
      this.cache.set(cacheKey, {
        data: articles,
        timestamp: Date.now(),
      });

      logger.info(`Fetched ${articles.length} relevant news articles`);
      return articles;
    } catch (error) {
      logger.error("Failed to fetch news:", error);
      return cached?.data || [];
    }
  }

  async searchNews(query: string): Promise<NewsArticle[]> {
    if (!this.apiKey) {
      logger.warn("Cannot search news - API key not configured");
      return [];
    }

    const cacheKey = `search_${query}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTime) {
      return cached.data;
    }

    try {
      logger.info(`Searching news for: ${query}`);
      
      const response = await axios.get(`${this.baseUrl}/everything`, {
        params: {
          apiKey: this.apiKey,
          q: query,
          language: "en",
          sortBy: "relevancy",
          pageSize: 50,
          from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last 7 days
        },
      });

      const articles: NewsArticle[] = response.data.articles
        .filter((article: any) => article.title && article.description)
        .map((article: any) => ({
          title: article.title,
          description: article.description,
          url: article.url,
          source: article.source.name,
          publishedAt: new Date(article.publishedAt),
          sentiment: this.analyzeSentiment(
            `${article.title} ${article.description}`
          ),
          relevanceScore: 1.0, // Search results are inherently relevant
        }));

      this.cache.set(cacheKey, {
        data: articles,
        timestamp: Date.now(),
      });

      return articles;
    } catch (error) {
      logger.error(`Failed to search news for "${query}":`, error);
      return cached?.data || [];
    }
  }

  async getMarketSignals(marketTitle: string): Promise<NewsSignal> {
    // Extract key terms from market title for search
    const searchTerms = this.extractSearchTerms(marketTitle);
    const articles = await this.searchNews(searchTerms);
    
    if (articles.length === 0) {
      return {
        market: marketTitle,
        signal: "neutral",
        confidence: 0,
        articles: [],
      };
    }

    // Analyze sentiment across all articles
    let positiveCount = 0;
    let negativeCount = 0;
    
    articles.forEach(article => {
      if (article.sentiment === "positive") positiveCount++;
      else if (article.sentiment === "negative") negativeCount++;
    });

    const total = articles.length;
    const positiveRatio = positiveCount / total;
    const negativeRatio = negativeCount / total;
    
    let signal: "bullish" | "bearish" | "neutral";
    let confidence: number;
    
    if (positiveRatio > 0.6) {
      signal = "bullish";
      confidence = positiveRatio;
    } else if (negativeRatio > 0.6) {
      signal = "bearish";
      confidence = negativeRatio;
    } else {
      signal = "neutral";
      confidence = 0.5;
    }

    return {
      market: marketTitle,
      signal,
      confidence: Math.min(0.95, confidence * 1.2), // Scale up confidence slightly
      articles: articles.slice(0, 5), // Return top 5 most relevant
    };
  }

  private calculateRelevance(text: string): number {
    const lowerText = text.toLowerCase();
    let matchCount = 0;
    
    for (const keyword of this.relevantKeywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }
    
    // Calculate relevance score (0-1)
    return Math.min(1, matchCount / 3); // At least 3 keywords for max relevance
  }

  private analyzeSentiment(text: string): "positive" | "negative" | "neutral" {
    const lowerText = text.toLowerCase();
    
    // Simple keyword-based sentiment analysis
    const positiveWords = [
      "win", "success", "profit", "gain", "up", "rise", "increase", "surge",
      "breakthrough", "achievement", "victory", "positive", "growth", "record",
      "improve", "better", "exceed", "outperform", "rally", "boom",
    ];
    
    const negativeWords = [
      "lose", "loss", "fail", "down", "fall", "decrease", "decline", "crash",
      "crisis", "defeat", "negative", "recession", "collapse", "plunge",
      "worse", "underperform", "weak", "concern", "risk", "threat",
    ];
    
    let positiveScore = 0;
    let negativeScore = 0;
    
    positiveWords.forEach(word => {
      if (lowerText.includes(word)) positiveScore++;
    });
    
    negativeWords.forEach(word => {
      if (lowerText.includes(word)) negativeScore++;
    });
    
    if (positiveScore > negativeScore + 1) return "positive";
    if (negativeScore > positiveScore + 1) return "negative";
    return "neutral";
  }

  private extractSearchTerms(marketTitle: string): string {
    // Remove common market phrases to get core search terms
    const cleanTitle = marketTitle
      .replace(/will|before|after|by|in \d{4}|YES|NO|\?/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    
    // Extract key entities (simple approach)
    const words = cleanTitle.split(" ");
    const significantWords = words.filter(word => 
      word.length > 3 && !["will", "before", "after", "the", "and", "or"].includes(word.toLowerCase())
    );
    
    return significantWords.slice(0, 3).join(" ");
  }

  async getLatestHeadlines(): Promise<NewsArticle[]> {
    return this.fetchLatestNews();
  }
}

// Singleton instance
let newsServiceInstance: NewsService | null = null;

export function getNewsService(): NewsService {
  if (!newsServiceInstance) {
    newsServiceInstance = new NewsService();
  }
  return newsServiceInstance;
}