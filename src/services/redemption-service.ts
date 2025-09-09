/**
 * Token Redemption Service
 * Automatically monitors and redeems winning positions from resolved Polymarket markets
 * Uses the Polymarket plugin's redeemWinnings action for consistency
 */

import { type IAgentRuntime, logger, Service, type Memory, type State, type Content } from "@elizaos/core";
import { redeemWinningsAction } from "../../plugin-polymarket/src/actions/redeemWinnings";

interface RedemptionServiceResult {
  totalRedeemed: number;
  successCount: number;
  failedCount: number;
  results: Array<{
    market: string;
    txHash: string;
    status: string;
    error?: string;
  }>;
}

export class RedemptionService extends Service {
  static serviceType = "redemption-service";
  capabilityDescription =
    "Automatically monitors and redeems winning positions from resolved Polymarket markets";

  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
  private isChecking = false;
  private lastCheckTime: Date | null = null;
  private telegramBroadcaster: any = null; // Will be injected when Telegram service is ready

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  /**
   * Start the redemption service
   */
  static async start(runtime: IAgentRuntime): Promise<RedemptionService> {
    const service = new RedemptionService(runtime);
    await service.initialize();
    service.startAutomaticRedemption();
    return service;
  }

  /**
   * Initialize the service
   */
  private async initialize(): Promise<void> {
    try {
      // Validate that the redeemWinnings action is available
      if (!redeemWinningsAction) {
        throw new Error("redeemWinnings action not available from Polymarket plugin");
      }
      logger.info("[RedemptionService] Initialized successfully with Polymarket plugin");
    } catch (error) {
      logger.error("[RedemptionService] Failed to initialize:", error);
      throw error;
    }
  }

  /**
   * Start automatic redemption checking
   */
  private startAutomaticRedemption(): void {
    logger.info("[RedemptionService] Starting automatic redemption monitoring");

    // Check immediately on startup
    this.checkAndRedeemWinnings();

    // Then check periodically
    this.checkInterval = setInterval(() => {
      this.checkAndRedeemWinnings();
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop the service
   */
  async stop(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    logger.info("[RedemptionService] Stopped");
  }

  /**
   * Main method to check and redeem winning positions
   */
  private async checkAndRedeemWinnings(): Promise<void> {
    if (this.isChecking) {
      logger.info("[RedemptionService] Check already in progress, skipping");
      return;
    }

    this.isChecking = true;
    this.lastCheckTime = new Date();

    try {
      logger.info("[RedemptionService] Starting redemption check using Polymarket plugin");

      // Create a mock memory object for the action
      const mockMemory: Memory = {
        id: crypto.randomUUID(),
        entityId: crypto.randomUUID(),
        agentId: this.runtime.agentId,
        roomId: crypto.randomUUID(),
        content: {
          text: "redeem all winnings",
          actions: ["REDEEM_WINNINGS"],
        },
        createdAt: Date.now(),
      };

      // Create a minimal state object
      const state: State = {
        userId: crypto.randomUUID(),
        agentId: this.runtime.agentId,
        roomId: crypto.randomUUID(),
        values: {},
        data: {},
        text: "",
      };

      // Validate that the action would trigger
      const isValid = await redeemWinningsAction.validate(this.runtime, mockMemory, state);
      
      if (!isValid) {
        logger.warn("[RedemptionService] redeemWinnings action validation failed - likely no private key configured");
        this.isChecking = false;
        return;
      }

      // Execute the redemption action
      const result = await redeemWinningsAction.handler(
        this.runtime,
        mockMemory,
        state,
        {},
        async (content: Content): Promise<Memory[]> => {
          // Log progress updates from the action
          if (typeof content === 'object' && content.text) {
            logger.info(`[RedemptionService] Action update: ${content.text.substring(0, 100)}...`);
          }
          return []; // Return empty array as we don't need to create memories
        }
      );
      
      if (!result) {
        logger.warn("[RedemptionService] No result returned from redemption action");
        this.isChecking = false;
        return;
      }

      // Process the result
      if (result.success && result.data) {
        const data = result.data as RedemptionServiceResult;
        
        if (data.successCount > 0) {
          logger.info(
            `[RedemptionService] Redemption complete: ${data.successCount} markets redeemed, total: ~$${data.totalRedeemed.toFixed(2)} USDC`
          );

          // Notify via Telegram if available
          if (this.telegramBroadcaster && data.results) {
            for (const redemption of data.results) {
              if (redemption.status === "success") {
                await this.telegramBroadcaster.notifyRedemption({
                  marketQuestion: redemption.market,
                  txHash: redemption.txHash,
                  amountRedeemed: (data.totalRedeemed / data.successCount).toFixed(2),
                  success: true,
                });
              }
            }
          }
        } else {
          logger.info("[RedemptionService] No positions were redeemed");
        }
      } else {
        logger.warn("[RedemptionService] Redemption action did not succeed or returned no data");
      }
    } catch (error) {
      logger.error("[RedemptionService] Error during redemption check:", error);
    } finally {
      this.isChecking = false;
    }
  }


  /**
   * Set the Telegram broadcaster for notifications
   */
  setTelegramBroadcaster(broadcaster: any): void {
    this.telegramBroadcaster = broadcaster;
  }

  /**
   * Get service status
   */
  getStatus(): {
    running: boolean;
    lastCheckTime: Date | null;
    nextCheckTime: Date | null;
  } {
    return {
      running: this.checkInterval !== null,
      lastCheckTime: this.lastCheckTime,
      nextCheckTime: this.lastCheckTime
        ? new Date(this.lastCheckTime.getTime() + this.CHECK_INTERVAL_MS)
        : null,
    };
  }
}
