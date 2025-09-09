import { logger } from "@elizaos/core";
import axios from "axios";
import { NewsConfig, NewsCategory, loadNewsConfig } from "./news-config";
import { MarketKeywordExtractor, ExtractedKeywords } from "./market-keyword-extractor";

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: Date;
  sentiment?: "positive" | "negative" | "neutral";
  relevanceScore?: number;
  categories?: string[];
}

export interface NewsSignal {
  market: string;
  signal: "bullish" | "bearish" | "neutral";
  confidence: number;
  articles: NewsArticle[];
}

export class NewsService {
  private config: NewsConfig;
  private cache: Map<string, { data: NewsArticle[]; timestamp: number }> = new Map();
  private intervalId?: NodeJS.Timeout;
  private activeApiKeys: Map<string, string> = new Map();

  constructor(customConfig?: Partial<NewsConfig>) {
    this.config = loadNewsConfig(customConfig);
    this.initializeApiKeys();
    
    if (this.activeApiKeys.size === 0) {
      logger.warn("No news API keys configured - news service will be limited");
    } else {
      logger.info(`News service initialized with ${this.activeApiKeys.size} sources`);
    }
  }

  private initializeApiKeys(): void {
    for (const source of this.config.sources) {
      if (source.enabled) {
        const apiKey = process.env[source.apiKeyEnvVar];
        if (apiKey) {
          this.activeApiKeys.set(source.name, apiKey);
          logger.info(`Enabled news source: ${source.name}`);
        } else {
          logger.warn(`${source.name} enabled but ${source.apiKeyEnvVar} not set`);
        }
      }
    }
  }

  async start(): Promise<void> {
    logger.info("Starting news service");
    
    // Initial fetch
    await this.fetchLatestNews();
    
    // Set up periodic fetching for each enabled source
    const primarySource = this.config.sources.find(s => s.enabled && this.activeApiKeys.has(s.name));
    if (primarySource) {
      this.intervalId = setInterval(async () => {
        await this.fetchLatestNews();
      }, primarySource.fetchInterval);
    }
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    logger.info("News service stopped");
  }

  private async fetchLatestNews(): Promise<NewsArticle[]> {
    const allArticles: NewsArticle[] = [];
    
    // Fetch from NewsAPI if configured
    if (this.activeApiKeys.has("NewsAPI")) {
      const newsApiArticles = await this.fetchFromNewsAPI();
      allArticles.push(...newsApiArticles);
    }
    
    // Add other sources here as they're implemented
    // if (this.activeApiKeys.has("AlphaVantage")) { ... }
    // if (this.activeApiKeys.has("Benzinga")) { ... }
    
    return allArticles;
  }

  private async fetchFromNewsAPI(): Promise<NewsArticle[]> {
    const source = this.config.sources.find(s => s.name === "NewsAPI");
    if (!source || !this.activeApiKeys.has("NewsAPI")) {
      return [];
    }

    const cacheKey = "newsapi_latest_headlines";
    const cached = this.cache.get(cacheKey);
    
    // Return cached data if still fresh
    if (cached && Date.now() - cached.timestamp < source.cacheTime) {
      return cached.data;
    }

    try {
      logger.info("Fetching latest news from NewsAPI");
      
      const response = await axios.get(`${source.baseUrl}/top-headlines`, {
        params: {
          apiKey: this.activeApiKeys.get("NewsAPI"),
          language: "en",
          pageSize: source.maxArticles,
          category: "business,technology,sports,general",
        },
      });

      const articles: NewsArticle[] = response.data.articles
        .filter((article: any) => article.title && article.description)
        .map((article: any) => {
          const text = `${article.title} ${article.description}`;
          const categories = this.categorizeArticle(text);
          const relevanceScore = this.calculateRelevance(text, categories);
          
          return {
            title: article.title,
            description: article.description,
            url: article.url,
            source: article.source.name,
            publishedAt: new Date(article.publishedAt),
            sentiment: this.analyzeSentiment(text),
            relevanceScore,
            categories: categories.map(c => c.name)
          };
        })
        .filter((article: NewsArticle) => article.relevanceScore! >= this.config.relevanceThreshold);

      // Maintain cache size limit
      if (this.cache.size >= this.config.cacheSettings.maxCacheSize) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) {
          this.cache.delete(oldestKey);
        }
      }

