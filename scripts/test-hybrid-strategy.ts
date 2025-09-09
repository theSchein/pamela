#!/usr/bin/env node
/**
 * Test script for the hybrid trading strategy with news intelligence
 * This script tests the market scanner and opportunity evaluator with news signals
 */

import { elizaLogger } from "@elizaos/core";
import { MarketKeywordExtractor } from "../src/services/news/market-keyword-extractor.js";
import { HybridConfidenceScorer } from "../src/services/news/hybrid-confidence-scorer.js";
import { NewsSignal } from "../src/services/news/news-service.js";

// Configure logging
elizaLogger.info("🧪 Testing Hybrid Trading Strategy with News Intelligence");

// Test markets
const testMarkets = [
  {
    title: "Will the Fed raise interest rates in January 2025?",
    rules: "This market resolves YES if the Federal Reserve announces a rate hike in their January FOMC meeting"
  },
  {
    title: "Will there be a US recession in 2025?",
    rules: "Resolves YES if NBER declares a recession starting in 2025"
  },
  {
    title: "Will Trump win the 2024 presidential election?",
    rules: "Resolves YES if Donald Trump wins the 2024 US presidential election"
  }
];

// Test keyword extraction
elizaLogger.info("\n📝 Testing Keyword Extraction:");
elizaLogger.info("=" .repeat(50));

for (const market of testMarkets) {
  elizaLogger.info(`\nMarket: "${market.title}"`);
  
  const keywords = MarketKeywordExtractor.extractKeywords(market.title, market.rules);
  
  elizaLogger.info(`  Entities: ${keywords.entities.join(", ") || "none"}`);
  elizaLogger.info(`  Topics: ${keywords.topics.join(", ") || "none"}`);
  elizaLogger.info(`  Timeframes: ${keywords.timeframes.join(", ") || "none"}`);
  elizaLogger.info(`  Search query: "${MarketKeywordExtractor.createSearchQuery(keywords)}"`);
}

// Test hybrid confidence scoring
elizaLogger.info("\n\n🎯 Testing Hybrid Confidence Scoring:");
elizaLogger.info("=" .repeat(50));

const scorer = new HybridConfidenceScorer();

// Simulate different scenarios
const scenarios = [
  {
    name: "Strong price edge + aligned news",
    priceEdge: 0.08, // 8% edge
    newsSignal: {
      market: "Test market",
      signal: "bullish" as const,
      confidence: 0.75,
      articles: [
        { title: "Fed likely to raise rates", description: "Analysts predict rate hike", url: "", source: "Reuters", publishedAt: new Date() },
        { title: "Strong economic data supports rate increase", description: "GDP growth exceeds expectations", url: "", source: "Bloomberg", publishedAt: new Date() }
      ]
    },
    outcome: "YES" as const
  },
  {
    name: "Strong price edge + opposing news",
    priceEdge: 0.08,
    newsSignal: {
      market: "Test market",
      signal: "bearish" as const,
      confidence: 0.70,
      articles: [
        { title: "Fed signals pause in rate hikes", description: "Officials suggest wait-and-see approach", url: "", source: "WSJ", publishedAt: new Date() }
      ]
    },
    outcome: "YES" as const
  },
  {
    name: "Weak price edge + strong news",
    priceEdge: 0.03,
    newsSignal: {
      market: "Test market",
      signal: "bullish" as const,
      confidence: 0.85,
      articles: [
        { title: "Breaking: Fed announces rate hike", description: "Surprise decision", url: "", source: "CNBC", publishedAt: new Date() },
        { title: "Markets surge on Fed decision", description: "Positive reaction", url: "", source: "FT", publishedAt: new Date() },
        { title: "Economists unanimous on rate path", description: "Clear consensus", url: "", source: "Bloomberg", publishedAt: new Date() }
      ]
    },
    outcome: "YES" as const
  },
  {
    name: "No news available",
    priceEdge: 0.05,
    newsSignal: {
      market: "Test market",
      signal: "neutral" as const,
      confidence: 0,
      articles: []
    },
    outcome: "NO" as const
  }
];

for (const scenario of scenarios) {
  elizaLogger.info(`\nScenario: ${scenario.name}`);
  elizaLogger.info(`  Price edge: ${(scenario.priceEdge * 100).toFixed(1)}%`);
  elizaLogger.info(`  News signal: ${scenario.newsSignal.signal} (${scenario.newsSignal.articles.length} articles)`);
  elizaLogger.info(`  Considering: ${scenario.outcome}`);
  
  const result = scorer.calculateHybridConfidence(
    scenario.priceEdge,
    scenario.newsSignal,
    scenario.outcome
  );
  
  elizaLogger.info(`  Results:`);
  elizaLogger.info(`    Price confidence: ${(result.priceConfidence * 100).toFixed(1)}%`);
  elizaLogger.info(`    News confidence: ${(result.newsConfidence * 100).toFixed(1)}%`);
  elizaLogger.info(`    Combined confidence: ${(result.combinedConfidence * 100).toFixed(1)}%`);
  elizaLogger.info(`    Should trade: ${result.shouldTrade ? "✅ YES" : "❌ NO"}`);
  elizaLogger.info(`    Reasoning: ${result.reasoning}`);
}

// Test relevance scoring
elizaLogger.info("\n\n📰 Testing News Relevance Scoring:");
elizaLogger.info("=" .repeat(50));

const testArticles = [
  {
    title: "Federal Reserve announces rate decision tomorrow",
    text: "The Federal Reserve will announce its interest rate decision at the January FOMC meeting tomorrow. Economists expect a 25 basis point hike."
  },
  {
    title: "Sports team wins championship",
    text: "The local sports team won the championship game last night in an exciting overtime victory."
  },
  {
    title: "Fed Chair Powell signals hawkish stance",
    text: "Jerome Powell indicated the Fed may need to raise rates more aggressively in 2025 to combat inflation."
  }
];

const marketKeywords = MarketKeywordExtractor.extractKeywords(
  "Will the Fed raise interest rates in January 2025?",
  "This market resolves YES if the Federal Reserve announces a rate hike"
);

elizaLogger.info(`\nMarket keywords: ${marketKeywords.all.slice(0, 5).join(", ")}`);

for (const article of testArticles) {
  const relevance = MarketKeywordExtractor.calculateRelevanceScore(
    `${article.title} ${article.text}`,
    marketKeywords
  );
  
  elizaLogger.info(`\nArticle: "${article.title}"`);
  elizaLogger.info(`  Relevance score: ${(relevance * 100).toFixed(1)}%`);
}

elizaLogger.info("\n\n✅ Hybrid strategy test complete!");
elizaLogger.info("The system is ready to combine price thresholds with news intelligence for smarter trading decisions.");