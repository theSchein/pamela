/**
 * Unit-Based Betting Service
 * Implements simple unit-based position sizing where 1 unit = 10% of portfolio
 */

import { type IAgentRuntime, logger } from "@elizaos/core";
import { initializeClobClient, type ClobClient } from "../../plugin-polymarket/src/utils/clobClient";

export interface PositionSizeResult {
  canTrade: boolean;
  unitSize: number;
  availableUnits: number;
  currentExposure: number;
  maxExposure: number;
  portfolioValue: number;
  reason?: string;
}

export interface ActivePosition {
  marketId: string;
  size: number;
  side: string;
  openPrice: number;
}

export class UnitBettingService {
  private runtime: IAgentRuntime;
  private clobClient: ClobClient | null = null;
  
  // Configuration
  private readonly UNIT_PERCENTAGE = 0.10; // 10% per unit
  private readonly MAX_CONCURRENT_POSITIONS = 3; // Maximum 3 positions (30% exposure)
  private readonly MIN_UNIT_SIZE = 5; // Minimum $5 per bet
  private readonly MAX_UNIT_SIZE = 1000; // Maximum $1,000 per bet (safety cap)

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
  }

  /**
   * Initialize the betting service
   */
  async initialize(): Promise<void> {
    try {
      this.clobClient = await initializeClobClient(this.runtime);
      logger.info("[UnitBettingService] Initialized successfully");
    } catch (error) {
      logger.error("[UnitBettingService] Failed to initialize:", error);
      throw error;
    }
  }

  /**
   * Calculate position size based on unit betting strategy
   */
  async calculatePositionSize(): Promise<PositionSizeResult> {
    try {
      // Get current portfolio value
      const portfolioValue = await this.getPortfolioValue();
      
      if (portfolioValue <= 0) {
        return {
          canTrade: false,
          unitSize: 0,
          availableUnits: 0,
          currentExposure: 0,
          maxExposure: 0,
          portfolioValue: 0,
          reason: "Insufficient portfolio balance",
        };
      }

      // Calculate unit size (10% of portfolio)
      let unitSize = portfolioValue * this.UNIT_PERCENTAGE;
      
      // Apply min/max constraints
      unitSize = Math.max(this.MIN_UNIT_SIZE, Math.min(this.MAX_UNIT_SIZE, unitSize));
      
      // Get current active positions
      const activePositions = await this.getActivePositions();
      const currentPositionCount = activePositions.length;
      const currentExposure = activePositions.reduce((sum, pos) => sum + pos.size, 0);
      const currentExposurePercentage = (currentExposure / portfolioValue) * 100;
      
      // Calculate available units
      const availableUnits = this.MAX_CONCURRENT_POSITIONS - currentPositionCount;
      
      // Check if we can place a new trade
      if (availableUnits <= 0) {
        return {
          canTrade: false,
          unitSize,
          availableUnits: 0,
          currentExposure: currentExposurePercentage,
          maxExposure: this.MAX_CONCURRENT_POSITIONS * this.UNIT_PERCENTAGE * 100,
          portfolioValue,
          reason: `Maximum positions reached (${this.MAX_CONCURRENT_POSITIONS})`,
        };
      }

      // Check if unit size is too small
      if (unitSize < this.MIN_UNIT_SIZE) {
        return {
          canTrade: false,
          unitSize,
          availableUnits,
          currentExposure: currentExposurePercentage,
          maxExposure: this.MAX_CONCURRENT_POSITIONS * this.UNIT_PERCENTAGE * 100,
          portfolioValue,
          reason: `Unit size too small ($${unitSize.toFixed(2)} < $${this.MIN_UNIT_SIZE})`,
        };
      }

      // Check if adding this position would exceed max exposure
      const newExposure = currentExposure + unitSize;
      const maxAllowedExposure = portfolioValue * (this.MAX_CONCURRENT_POSITIONS * this.UNIT_PERCENTAGE);
      
      if (newExposure > maxAllowedExposure) {
        return {
          canTrade: false,
          unitSize,
          availableUnits,
          currentExposure: currentExposurePercentage,
          maxExposure: this.MAX_CONCURRENT_POSITIONS * this.UNIT_PERCENTAGE * 100,
          portfolioValue,
          reason: "Would exceed maximum portfolio exposure (30%)",
        };
      }

      // All checks passed - we can trade
      return {
        canTrade: true,
        unitSize,
        availableUnits,
        currentExposure: currentExposurePercentage,
        maxExposure: this.MAX_CONCURRENT_POSITIONS * this.UNIT_PERCENTAGE * 100,
        portfolioValue,
      };

    } catch (error) {
      logger.error("[UnitBettingService] Error calculating position size:", error);
      return {
        canTrade: false,
        unitSize: 0,
        availableUnits: 0,
        currentExposure: 0,
        maxExposure: 0,
        portfolioValue: 0,
        reason: "Error calculating position size",
      };
    }
  }

  /**
   * Get current portfolio value (USDC balance + position values)
   */
  private async getPortfolioValue(): Promise<number> {
    try {
      const walletAddress = (this.clobClient as any).wallet?.address || 
                           (this.clobClient as any).signer?.address;
      
      if (!walletAddress) {
        throw new Error("Unable to determine wallet address");
      }

      // Get USDC balance
      const balanceResponse = await fetch(
        `${this.runtime.getSetting("CLOB_API_URL")}/balance/${walletAddress}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!balanceResponse.ok) {
        throw new Error(`Failed to fetch balance: ${balanceResponse.statusText}`);
      }

      const balanceData: any = await balanceResponse.json();
      const usdcBalance = parseFloat(balanceData.usdc_balance || "0");

      // Get portfolio positions value
      const portfolioResponse = await fetch(
        `${this.runtime.getSetting("CLOB_API_URL")}/portfolio/${walletAddress}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!portfolioResponse.ok) {
        // If portfolio fetch fails, just use USDC balance
        logger.warn("[UnitBettingService] Failed to fetch portfolio, using USDC balance only");
        return usdcBalance;
      }

      const portfolioData: any = await portfolioResponse.json();
      const positionsValue = portfolioData.positions?.reduce((sum: number, pos: any) => {
        return sum + parseFloat(pos.current_value || "0");
      }, 0) || 0;

      const totalValue = usdcBalance + positionsValue;
      
      logger.info(`[UnitBettingService] Portfolio value: $${totalValue.toFixed(2)} (USDC: $${usdcBalance.toFixed(2)}, Positions: $${positionsValue.toFixed(2)})`);
      
      return totalValue;

    } catch (error) {
      logger.error("[UnitBettingService] Failed to get portfolio value:", error);
      throw error;
    }
  }

  /**
   * Get current active positions
   */
  private async getActivePositions(): Promise<ActivePosition[]> {
    try {
      const walletAddress = (this.clobClient as any).wallet?.address || 
                           (this.clobClient as any).signer?.address;
      
      if (!walletAddress) {
        throw new Error("Unable to determine wallet address");
      }

      // Get open orders and positions
      const ordersResponse = await fetch(
        `${this.runtime.getSetting("CLOB_API_URL")}/orders?address=${walletAddress}&state=OPEN`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const portfolioResponse = await fetch(
        `${this.runtime.getSetting("CLOB_API_URL")}/portfolio/${walletAddress}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const positions: ActivePosition[] = [];

      // Add open orders as positions
      if (ordersResponse.ok) {
        const ordersData: any = await ordersResponse.json();
        ordersData.orders?.forEach((order: any) => {
          positions.push({
            marketId: order.market_id,
            size: parseFloat(order.size || "0"),
            side: order.side,
            openPrice: parseFloat(order.price || "0"),
          });
        });
      }

      // Add portfolio positions
      if (portfolioResponse.ok) {
        const portfolioData: any = await portfolioResponse.json();
        portfolioData.positions?.forEach((pos: any) => {
          // Only count positions with significant value (>$1)
          const value = parseFloat(pos.current_value || "0");
          if (value > 1) {
            positions.push({
              marketId: pos.condition_id,
              size: value,
              side: pos.outcome,
              openPrice: parseFloat(pos.average_price || "0"),
            });
          }
        });
      }

      logger.info(`[UnitBettingService] Found ${positions.length} active positions`);
      
      return positions;

    } catch (error) {
      logger.error("[UnitBettingService] Failed to get active positions:", error);
      return [];
    }
  }

  /**
   * Check if a specific amount can be bet
   */
  async canPlaceBet(amount: number): Promise<{
    allowed: boolean;
    reason?: string;
    suggestedAmount?: number;
  }> {
    const positionSize = await this.calculatePositionSize();
    
    if (!positionSize.canTrade) {
      return {
        allowed: false,
        reason: positionSize.reason,
      };
    }

    // Check if requested amount exceeds unit size
    if (amount > positionSize.unitSize) {
      return {
        allowed: false,
        reason: `Amount exceeds unit size ($${positionSize.unitSize.toFixed(2)})`,
        suggestedAmount: positionSize.unitSize,
      };
    }

    // Check if amount is too small
    if (amount < this.MIN_UNIT_SIZE) {
      return {
        allowed: false,
        reason: `Amount below minimum ($${this.MIN_UNIT_SIZE})`,
        suggestedAmount: positionSize.unitSize,
      };
    }

    return {
      allowed: true,
    };
  }

  /**
   * Get recommended bet size (always 1 unit)
   */
  async getRecommendedBetSize(): Promise<number> {
    const positionSize = await this.calculatePositionSize();
    return positionSize.canTrade ? positionSize.unitSize : 0;
  }

  /**
   * Get current portfolio status
   */
  async getPortfolioStatus(): Promise<{
    portfolioValue: number;
    unitSize: number;
    currentPositions: number;
    maxPositions: number;
    currentExposure: number;
    availableUnits: number;
    canTrade: boolean;
  }> {
    const positionSize = await this.calculatePositionSize();
    const activePositions = await this.getActivePositions();
    
    return {
      portfolioValue: positionSize.portfolioValue,
      unitSize: positionSize.unitSize,
      currentPositions: activePositions.length,
      maxPositions: this.MAX_CONCURRENT_POSITIONS,
      currentExposure: positionSize.currentExposure,
      availableUnits: positionSize.availableUnits,
      canTrade: positionSize.canTrade,
    };
  }

  /**
   * Format position size for display
   */
  formatPositionSize(result: PositionSizeResult): string {
    if (!result.canTrade) {
      return `❌ Cannot trade: ${result.reason}
Portfolio: $${result.portfolioValue.toFixed(2)}
Current Exposure: ${result.currentExposure.toFixed(1)}%
Available Units: ${result.availableUnits}`;
    }

    return `✅ Can trade
Unit Size: $${result.unitSize.toFixed(2)}
Portfolio: $${result.portfolioValue.toFixed(2)}
Current Exposure: ${result.currentExposure.toFixed(1)}%
Available Units: ${result.availableUnits}
Max Exposure: ${result.maxExposure.toFixed(1)}%`;
  }
}