      this.cache.set(cacheKey, {
        data: articles,
        timestamp: Date.now(),
      });

      logger.info(`Fetched ${articles.length} relevant news articles from NewsAPI`);
      return articles;
    } catch (error) {
      logger.error("Failed to fetch from NewsAPI:", error);
      return cached?.data || [];
    }
  }

  async searchNews(query: string): Promise<NewsArticle[]> {
    // Try NewsAPI first
    if (this.activeApiKeys.has("NewsAPI")) {
      return this.searchNewsAPI(query);
    }
    
    // Fall back to other sources
    logger.warn("No news sources available for search");
    return [];
  }

  private async searchNewsAPI(query: string): Promise<NewsArticle[]> {
    const source = this.config.sources.find(s => s.name === "NewsAPI");
    if (!source || !this.activeApiKeys.has("NewsAPI")) {
      return [];
    }

    const cacheKey = `newsapi_search_${query}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < source.cacheTime) {
      return cached.data;
    }

    try {
      logger.info(`Searching NewsAPI for: ${query}`);
      
      const response = await axios.get(`${source.baseUrl}/everything`, {
        params: {
          apiKey: this.activeApiKeys.get("NewsAPI"),
          q: query,
          language: "en",
          sortBy: "relevancy",
          pageSize: Math.min(50, source.maxArticles),
          from: new Date(Date.now() - this.config.searchDaysBack * 24 * 60 * 60 * 1000).toISOString(),
        },
      });

      const articles: NewsArticle[] = response.data.articles
        .filter((article: any) => article.title && article.description)
        .map((article: any) => {
          const text = `${article.title} ${article.description}`;
          const categories = this.categorizeArticle(text);
          
          return {
            title: article.title,
            description: article.description,
            url: article.url,
            source: article.source.name,
            publishedAt: new Date(article.publishedAt),
            sentiment: this.analyzeSentiment(text),
            relevanceScore: 1.0, // Search results are inherently relevant
            categories: categories.map(c => c.name)
          };
        });

      // Maintain cache size limit
      if (this.cache.size >= this.config.cacheSettings.maxCacheSize) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) {
          this.cache.delete(oldestKey);
        }
      }

      this.cache.set(cacheKey, {
        data: articles,
        timestamp: Date.now(),
      });

      return articles;
    } catch (error) {
      logger.error(`Failed to search NewsAPI for "${query}":`, error);
      return cached?.data || [];
    }
  }

  async getMarketSignals(marketTitle: string, marketRules?: string): Promise<NewsSignal> {
    // Use keyword extractor for better search terms
    const keywords = MarketKeywordExtractor.extractKeywords(marketTitle, marketRules);
    const searchQuery = MarketKeywordExtractor.createSearchQuery(keywords);
    
    const articles = await this.searchNews(searchQuery);
    
    // Calculate relevance for each article based on keyword matches
    const scoredArticles = articles.map(article => {
      const articleText = `${article.title} ${article.description}`;
      const keywordScore = MarketKeywordExtractor.calculateRelevanceScore(articleText, keywords);
      return {
        ...article,
        relevanceScore: keywordScore
      };
    });
    
    // Sort by relevance and filter low-scoring articles
    const relevantArticles = scoredArticles
      .filter(a => a.relevanceScore >= 0.3)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 10);
    
    if (relevantArticles.length === 0) {
      return {
        market: marketTitle,
        signal: "neutral",
        confidence: 0,
        articles: [],
      };
    }

    // Analyze sentiment across all articles weighted by relevance
    let positiveCount = 0;
    let negativeCount = 0;
    let totalWeight = 0;
    
    relevantArticles.forEach(article => {
      // Weight by relevance score
      const weight = article.relevanceScore || 0.5;
      totalWeight += weight;
      
      if (article.sentiment === "positive") {
        positiveCount += weight;
      } else if (article.sentiment === "negative") {
        negativeCount += weight;
      }
    });

    const positiveRatio = positiveCount / totalWeight;
    const negativeRatio = negativeCount / totalWeight;
    
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

    // Adjust confidence based on article count and average relevance
    const avgRelevance = relevantArticles.reduce((sum, a) => sum + a.relevanceScore, 0) / relevantArticles.length;
    const articleCountBonus = Math.min(0.2, relevantArticles.length * 0.02); // Up to 0.2 bonus for many articles
    confidence = Math.min(0.95, confidence * avgRelevance + articleCountBonus);

    logger.info(`Market signals for "${marketTitle.substring(0, 50)}...": ${signal} (${(confidence * 100).toFixed(1)}% confidence)`);
    logger.info(`  Based on ${relevantArticles.length} relevant articles with avg relevance ${avgRelevance.toFixed(2)}`);

    return {
      market: marketTitle,
      signal,
      confidence,
      articles: relevantArticles.slice(0, 5), // Return top 5 most relevant
    };
  }

  private categorizeArticle(text: string): NewsCategory[] {
    const lowerText = text.toLowerCase();
    const matchedCategories: NewsCategory[] = [];
    
    for (const category of this.config.categories) {
      if (!category.enabled) continue;
      
      let matchCount = 0;
      for (const keyword of category.keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          matchCount++;
        }
      }
      
      if (matchCount > 0) {
        matchedCategories.push(category);
      }
    }
    
    return matchedCategories;
  }

  private calculateRelevance(text: string, categories: NewsCategory[]): number {
    if (categories.length === 0) return 0;
    
    // Calculate weighted relevance based on matched categories
    const totalWeight = categories.reduce((sum, cat) => sum + cat.weight, 0);
    const avgWeight = totalWeight / categories.length;
    
    // More categories matched = higher base relevance
    const categoryBonus = Math.min(1, categories.length / 3);
    
    // Combine average weight with category bonus
    return Math.min(1, (avgWeight * 0.7) + (categoryBonus * 0.3));
  }

  private analyzeSentiment(text: string): "positive" | "negative" | "neutral" {
    const lowerText = text.toLowerCase();
    
    let positiveScore = 0;
    let negativeScore = 0;
    
    this.config.sentimentWords.positive.forEach(word => {
      if (lowerText.includes(word)) positiveScore++;
    });
    
    this.config.sentimentWords.negative.forEach(word => {
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
    
    // Extract key entities
    const words = cleanTitle.split(" ");
    const significantWords = words.filter(word => 
      word.length > 3 && !["will", "before", "after", "the", "and", "or"].includes(word.toLowerCase())
    );
    
    return significantWords.slice(0, 3).join(" ");
  }

  async getLatestHeadlines(): Promise<NewsArticle[]> {
    return this.fetchLatestNews();
  }

  // Configuration management
  updateConfig(newConfig: Partial<NewsConfig>): void {
    this.config = loadNewsConfig({ ...this.config, ...newConfig });
    this.initializeApiKeys();
    logger.info("News service configuration updated");
  }

  getConfig(): NewsConfig {
    return this.config;
  }

  getActiveSourcesCount(): number {
    return this.activeApiKeys.size;
  }
}

// Singleton instance
let newsServiceInstance: NewsService | null = null;

export function getNewsService(customConfig?: Partial<NewsConfig>): NewsService {
  if (!newsServiceInstance) {
    newsServiceInstance = new NewsService(customConfig);
  }
  return newsServiceInstance;
}