import { elizaLogger } from "@elizaos/core";

export interface ExtractedKeywords {
  entities: string[];      // Named entities (Fed, US, Trump, etc.)
  topics: string[];        // Topic keywords (recession, inflation, rate hike)
  timeframes: string[];    // Time references (2025, January, Q1)
  actions: string[];       // Action words (cut, raise, win, announce)
  all: string[];          // All keywords combined
}

export class MarketKeywordExtractor {
  private static readonly STOP_WORDS = new Set([
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
    "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
    "this", "but", "his", "by", "from", "will", "or", "what", "go",
    "can", "than", "if", "their", "said", "an", "each", "she", "which",
    "there", "been", "may", "after", "other", "into", "any", "before"
  ]);

  private static readonly ENTITY_PATTERNS = [
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g,  // Proper nouns
    /\b(?:US|USA|UK|EU|UN|NATO|OPEC|IMF|WHO|CDC|FDA|EPA)\b/gi,  // Common acronyms
    /\b(?:Fed|Federal Reserve|Congress|Senate|White House)\b/gi,  // Institutions
  ];

  private static readonly TIME_PATTERNS = [
    /\b20\d{2}\b/g,  // Years
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/gi,
    /\b(?:Q[1-4]|H[12])\s*20\d{2}\b/gi,  // Quarters and halves
    /\b(?:next|this|last)\s+(?:week|month|year|quarter)\b/gi,
  ];

  private static readonly TOPIC_KEYWORDS = [
    // Economic
    "recession", "inflation", "deflation", "growth", "gdp", "unemployment",
    "rate", "hike", "cut", "interest", "stimulus", "budget", "deficit",
    "trade", "tariff", "sanctions", "economy", "market", "stock", "crypto",
    
    // Political
    "election", "vote", "poll", "campaign", "president", "congress", "senate",
    "impeachment", "nomination", "confirmation", "legislation", "bill", "law",
    
    // Events
    "announce", "release", "report", "meeting", "summit", "conference",
    "decision", "ruling", "verdict", "approval", "rejection",
    
    // Outcomes
    "win", "lose", "pass", "fail", "approve", "reject", "confirm", "deny",
    "increase", "decrease", "rise", "fall", "exceed", "below", "above"
  ];

  static extractKeywords(marketTitle: string, marketRules?: string): ExtractedKeywords {
    const text = `${marketTitle} ${marketRules || ""}`.toLowerCase();
    const originalText = `${marketTitle} ${marketRules || ""}`;
    
    const result: ExtractedKeywords = {
      entities: [],
      topics: [],
      timeframes: [],
      actions: [],
      all: []
    };

    // Extract entities (proper nouns and acronyms)
    for (const pattern of this.ENTITY_PATTERNS) {
      const matches = originalText.match(pattern);
      if (matches) {
        result.entities.push(...matches.map(m => m.trim()));
      }
    }
    result.entities = [...new Set(result.entities)];

    // Extract timeframes
    for (const pattern of this.TIME_PATTERNS) {
      const matches = originalText.match(pattern);
      if (matches) {
        result.timeframes.push(...matches.map(m => m.trim()));
      }
    }
    result.timeframes = [...new Set(result.timeframes)];

    // Extract topic keywords
    for (const keyword of this.TOPIC_KEYWORDS) {
      if (text.includes(keyword.toLowerCase())) {
        result.topics.push(keyword);
      }
    }

    // Extract action words (verbs that indicate events)
    const actionWords = text.match(/\b(will|shall|might|could|would|should)\s+(\w+)\b/gi);
    if (actionWords) {
      result.actions.push(...actionWords.map(m => m.split(/\s+/)[1]));
    }

    // Extract significant words (excluding stop words)
    const words = text.split(/\W+/).filter(word => 
      word.length > 2 && 
      !this.STOP_WORDS.has(word.toLowerCase()) &&
      /^[a-z]+$/i.test(word)
    );

    // Combine all keywords
    result.all = [
      ...result.entities,
      ...result.topics,
      ...result.timeframes,
      ...result.actions,
      ...words.slice(0, 10) // Add top 10 non-stop words
    ];
    result.all = [...new Set(result.all.map(k => k.toLowerCase()))];

    elizaLogger.debug(`Extracted keywords from "${marketTitle.substring(0, 50)}..."`);
    elizaLogger.debug(`  Entities: ${result.entities.join(", ")}`);
    elizaLogger.debug(`  Topics: ${result.topics.join(", ")}`);
    elizaLogger.debug(`  Timeframes: ${result.timeframes.join(", ")}`);

    return result;
  }

  static createSearchQuery(keywords: ExtractedKeywords): string {
    // Priority order: entities + main topics
    const priorityTerms = [
      ...keywords.entities.slice(0, 2),
      ...keywords.topics.slice(0, 2)
    ];

    if (priorityTerms.length === 0) {
      // Fallback to any keywords
      return keywords.all.slice(0, 3).join(" ");
    }

    return priorityTerms.join(" ");
  }

  static calculateRelevanceScore(
    articleText: string,
    keywords: ExtractedKeywords
  ): number {
    const text = articleText.toLowerCase();
    let score = 0;
    let matches = 0;

    // Entity matches (highest weight)
    for (const entity of keywords.entities) {
      if (text.includes(entity.toLowerCase())) {
        score += 3;
        matches++;
      }
    }

    // Topic matches (medium weight)
    for (const topic of keywords.topics) {
      if (text.includes(topic.toLowerCase())) {
        score += 2;
        matches++;
      }
    }

    // Timeframe matches (low weight)
    for (const timeframe of keywords.timeframes) {
      if (text.includes(timeframe.toLowerCase())) {
        score += 1;
        matches++;
      }
    }

    // Normalize score (0-1)
    const maxPossibleScore = 
      keywords.entities.length * 3 + 
      keywords.topics.length * 2 + 
      keywords.timeframes.length;
    
    if (maxPossibleScore === 0) return 0;
    
    const normalizedScore = Math.min(1, score / Math.max(10, maxPossibleScore));
    
    elizaLogger.debug(`Relevance score: ${normalizedScore.toFixed(2)} (${matches} keyword matches)`);
    
    return normalizedScore;
  }
}