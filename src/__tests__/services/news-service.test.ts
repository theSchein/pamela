import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NewsService } from "../../services/news-service";
import { type IAgentRuntime } from "@elizaos/core";

// Mock fetch globally before any tests
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe("NewsService", () => {
  let mockRuntime: IAgentRuntime;
  let newsService: NewsService;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    
    // Create mock runtime
    mockRuntime = {
      getSetting: vi.fn((key: string) => {
        if (key === "NEWS_API_KEY") {
          return "test-api-key";
        }
        return null;
      }),
    } as any;

    newsService = new NewsService(mockRuntime);
  });

  afterEach(() => {
    newsService.stop();
  });

  describe("initialization", () => {
    it("should initialize with API key from runtime", () => {
      expect(mockRuntime.getSetting).toHaveBeenCalledWith("NEWS_API_KEY");
    });

    it("should handle missing API key gracefully", () => {
      const runtimeNoKey = {
        getSetting: vi.fn(() => null),
      } as any;

      const service = new NewsService(runtimeNoKey);
      expect(service).toBeDefined();
      service.stop();
    });
  });

  describe("start/stop", () => {
    it("should start fetching news periodically", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          status: "ok",
          totalResults: 1,
          articles: [
            {
              title: "Test Article",
              description: "Test description",
              content: "Test content",
              url: "https://example.com",
              publishedAt: new Date().toISOString(),
              source: { id: null, name: "Test Source" },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await newsService.start();
      
      expect(mockFetch).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://newsapi.org/v2/top-headlines")
      );
    });

    it("should not start without API key", async () => {
      const runtimeNoKey = {
        getSetting: vi.fn(() => null),
      } as any;

      const service = new NewsService(runtimeNoKey);
      await service.start();
      
      expect(mockFetch).not.toHaveBeenCalled();
      service.stop();
    });

    it("should stop fetching when stopped", () => {
      newsService.stop();
      // Should not throw
      expect(() => newsService.stop()).not.toThrow();
    });
  });

  describe("getRelevantNews", () => {
    it("should return filtered news for a topic", async () => {
      const mockArticles = [
        {
          title: "Election Poll Results",
          description: "Latest election polling data",
          content: "Detailed election coverage",
          url: "https://example.com/1",
          publishedAt: new Date().toISOString(),
          source: { id: null, name: "Reuters" },
        },
        {
          title: "Stock Market Update",
          description: "Markets rise on earnings",
          content: "Stock market analysis",
          url: "https://example.com/2",
          publishedAt: new Date().toISOString(),
          source: { id: null, name: "Bloomberg" },
        },
        {
          title: "Sports News",
          description: "Championship finals",
          content: "Sports coverage",
          url: "https://example.com/3",
          publishedAt: new Date().toISOString(),
          source: { id: null, name: "ESPN" },
        },
      ];

      const mockResponse = {
        ok: true,
        json: async () => ({
          status: "ok",
          totalResults: mockArticles.length,
          articles: mockArticles,
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const news = await newsService.getRelevantNews("election", 2);
      
      expect(news).toHaveLength(1);
      expect(news[0].title).toContain("Election");
    });

    it("should handle empty results", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          status: "ok",
          totalResults: 0,
          articles: [],
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const news = await newsService.getRelevantNews("xyz123", 5);
      expect(news).toHaveLength(0);
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const news = await newsService.getRelevantNews("test", 5);
      expect(news).toHaveLength(0);
    });
  });

  describe("getNewsSentiment", () => {
    it("should analyze positive sentiment", async () => {
      const mockArticles = [
        {
          title: "Market Surge Brings Gains",
          description: "Positive growth and success",
          content: "Markets advance with breakthrough improvements",
          url: "https://example.com/1",
          publishedAt: new Date().toISOString(),
          source: { id: null, name: "Reuters" },
        },
      ];

      const mockResponse = {
        ok: true,
        json: async () => ({
          status: "ok",
          totalResults: 1,
          articles: mockArticles,
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const sentiment = await newsService.getNewsSentiment("market");
      expect(sentiment).toBe("positive");
    });

    it("should analyze negative sentiment", async () => {
      const mockArticles = [
        {
          title: "Market Crash and Crisis",
          description: "Losses mount as concerns grow",
          content: "Markets fall with risk and danger ahead",
          url: "https://example.com/1",
          publishedAt: new Date().toISOString(),
          source: { id: null, name: "Reuters" },
        },
      ];

      const mockResponse = {
        ok: true,
        json: async () => ({
          status: "ok",
          totalResults: 1,
          articles: mockArticles,
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const sentiment = await newsService.getNewsSentiment("market");
      expect(sentiment).toBe("negative");
    });

    it("should return neutral for mixed or no sentiment", async () => {
      const mockArticles = [
        {
          title: "Market Update",
          description: "Trading continues",
          content: "Markets remain stable",
          url: "https://example.com/1",
          publishedAt: new Date().toISOString(),
          source: { id: null, name: "Reuters" },
        },
      ];

      const mockResponse = {
        ok: true,
        json: async () => ({
          status: "ok",
          totalResults: 1,
          articles: mockArticles,
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const sentiment = await newsService.getNewsSentiment("market");
      expect(sentiment).toBe("neutral");
    });

    it("should return neutral when no articles found", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          status: "ok",
          totalResults: 0,
          articles: [],
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const sentiment = await newsService.getNewsSentiment("unknown");
      expect(sentiment).toBe("neutral");
    });
  });

  describe("getNewsSummary", () => {
    it("should generate formatted summary", async () => {
      const mockArticles = [
        {
          title: "Breaking News 1",
          description: "Important update",
          content: "Full content",
          url: "https://example.com/1",
          publishedAt: new Date().toISOString(),
          source: { id: null, name: "Reuters" },
        },
        {
          title: "Breaking News 2",
          description: "Another update",
          content: "More content",
          url: "https://example.com/2",
          publishedAt: new Date().toISOString(),
          source: { id: null, name: "Bloomberg" },
        },
      ];

      const mockResponse = {
        ok: true,
        json: async () => ({
          status: "ok",
          totalResults: 2,
          articles: mockArticles,
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const summary = await newsService.getNewsSummary();
      
      expect(summary).toContain("Recent Market News");
      expect(summary).toContain("Breaking News 1");
      expect(summary).toContain("Breaking News 2");
      expect(summary).toContain("Reuters");
      expect(summary).toContain("Bloomberg");
    });

    it("should handle no news available", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          status: "ok",
          totalResults: 0,
          articles: [],
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const summary = await newsService.getNewsSummary();
      expect(summary).toBe("No recent market-relevant news available.");
    });
  });
});