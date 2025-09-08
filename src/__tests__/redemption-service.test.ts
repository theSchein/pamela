import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { type IAgentRuntime } from "@elizaos/core";

describe("RedemptionService", () => {
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
          RPC_URL: "https://polygon-rpc.com",
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

  describe("Service Properties", () => {
    it("should have correct service type", async () => {
      // Dynamically import to avoid initialization issues
      const { RedemptionService } = await import("../services/redemption-service");
      expect(RedemptionService.serviceType).toBe("redemption-service");
    });

    it("should have a start method", async () => {
      const { RedemptionService } = await import("../services/redemption-service");
      expect(typeof RedemptionService.start).toBe("function");
    });
  });

  describe("Service Instance", () => {
    it("should create service instance", async () => {
      const { RedemptionService } = await import("../services/redemption-service");
      const service = new RedemptionService(mockRuntime);
      expect(service).toBeDefined();
      expect(service.capabilityDescription).toContain("redeem");
    });

    it("should have getStatus method", async () => {
      const { RedemptionService } = await import("../services/redemption-service");
      const service = new RedemptionService(mockRuntime);
      expect(typeof service.getStatus).toBe("function");
    });

    it("should have setTelegramBroadcaster method", async () => {
      const { RedemptionService } = await import("../services/redemption-service");
      const service = new RedemptionService(mockRuntime);
      expect(typeof service.setTelegramBroadcaster).toBe("function");
    });

    it("should have stop method", async () => {
      const { RedemptionService } = await import("../services/redemption-service");
      const service = new RedemptionService(mockRuntime);
      expect(typeof service.stop).toBe("function");
    });
  });

  describe("Service Status", () => {
    it("should return status object", async () => {
      const { RedemptionService } = await import("../services/redemption-service");
      const service = new RedemptionService(mockRuntime);
      const status = service.getStatus();
      
      expect(status).toHaveProperty("running");
      expect(status).toHaveProperty("lastCheckTime");
      expect(status).toHaveProperty("nextCheckTime");
      expect(status.running).toBe(false); // Not started yet
      expect(status.lastCheckTime).toBeNull();
      expect(status.nextCheckTime).toBeNull();
    });
  });

  describe("Telegram Integration", () => {
    it("should accept telegram broadcaster", async () => {
      const { RedemptionService } = await import("../services/redemption-service");
      const service = new RedemptionService(mockRuntime);
      const mockBroadcaster = { notifyRedemption: mock() };
      
      // Should not throw
      service.setTelegramBroadcaster(mockBroadcaster);
      expect(service).toBeDefined();
    });
  });
});