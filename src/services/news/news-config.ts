/**
 * News Service Configuration Module
 * 
 * This module defines the configuration structure for the news aggregation service.
 * It allows for flexible tuning of news categories, sources, sentiment analysis,
 * and caching behavior without modifying the core service code.
 * 
 * The configuration is designed to be extensible - new categories, sources, and
 * sentiment words can be added easily through the configuration object.
 */

/**
 * NewsCategory Interface
 * Defines a category of news with associated keywords and importance weighting
 * 
 * @property name - Unique identifier for the category (e.g., "political", "economic")
 * @property keywords - Array of terms to match against article content for categorization
 * @property weight - Multiplier for relevance scoring (higher = more important)
 *                    Values > 1.0 boost relevance, < 1.0 reduce it
 * @property enabled - Whether this category should be actively used in analysis
 */
export interface NewsCategory {
  name: string;
  keywords: string[];
  weight: number;
  enabled: boolean;
}

/**
 * NewsSourceConfig Interface
 * Configuration for individual news data sources
 * 
 * @property name - Display name for the source
 * @property baseUrl - API endpoint base URL
 * @property apiKeyEnvVar - Environment variable name containing the API key
 * @property enabled - Whether to attempt to use this source
 * @property cacheTime - How long to cache results from this source (milliseconds)
 * @property fetchInterval - How often to refresh data from this source (milliseconds)
 * @property maxArticles - Maximum number of articles to fetch per request
 */
export interface NewsSourceConfig {
  name: string;
  baseUrl: string;
  apiKeyEnvVar: string;
  enabled: boolean;
  cacheTime: number;
  fetchInterval: number;
  maxArticles: number;
}

/**
 * NewsSentimentWords Interface
 * Lists of words used for basic sentiment analysis
 * 
 * @property positive - Words indicating positive sentiment
 * @property negative - Words indicating negative sentiment
 */
export interface NewsSentimentWords {
  positive: string[];
  negative: string[];
}

/**
 * NewsConfig Interface
 * Main configuration structure for the news service
 * 
 * @property categories - Array of news categories with their keywords and weights
 * @property sources - Array of configured news sources
 * @property sentimentWords - Words used for sentiment analysis
 * @property relevanceThreshold - Minimum relevance score (0-1) for articles to be included
 * @property searchDaysBack - How many days of historical news to search
 * @property cacheSettings - Configuration for the caching system
 */
export interface NewsConfig {
  categories: NewsCategory[];
  sources: NewsSourceConfig[];
  sentimentWords: NewsSentimentWords;
  relevanceThreshold: number;
  searchDaysBack: number;
  cacheSettings: {
    defaultCacheTime: number;
    maxCacheSize: number;
  };
}

/**
 * Default News Configuration
 * 
 * This provides a comprehensive default setup for news analysis across
 * multiple domains relevant to prediction markets. Each category is tuned
 * with specific keywords and weights based on their typical impact on markets.
 * 
 * Category Weights:
 * - Political (1.2): High impact on prediction markets
 * - Economic (1.1): Strong market influence
 * - Technology (1.0): Baseline importance
 * - Sports (0.9): Moderate relevance
 * - Climate/Energy (0.8): Growing importance
 * - Health (0.7): Situational relevance
 * - Entertainment (0.6): Lower priority
 */
