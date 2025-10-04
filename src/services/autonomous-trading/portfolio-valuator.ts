/**
 * Portfolio Valuator Module
 *
 * Calculates the total USDC value of all Polymarket positions plus wallet balance.
 * Used by InvestmentFund service to submit accurate position valuations.
 *
 * ## Valuation Components
 * 1. Open Polymarket positions (valued at current market price)
 * 2. USDC balance in agent wallet
 * 3. Pending orders (if filled at current prices) - optional
 *
 * ## Integration Points
 * - PositionManager: Provides position data
 * - BalanceManager: Provides USDC balance
 * - Polymarket CLOB API: Provides current market prices
 */

import { elizaLogger, IAgentRuntime } from "@elizaos/core";
import { PositionData } from "./types.js";

export interface PortfolioValuation {
  totalValueUSDC: number;
  positionsValue: number;
  usdcBalance: number;
  positionCount: number;
  breakdown: PositionValuation[];
}

export interface PositionValuation {
  marketId: string;
  tokenId: string;
  outcome: string;
  size: number;
  currentPrice: number;
  valueUSDC: number;
}

export class PortfolioValuator {
  private runtime: IAgentRuntime;
  private clobClient: any;

  constructor(runtime: IAgentRuntime, clobClient: any) {
    this.runtime = runtime;
    this.clobClient = clobClient;
  }

  /**
   * Calculate total portfolio value in USDC
   * @param positions Open positions from PositionManager
   * @param usdcBalance Current USDC balance from BalanceManager
   */
  async calculateTotalValue(
    positions: Map<string, PositionData>,
    usdcBalance: number
  ): Promise<PortfolioValuation> {
    try {
      const breakdown: PositionValuation[] = [];
      let positionsValue = 0;

      // Calculate value of each position
      for (const [marketId, position] of positions) {
        try {
          // Get current market price
          const currentPrice = await this.getCurrentPrice(
            position.tokenId || marketId,
            position.outcome
          );

          // Calculate position value: shares * current_price
          const valueUSDC = position.size * currentPrice;
          positionsValue += valueUSDC;

          breakdown.push({
            marketId,
            tokenId: position.tokenId || marketId,
            outcome: position.outcome,
            size: position.size,
            currentPrice,
            valueUSDC,
          });

          elizaLogger.debug(
            `Position ${marketId}: ${position.size} shares @ $${currentPrice.toFixed(3)} = $${valueUSDC.toFixed(2)}`
          );
        } catch (error) {
          elizaLogger.warn(`Failed to value position ${marketId}:`, error);
          // Use average price as fallback
          const fallbackValue = position.size * position.avgPrice;
          positionsValue += fallbackValue;

          breakdown.push({
            marketId,
            tokenId: position.tokenId || marketId,
            outcome: position.outcome,
            size: position.size,
            currentPrice: position.avgPrice,
            valueUSDC: fallbackValue,
          });
        }
      }

      const totalValueUSDC = positionsValue + usdcBalance;

      elizaLogger.info(
        `📊 Portfolio Valuation: ${positions.size} positions = $${positionsValue.toFixed(2)}, ` +
          `USDC = $${usdcBalance.toFixed(2)}, Total = $${totalValueUSDC.toFixed(2)}`
      );

      return {
        totalValueUSDC,
        positionsValue,
        usdcBalance,
        positionCount: positions.size,
        breakdown,
      };
    } catch (error) {
      elizaLogger.error("Error calculating portfolio value:", error);
      // Return USDC balance as minimum value
      return {
        totalValueUSDC: usdcBalance,
        positionsValue: 0,
        usdcBalance,
        positionCount: 0,
        breakdown: [],
      };
    }
  }

  /**
   * Get current market price for a token
   * @param tokenId CLOB token ID
   * @param outcome YES or NO
   */
  private async getCurrentPrice(tokenId: string, outcome: string): Promise<number> {
    try {
      if (!this.clobClient) {
        throw new Error("CLOB client not initialized");
      }

      // Get order book for the token
      const orderBook = await this.clobClient.getOrderBook(tokenId);

      if (!orderBook || (!orderBook.bids?.length && !orderBook.asks?.length)) {
        throw new Error("No order book data available");
      }

      // Use mid-price between best bid and best ask
      let price = 0.5; // Default to 50% if no orders

      if (orderBook.bids?.length > 0 && orderBook.asks?.length > 0) {
        const bestBid = parseFloat(orderBook.bids[0].price);
        const bestAsk = parseFloat(orderBook.asks[0].price);
        price = (bestBid + bestAsk) / 2;
      } else if (orderBook.bids?.length > 0) {
        price = parseFloat(orderBook.bids[0].price);
      } else if (orderBook.asks?.length > 0) {
        price = parseFloat(orderBook.asks[0].price);
      }

      return price;
    } catch (error) {
      elizaLogger.warn(`Failed to get current price for ${tokenId}:`, error);
      // Return 0.5 as fallback (50% probability)
      return 0.5;
    }
  }

  /**
   * Get a summary string of portfolio valuation
   */
  getValuationSummary(valuation: PortfolioValuation): string {
    const positionsList = valuation.breakdown
      .map(
        (p) =>
          `  - ${p.outcome}: ${p.size} shares @ $${p.currentPrice.toFixed(3)} = $${p.valueUSDC.toFixed(2)}`
      )
      .join("\n");

    return `
📊 Portfolio Valuation:
━━━━━━━━━━━━━━━━━━━━━━━━━━
Positions (${valuation.positionCount}): $${valuation.positionsValue.toFixed(2)}
${positionsList || "  (no positions)"}

USDC Balance: $${valuation.usdcBalance.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Value: $${valuation.totalValueUSDC.toFixed(2)}
    `.trim();
  }
}
