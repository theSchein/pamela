/**
 * Token Redemption Service
 * Automatically monitors and redeems winning positions from resolved Polymarket markets
 */

import { type IAgentRuntime, logger, Service } from "@elizaos/core";
import { ethers, Wallet, Contract, JsonRpcProvider, ZeroHash } from "ethers";
import {
  initializeClobClient,
  type ClobClient,
} from "../../plugin-polymarket/src/utils/clobClient";

// Contract addresses (Polygon mainnet)
const CONDITIONAL_TOKENS_ADDRESS = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
const NEG_RISK_ADAPTER_ADDRESS = "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296";
const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // USDC.e

// ABIs for smart contract interaction
const CONDITIONAL_TOKENS_ABI = [
  "function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] calldata indexSets) external",
  "function payoutNumerators(bytes32 conditionId, uint256 index) external view returns (uint256)",
  "function payoutDenominator(bytes32 conditionId) external view returns (uint256)",
];

const NEG_RISK_ADAPTER_ABI = [
  "function redeemPositions(bytes32 conditionId, uint256[] calldata amounts) external",
];

interface Position {
  tokenId: string;
  marketConditionId: string;
  marketQuestion: string;
  outcome: string;
  size: string;
  value: string;
  resolved?: boolean;
  winner?: boolean;
}

interface RedemptionResult {
  marketQuestion: string;
  conditionId: string;
  amountRedeemed: string;
  txHash: string;
  success: boolean;
  error?: string;
}

export class RedemptionService extends Service {
  static serviceType = "redemption-service";
  capabilityDescription =
    "Automatically monitors and redeems winning positions from resolved Polymarket markets";

  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
  private clobClient: ClobClient | null = null;
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
      this.clobClient = await initializeClobClient(this.runtime);
      logger.info("[RedemptionService] Initialized successfully");
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
      logger.info("[RedemptionService] Starting redemption check");

      // Get current positions
      const positions = await this.getPortfolioPositions();

      if (!positions || positions.length === 0) {
        logger.info("[RedemptionService] No positions found");
        this.isChecking = false;
        return;
      }

      logger.info(
        `[RedemptionService] Found ${positions.length} positions to check`,
      );

      // Check each position for resolved markets
      const resolvedPositions = await this.checkResolvedMarkets(positions);

      if (resolvedPositions.length === 0) {
        logger.info("[RedemptionService] No resolved positions found");
        this.isChecking = false;
        return;
      }

      logger.info(
        `[RedemptionService] Found ${resolvedPositions.length} resolved positions`,
      );

      // Redeem winning positions
      const redemptionResults: RedemptionResult[] = [];

      for (const position of resolvedPositions) {
        if (position.winner) {
          const result = await this.redeemPosition(position);
          redemptionResults.push(result);

          if (result.success) {
            logger.info(
              `[RedemptionService] Successfully redeemed ${result.amountRedeemed} USDC from: ${result.marketQuestion}`,
            );

            // Notify via Telegram if available
            if (this.telegramBroadcaster) {
              await this.telegramBroadcaster.notifyRedemption(result);
            }
          } else {
            logger.error(
              `[RedemptionService] Failed to redeem position: ${result.error}`,
            );
          }
        }
      }

      // Log summary
      const successfulRedemptions = redemptionResults.filter((r) => r.success);
      const totalRedeemed = successfulRedemptions.reduce(
        (sum, r) => sum + parseFloat(r.amountRedeemed || "0"),
        0,
      );

