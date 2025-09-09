import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConfidenceScorer, type MarketData } from "../../services/confidence-scorer";
import { type IAgentRuntime } from "@elizaos/core";
import * as newsServiceModule from "../../services/news-service";

// Mock the news service module
vi.mock("../../services/news-service", () => ({
  getNewsService: vi.fn(() => ({
    getNewsSentiment: vi.fn(),
    getRelevantNews: vi.fn(),
  })),
}));

describe("ConfidenceScorer", () => {
  let mockRuntime: IAgentRuntime;
  let confidenceScorer: ConfidenceScorer;
  let mockNewsService: any;

  beforeEach(() => {
    // Create mock runtime
    mockRuntime = {
      getSetting: vi.fn((key: string) => {
        if (key === "NEWS_API_KEY") {
          return "test-api-key";
        }
        return null;
      }),
    } as any;

    // Setup mock news service
    mockNewsService = {
      getNewsSentiment: vi.fn().mockResolvedValue("neutral"),
      getRelevantNews: vi.fn().mockResolvedValue([]),
    };
    
    vi.mocked(newsServiceModule.getNewsService).mockReturnValue(mockNewsService);

    confidenceScorer = new ConfidenceScorer(mockRuntime);
    vi.clearAllMocks();
  });

  describe("calculateConfidence", () => {
    it("should calculate confidence for a high-confidence market", async () => {
      const market: MarketData = {
        id: "test-market-1",
        question: "Will the election happen?",
        description: "Test market description",
        volume24hr: 75000, // High volume
        liquidityNum: 10000,
        endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
        currentPrices: {
          yes: 0.35, // Favorable price
          no: 0.65,
        },
      };

      mockNewsService.getNewsSentiment.mockResolvedValue("positive");
      mockNewsService.getRelevantNews.mockResolvedValue([
        { title: "Article 1" },
        { title: "Article 2" },
        { title: "Article 3" },
        { title: "Article 4" },
      ]);

      const result = await confidenceScorer.calculateConfidence(market, "yes");

      expect(result.overall).toBeGreaterThan(70);
      expect(result.recommendation).toMatch(/yes|strong_yes/);
      expect(result.factors.newsSentiment).toBe("positive");
      expect(result.factors.marketVolume).toBe("high");
      expect(result.factors.timeToResolution).toBe("urgent");
      expect(result.reasoning).toContain("confidence");
    });

    it("should calculate low confidence for poor market conditions", async () => {
      const market: MarketData = {
        id: "test-market-2",
        question: "Will something happen?",
        volume24hr: 2000, // Low volume
        endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days from now
        currentPrices: {
          yes: 0.85, // Unfavorable price
          no: 0.15,
        },
      };

      mockNewsService.getNewsSentiment.mockResolvedValue("negative");
      mockNewsService.getRelevantNews.mockResolvedValue([]);

      const result = await confidenceScorer.calculateConfidence(market, "yes");

      expect(result.overall).toBeLessThan(50);
      expect(result.recommendation).toMatch(/skip|strong_no|no/);
      expect(result.factors.marketVolume).toBe("low");
      expect(result.factors.timeToResolution).toBe("distant");
    });

    it("should handle markets without end dates", async () => {
      const market: MarketData = {
        id: "test-market-3",
        question: "Perpetual market?",
        volume24hr: 25000,
        // No endDate provided
      };

      const result = await confidenceScorer.calculateConfidence(market, "no");

      expect(result.factors.timeToResolution).toBe("distant");
      expect(result.factors.timeToResolutionScore).toBeLessThan(50);
    });

    it("should boost confidence for favorable prices", async () => {
      const marketGoodPrice: MarketData = {
        id: "test-market-4",
        question: "Test market",
        volume24hr: 30000,
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        currentPrices: {
          yes: 0.30, // Very favorable
          no: 0.70,
        },
      };

      const marketBadPrice: MarketData = {
        ...marketGoodPrice,
        currentPrices: {
          yes: 0.75, // Unfavorable
          no: 0.25,
        },
      };

      const resultGood = await confidenceScorer.calculateConfidence(marketGoodPrice, "yes");
      const resultBad = await confidenceScorer.calculateConfidence(marketBadPrice, "yes");

      expect(resultGood.overall).toBeGreaterThan(resultBad.overall);
    });
  });

  describe("factor assessment", () => {
    it("should correctly assess market volume levels", async () => {
      const highVolumeMarket: MarketData = {
        id: "high-vol",
        question: "Test",
        volume24hr: 100000,
      };

      const mediumVolumeMarket: MarketData = {
        id: "med-vol",
        question: "Test",
        volume24hr: 25000,
      };

      const lowVolumeMarket: MarketData = {
        id: "low-vol",
        question: "Test",
        volume24hr: 5000,
      };

      const highResult = await confidenceScorer.calculateConfidence(highVolumeMarket, "yes");
      const medResult = await confidenceScorer.calculateConfidence(mediumVolumeMarket, "yes");
      const lowResult = await confidenceScorer.calculateConfidence(lowVolumeMarket, "yes");

      expect(highResult.factors.marketVolume).toBe("high");
      expect(highResult.factors.marketVolumeScore).toBeGreaterThan(70);

      expect(medResult.factors.marketVolume).toBe("medium");
      expect(medResult.factors.marketVolumeScore).toBeGreaterThan(40);
      expect(medResult.factors.marketVolumeScore).toBeLessThan(70);

      expect(lowResult.factors.marketVolume).toBe("low");
      expect(lowResult.factors.marketVolumeScore).toBeLessThan(40);
    });

    it("should correctly assess time urgency", async () => {
      const urgentMarket: MarketData = {
        id: "urgent",
        question: "Test",
        volume24hr: 20000,
        endDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day
      };

      const normalMarket: MarketData = {
        id: "normal",
        question: "Test",
        volume24hr: 20000,
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      };

      const distantMarket: MarketData = {
        id: "distant",
        question: "Test",
        volume24hr: 20000,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      };

      const urgentResult = await confidenceScorer.calculateConfidence(urgentMarket, "yes");
      const normalResult = await confidenceScorer.calculateConfidence(normalMarket, "yes");
      const distantResult = await confidenceScorer.calculateConfidence(distantMarket, "yes");

      expect(urgentResult.factors.timeToResolution).toBe("urgent");
      expect(urgentResult.factors.timeToResolutionScore).toBeGreaterThan(80);

      expect(normalResult.factors.timeToResolution).toBe("normal");
      expect(normalResult.factors.timeToResolutionScore).toBeGreaterThan(50);
      expect(normalResult.factors.timeToResolutionScore).toBeLessThan(80);

      expect(distantResult.factors.timeToResolution).toBe("distant");
      expect(distantResult.factors.timeToResolutionScore).toBeLessThan(50);
    });

    it("should integrate news sentiment correctly", async () => {
      const market: MarketData = {
        id: "news-test",
        question: "Will positive news affect market?",
        volume24hr: 30000,
        endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      };

      // Test positive sentiment for YES position
      mockNewsService.getNewsSentiment.mockResolvedValue("positive");
      mockNewsService.getRelevantNews.mockResolvedValue([
        { title: "Good news 1" },
        { title: "Good news 2" },
      ]);

      const positiveYes = await confidenceScorer.calculateConfidence(market, "yes");
      expect(positiveYes.factors.newsSentiment).toBe("positive");

      // Test negative sentiment for YES position
      mockNewsService.getNewsSentiment.mockResolvedValue("negative");
      const negativeYes = await confidenceScorer.calculateConfidence(market, "yes");
      expect(negativeYes.factors.newsSentiment).toBe("negative");
      expect(negativeYes.overall).toBeLessThan(positiveYes.overall);

      // Test negative sentiment for NO position (should boost confidence)
      const negativeNo = await confidenceScorer.calculateConfidence(market, "no");
      expect(negativeNo.overall).toBeGreaterThan(negativeYes.overall);
    });
  });

  describe("recommendations", () => {
    it("should recommend strong_yes for high confidence", async () => {
      const market: MarketData = {
        id: "strong-yes",
        question: "Test",
        volume24hr: 60000,
        endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        currentPrices: { yes: 0.35, no: 0.65 },
      };

      mockNewsService.getNewsSentiment.mockResolvedValue("positive");
      mockNewsService.getRelevantNews.mockResolvedValue([
        { title: "1" }, { title: "2" }, { title: "3" }, { title: "4" }
      ]);

      const result = await confidenceScorer.calculateConfidence(market, "yes");
      expect(result.overall).toBeGreaterThanOrEqual(80);
      expect(result.recommendation).toBe("strong_yes");
    });

    it("should skip low volume markets", async () => {
      const market: MarketData = {
        id: "low-vol-skip",
        question: "Test",
        volume24hr: 1000, // Very low volume
        endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const result = await confidenceScorer.calculateConfidence(market, "yes");
      expect(result.recommendation).toBe("skip");
    });

    it("should skip distant markets without strong signals", async () => {
      const market: MarketData = {
        id: "distant-skip",
        question: "Test",
        volume24hr: 25000,
        endDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days
      };

      mockNewsService.getNewsSentiment.mockResolvedValue("neutral");

      const result = await confidenceScorer.calculateConfidence(market, "yes");
      expect(result.factors.timeToResolution).toBe("distant");
      expect(result.recommendation).toMatch(/skip|no|strong_no/);
    });
  });

  describe("reasoning generation", () => {
    it("should generate comprehensive reasoning", async () => {
      const market: MarketData = {
        id: "reasoning-test",
        question: "Will event happen?",
        volume24hr: 45000,
        endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        currentPrices: { yes: 0.42, no: 0.58 },
      };

      mockNewsService.getNewsSentiment.mockResolvedValue("positive");
      mockNewsService.getRelevantNews.mockResolvedValue([{ title: "News" }]);

      const result = await confidenceScorer.calculateConfidence(market, "yes");

      expect(result.reasoning).toContain("News sentiment");
      expect(result.reasoning).toContain("market volume");
      expect(result.reasoning).toContain("Resolution");
      expect(result.reasoning).toContain("Overall confidence");
      expect(result.reasoning).toMatch(/\d+%/); // Should contain percentage
    });

    it("should mention price in reasoning when available", async () => {
      const marketWithPrice: MarketData = {
        id: "price-reasoning",
        question: "Test",
        volume24hr: 30000,
        endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        currentPrices: { yes: 0.25, no: 0.75 }, // Favorable price
      };

      const result = await confidenceScorer.calculateConfidence(marketWithPrice, "yes");
      expect(result.reasoning).toContain("Favorable entry price");
    });

    it("should warn about high prices", async () => {
      const marketHighPrice: MarketData = {
        id: "high-price",
        question: "Test",
        volume24hr: 30000,
        endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        currentPrices: { yes: 0.85, no: 0.15 }, // High price
      };

      const result = await confidenceScorer.calculateConfidence(marketHighPrice, "yes");
      expect(result.reasoning).toContain("High entry price");
      expect(result.reasoning).toContain("reduces potential upside");
    });
  });

  describe("error handling", () => {
    it("should handle news service errors gracefully", async () => {
      const market: MarketData = {
        id: "error-test",
        question: "Test market",
        volume24hr: 25000,
        endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      };

      mockNewsService.getNewsSentiment.mockRejectedValue(new Error("API error"));
      mockNewsService.getRelevantNews.mockRejectedValue(new Error("API error"));

      const result = await confidenceScorer.calculateConfidence(market, "yes");

      // Should still return a result with neutral sentiment
      expect(result).toBeDefined();
      expect(result.factors.newsSentiment).toBe("neutral");
      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(100);
    });

    it("should handle missing market data", async () => {
      const minimalMarket: MarketData = {
        id: "minimal",
        question: "Test",
        // No other fields provided
      };

      const result = await confidenceScorer.calculateConfidence(minimalMarket, "yes");

      expect(result).toBeDefined();
      expect(result.factors.marketVolume).toBe("low");
      expect(result.factors.timeToResolution).toBe("distant");
      expect(result.recommendation).toBeDefined();
    });
  });
});