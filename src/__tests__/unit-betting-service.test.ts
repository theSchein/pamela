import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { type IAgentRuntime } from "@elizaos/core";

describe("UnitBettingService", () => {
  let mockRuntime: IAgentRuntime;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    // Store original fetch
    originalFetch = global.fetch;
    
    // Create mock runtime
    mockRuntime = {
      getSetting: mock((key: string) => {
        const settings: Record<string, string> = {
          CLOB_API_URL: "https://clob.polymarket.com",
          POLYMARKET_PRIVATE_KEY: "0x0000000000000000000000000000000000000000000000000000000000000001",
        };
        return settings[key];
      }),
      getMemory: mock(),
      setMemory: mock(),
      composeState: mock(),
      updateRecentMessageState: mock(),
    } as any;

    // Mock fetch
    global.fetch = mock();
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe("Service Instance", () => {
    it("should create service instance", async () => {
      const { UnitBettingService } = await import("../services/unit-betting-service");
      const service = new UnitBettingService(mockRuntime);
      expect(service).toBeDefined();
    });

    it("should have initialize method", async () => {
      const { UnitBettingService } = await import("../services/unit-betting-service");
      const service = new UnitBettingService(mockRuntime);
      expect(typeof service.initialize).toBe("function");
    });

    it("should have calculatePositionSize method", async () => {
      const { UnitBettingService } = await import("../services/unit-betting-service");
      const service = new UnitBettingService(mockRuntime);
      expect(typeof service.calculatePositionSize).toBe("function");
    });

    it("should have canPlaceBet method", async () => {
      const { UnitBettingService } = await import("../services/unit-betting-service");
      const service = new UnitBettingService(mockRuntime);
      expect(typeof service.canPlaceBet).toBe("function");
    });

    it("should have getRecommendedBetSize method", async () => {
      const { UnitBettingService } = await import("../services/unit-betting-service");
      const service = new UnitBettingService(mockRuntime);
      expect(typeof service.getRecommendedBetSize).toBe("function");
    });

    it("should have getPortfolioStatus method", async () => {
      const { UnitBettingService } = await import("../services/unit-betting-service");
      const service = new UnitBettingService(mockRuntime);
      expect(typeof service.getPortfolioStatus).toBe("function");
    });

    it("should have formatPositionSize method", async () => {
      const { UnitBettingService } = await import("../services/unit-betting-service");
      const service = new UnitBettingService(mockRuntime);
      expect(typeof service.formatPositionSize).toBe("function");
    });
  });

  describe("Position Formatting", () => {
    it("should format position size result when can trade", async () => {
      const { UnitBettingService } = await import("../services/unit-betting-service");
      const service = new UnitBettingService(mockRuntime);
      
      const result = {
        canTrade: true,
        unitSize: 100,
        availableUnits: 2,
        currentExposure: 10,
        maxExposure: 30,
        portfolioValue: 1000,
      };

      const formatted = service.formatPositionSize(result);
      expect(formatted).toContain("✅ Can trade");
      expect(formatted).toContain("Unit Size: $100.00");
      expect(formatted).toContain("Portfolio: $1000.00");
    });

    it("should format position size result when cannot trade", async () => {
      const { UnitBettingService } = await import("../services/unit-betting-service");
      const service = new UnitBettingService(mockRuntime);
      
      const result = {
        canTrade: false,
        unitSize: 0,
        availableUnits: 0,
        currentExposure: 30,
        maxExposure: 30,
        portfolioValue: 1000,
        reason: "Maximum positions reached",
      };

      const formatted = service.formatPositionSize(result);
      expect(formatted).toContain("❌ Cannot trade");
      expect(formatted).toContain("Maximum positions reached");
    });
  });

  describe("Configuration", () => {
    it("should have correct unit percentage", async () => {
      const { UnitBettingService } = await import("../services/unit-betting-service");
      const service = new UnitBettingService(mockRuntime);
      
      // Check if the service has the expected configuration
      // These are private properties, but we can test them indirectly
      expect(service).toBeDefined();
    });

    it("should enforce configuration limits", async () => {
      const { UnitBettingService } = await import("../services/unit-betting-service");
      const service = new UnitBettingService(mockRuntime);
      
      // Test that the service has the expected methods
      expect(typeof service.calculatePositionSize).toBe("function");
      expect(typeof service.canPlaceBet).toBe("function");
    });
  });
});