      if (successfulRedemptions.length > 0) {
        logger.info(
          `[RedemptionService] Redemption complete: ${successfulRedemptions.length} positions redeemed, total: ${totalRedeemed} USDC`,
        );
      }
    } catch (error) {
      logger.error("[RedemptionService] Error during redemption check:", error);
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Get current portfolio positions
   */
  private async getPortfolioPositions(): Promise<Position[]> {
    try {
      const walletAddress =
        (this.clobClient as any).wallet?.address ||
        (this.clobClient as any).signer?.address;

      if (!walletAddress) {
        throw new Error("Unable to determine wallet address");
      }

      // Get positions from CLOB API
      const response = await fetch(
        `${this.runtime.getSetting("CLOB_API_URL")}/portfolio/${walletAddress}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch portfolio: ${response.statusText}`);
      }

      const data: any = await response.json();

      // Transform API response to Position format
      const positions: Position[] =
        data.positions?.map((p: any) => ({
          tokenId: p.token_id,
          marketConditionId: p.condition_id,
          marketQuestion: p.question || "Unknown market",
          outcome: p.outcome,
          size: p.size,
          value: p.current_value || "0",
          resolved: false,
          winner: false,
        })) || [];

      return positions;
    } catch (error) {
      logger.error(
        "[RedemptionService] Failed to get portfolio positions:",
        error,
      );
      return [];
    }
  }

  /**
   * Check which markets have been resolved
   */
  private async checkResolvedMarkets(
    positions: Position[],
  ): Promise<Position[]> {
    const resolvedPositions: Position[] = [];

    for (const position of positions) {
      try {
        // Check market resolution status via CLOB API
        const response = await fetch(
          `${this.runtime.getSetting("CLOB_API_URL")}/markets/${position.marketConditionId}`,
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        if (response.ok) {
          const marketData: any = await response.json();

          if (marketData.resolved === true) {
            position.resolved = true;

            // Check if this position is a winner
            const winningOutcome = marketData.winning_outcome;
            if (winningOutcome && position.outcome === winningOutcome) {
              position.winner = true;
              resolvedPositions.push(position);
            }
          }
        }
      } catch (error) {
        logger.error(
          `[RedemptionService] Error checking market ${position.marketConditionId}:`,
          error,
        );
      }
    }

    return resolvedPositions;
  }

  /**
   * Redeem a winning position
   */
  private async redeemPosition(position: Position): Promise<RedemptionResult> {
    try {
      const privateKey = this.runtime.getSetting("POLYMARKET_PRIVATE_KEY");
      const rpcUrl =
        this.runtime.getSetting("RPC_URL") || "https://polygon-rpc.com";

      const provider = new JsonRpcProvider(rpcUrl);
      const wallet = new Wallet(privateKey, provider);

      // Check if this is a neg-risk market (binary markets)
      const isNegRisk = position.tokenId.includes("neg-risk") || false;

      let txHash: string;
      let amountRedeemed: string = "0";

      if (isNegRisk) {
        // Use NegRiskAdapter for binary markets
        const negRiskAdapter = new Contract(
          NEG_RISK_ADAPTER_ADDRESS,
          NEG_RISK_ADAPTER_ABI,
          wallet,
        );

        const tx = await negRiskAdapter.redeemPositions(
          position.marketConditionId,
          [position.size],
        );

        const receipt = await tx.wait();
        txHash = receipt.hash;
        amountRedeemed = position.value; // Approximate value
      } else {
        // Use ConditionalTokens for regular markets
        const conditionalTokens = new Contract(
          CONDITIONAL_TOKENS_ADDRESS,
          CONDITIONAL_TOKENS_ABI,
          wallet,
        );

        // Calculate index set for the winning outcome
        const indexSet = position.outcome === "YES" ? 1 : 2;

        const tx = await conditionalTokens.redeemPositions(
          USDC_ADDRESS,
          ZeroHash, // parentCollectionId
          position.marketConditionId,
          [indexSet],
        );

        const receipt = await tx.wait();
        txHash = receipt.hash;
        amountRedeemed = position.value; // Approximate value
      }

      return {
        marketQuestion: position.marketQuestion,
        conditionId: position.marketConditionId,
        amountRedeemed,
        txHash,
        success: true,
      };
    } catch (error: any) {
      logger.error(
        `[RedemptionService] Redemption failed for position ${position.marketConditionId}:`,
        error,
      );

      return {
        marketQuestion: position.marketQuestion,
        conditionId: position.marketConditionId,
        amountRedeemed: "0",
        txHash: "",
        success: false,
        error: error.message || "Unknown error",
      };
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