export const defaultNewsConfig: NewsConfig = {
  // News categories define what types of content we're interested in
  // Each category has keywords that trigger matching and a weight that
  // affects how important matches in this category are considered
  categories: [
    {
      name: "political",
      keywords: [
        "election", "president", "congress", "senate", "vote", "poll", "campaign",
        "trump", "biden", "desantis", "ukraine", "russia", "putin", "zelensky",
        "china", "taiwan", "israel", "gaza", "iran", "sanctions", "nato", "un",
        "diplomacy", "treaty", "ambassador", "summit", "g7", "g20"
      ],
      weight: 1.2, // Political news gets 20% boost in relevance
      enabled: true
    },
    {
      name: "economic",
      keywords: [
        "fed", "federal reserve", "interest rate", "inflation", "recession",
        "gdp", "unemployment", "stock market", "crypto", "bitcoin", "ethereum",
        "earnings", "ipo", "merger", "acquisition", "bankruptcy", "bailout",
        "treasury", "bond", "yield", "dollar", "euro", "yen", "commodity",
        "oil price", "gold", "silver", "futures", "options", "derivatives"
      ],
      weight: 1.1, // Economic news gets 10% boost
      enabled: true
    },
    {
      name: "sports",
      keywords: [
        "nfl", "nba", "mlb", "nhl", "world cup", "olympics", "championship",
        "super bowl", "playoffs", "retirement", "injury", "trade", "draft",
        "soccer", "football", "basketball", "baseball", "hockey", "tennis",
        "golf", "boxing", "mma", "ufc", "formula 1", "nascar", "tournament"
      ],
      weight: 0.9, // Sports news gets 10% reduction
      enabled: true
    },
    {
      name: "technology",
      keywords: [
        "ai", "artificial intelligence", "machine learning", "chatgpt", "llm",
        "tesla", "apple", "google", "microsoft", "amazon", "meta", "twitter",
        "spacex", "openai", "nvidia", "semiconductor", "chip", "quantum",
        "cybersecurity", "hack", "breach", "software", "hardware", "startup",
        "venture capital", "funding", "unicorn", "blockchain", "web3", "metaverse"
      ],
      weight: 1.0, // Technology news at baseline weight
      enabled: true
    },
    {
      name: "climate_energy",
      keywords: [
        "climate change", "global warming", "hurricane", "earthquake", "wildfire",
        "flood", "drought", "oil", "gas", "renewable", "solar", "wind", "nuclear",
        "electric vehicle", "ev", "battery", "carbon", "emissions", "net zero",
        "paris agreement", "cop", "fossil fuel", "green energy", "sustainability"
      ],
      weight: 0.8, // Climate news gets 20% reduction
      enabled: true
    },
    {
      name: "entertainment",
      keywords: [
        "movie", "film", "oscar", "grammy", "emmy", "box office", "streaming",
        "netflix", "disney", "hollywood", "celebrity", "music", "album", "tour",
        "concert", "festival", "broadway", "theater", "television", "series"
      ],
      weight: 0.6, // Entertainment news gets 40% reduction
      enabled: true
    },
    {
      name: "health",
      keywords: [
        "covid", "pandemic", "vaccine", "fda", "cdc", "who", "drug", "pharmaceutical",
        "clinical trial", "hospital", "healthcare", "medicare", "medicaid", "insurance",
        "mental health", "epidemic", "outbreak", "treatment", "therapy", "diagnosis"
      ],
      weight: 0.7, // Health news gets 30% reduction
      enabled: true
    }
  ],
  
  // News sources configuration
  // Each source has its own API endpoint, caching, and fetch settings
  // Only sources with valid API keys in environment will be activated
  sources: [
    {
      name: "NewsAPI",
      baseUrl: "https://newsapi.org/v2",
      apiKeyEnvVar: "NEWS_API_KEY",
      enabled: true, // Primary news source
      cacheTime: 30 * 60 * 1000, // Cache for 30 minutes
      fetchInterval: 15 * 60 * 1000, // Refresh every 15 minutes
      maxArticles: 100
    },
    {
      name: "AlphaVantage",
      baseUrl: "https://www.alphavantage.co/query",
      apiKeyEnvVar: "ALPHA_VANTAGE_API_KEY",
      enabled: false, // Disabled by default (financial data focus)
      cacheTime: 60 * 60 * 1000, // Cache for 1 hour (less frequent updates)
      fetchInterval: 30 * 60 * 1000, // Refresh every 30 minutes
      maxArticles: 50
    },
    {
      name: "Benzinga",
      baseUrl: "https://api.benzinga.com/api/v2",
      apiKeyEnvVar: "BENZINGA_API_KEY",
      enabled: false, // Disabled by default (financial news)
      cacheTime: 30 * 60 * 1000,
      fetchInterval: 20 * 60 * 1000,
      maxArticles: 75
    },
    {
      name: "Finnhub",
      baseUrl: "https://finnhub.io/api/v1",
      apiKeyEnvVar: "FINNHUB_API_KEY",
      enabled: false, // Disabled by default (market data)
      cacheTime: 45 * 60 * 1000,
      fetchInterval: 25 * 60 * 1000,
      maxArticles: 60
    }
  ],
  
  // Sentiment analysis word lists
  // These words are matched against article text to determine overall sentiment
  // More sophisticated sentiment analysis could be plugged in here
  sentimentWords: {
    positive: [
      "win", "success", "profit", "gain", "up", "rise", "increase", "surge",
      "breakthrough", "achievement", "victory", "positive", "growth", "record",
      "improve", "better", "exceed", "outperform", "rally", "boom", "bullish",
      "optimistic", "strong", "robust", "healthy", "advance", "recovery",
      "expansion", "upgrade", "benefit", "opportunity", "innovative", "leading"
    ],
    negative: [
      "lose", "loss", "fail", "down", "fall", "decrease", "decline", "crash",
      "crisis", "defeat", "negative", "recession", "collapse", "plunge", "bearish",
      "worse", "underperform", "weak", "concern", "risk", "threat", "warning",
      "pessimistic", "vulnerable", "struggle", "deficit", "shortfall", "cut",
      "layoff", "bankruptcy", "default", "miss", "disappoint", "scandal"
    ]
  },
  
  // Filtering and search parameters
  relevanceThreshold: 0.3, // Articles must score at least 30% relevance
  searchDaysBack: 7, // Search up to 7 days of historical news
  
  // Cache configuration to prevent excessive API calls
  cacheSettings: {
    defaultCacheTime: 30 * 60 * 1000, // Default 30 minute cache
    maxCacheSize: 100 // Keep up to 100 cached searches in memory
  }
};

/**
 * Load News Configuration
 * 
 * Merges custom configuration with defaults, allowing partial overrides.
 * This enables users to customize specific aspects of the configuration
 * without having to redefine the entire structure.
 * 
 * @param customConfig - Partial configuration to override defaults
 * @returns Complete NewsConfig with custom values merged over defaults
 * 
 * @example
 * // Override just the relevance threshold
 * const config = loadNewsConfig({ relevanceThreshold: 0.5 });
 * 
 * @example
 * // Add custom sentiment words
 * const config = loadNewsConfig({
 *   sentimentWords: {
 *     positive: [...defaultNewsConfig.sentimentWords.positive, "breakthrough"],
 *     negative: [...defaultNewsConfig.sentimentWords.negative, "disaster"]
 *   }
 * });
 */
export function loadNewsConfig(customConfig?: Partial<NewsConfig>): NewsConfig {
  if (!customConfig) {
    return defaultNewsConfig;
  }
  
  // Deep merge configuration objects
  // Arrays are replaced entirely, objects are merged
  return {
    ...defaultNewsConfig,
    ...customConfig,
    categories: customConfig.categories || defaultNewsConfig.categories,
    sources: customConfig.sources || defaultNewsConfig.sources,
    sentimentWords: {
      ...defaultNewsConfig.sentimentWords,
      ...customConfig.sentimentWords
    },
    cacheSettings: {
      ...defaultNewsConfig.cacheSettings,
      ...customConfig.cacheSettings
    }
  };
}