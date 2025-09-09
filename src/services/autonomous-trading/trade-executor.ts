/**
 * Trade Executor Module
 * 
 * Handles the execution of trading decisions by placing orders on Polymarket.
 * This module interfaces with the CLOB API to submit orders and manages
 * the complete order lifecycle.
 * 
 * Features:
 * - Direct order placement bypassing LLM extraction
 * - Automatic USDC to shares conversion
 * - Minimum order size validation
 * - L1->L2 deposit handling when balance is insufficient
 * - Social media broadcast integration
 * - Market data fetching for token ID resolution
 * 
 * The executor ensures orders meet Polymarket's requirements and handles
 * edge cases like insufficient balance gracefully.
 */

import { elizaLogger, IAgentRuntime } from "@elizaos/core";
import { placeDirectOrder } from "./direct-order.js";
import { TradingDecision, OrderResult } from "./types.js";
import { TradingConfig } from "../../config/trading-config.js";

export class TradeExecutor {
  private runtime: IAgentRuntime;
  private clobClient: any;
  private tradingConfig: TradingConfig;

  constructor(runtime: IAgentRuntime, clobClient: any, tradingConfig: TradingConfig) {
    this.runtime = runtime;
    this.clobClient = clobClient;
    this.tradingConfig = tradingConfig;
  }

  async executeTrade(decision: TradingDecision): Promise<OrderResult> {
    try {
      elizaLogger.info(
        "Executing autonomous trade: " +
          JSON.stringify({
            marketId: decision.marketId,
            outcome: decision.outcome,
            size: decision.size,
            confidence: decision.confidence,
          })
      );

      // Execute the trade
      const tradeResult = await this.placeOrder(decision);

      if (tradeResult.success) {
        elizaLogger.info(
          `Trade executed successfully: ${tradeResult.orderId} for market ${decision.marketId}`
        );

        // Broadcast to social media if enabled
        if (this.tradingConfig.socialBroadcastEnabled) {
          await this.broadcastPosition(decision);
        }
      } else {
        elizaLogger.error(
          `Trade execution failed for market ${decision.marketId}: ${tradeResult.error}`
        );
      }

      return tradeResult;
    } catch (error) {
      elizaLogger.error("Error executing trade: " + error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async placeOrder(decision: TradingDecision): Promise<OrderResult> {
    try {
      // Get market details to find the token IDs
      const marketUrl = `https://gamma-api.polymarket.com/markets?condition_ids=${decision.marketId}`;
      const response = await fetch(marketUrl);
      const marketData = (await response.json()) as any[];
      const market = marketData[0];

      if (!market) {
        return { success: false, error: "Market not found" };
      }

      // Get the token IDs for this market
      const clobTokenIds = market.clobTokenIds
        ? JSON.parse(market.clobTokenIds)
        : [];
      const tokenId =
        decision.outcome === "YES" ? clobTokenIds[0] : clobTokenIds[1];

      if (!tokenId) {
        elizaLogger.error(
          "Could not find token ID for outcome " + decision.outcome
        );
        return { success: false, error: "Token ID not found" };
      }

      // Validate minimum order size ($1 minimum on Polymarket)
      const orderValueUSDC = decision.size;
      if (orderValueUSDC < 1) {
        elizaLogger.warn(
          `Order value $${orderValueUSDC} is below minimum $1, adjusting to minimum`
        );
        decision.size = Math.max(1, decision.size);
      }

      // Convert USDC amount to number of shares
      const sharesAmount = decision.size / decision.price;

      elizaLogger.info(
        `Placing direct order: ${decision.size} USDC (${sharesAmount.toFixed(
          2
        )} shares) of ${decision.outcome} @ ${decision.price} for "${
          market.question
        }"`
      );

      // Use direct order placement to bypass LLM extraction
      const orderResult = await placeDirectOrder(
        this.runtime,
        {
          tokenId: tokenId,
          side: "BUY",
          price: decision.price,
          size: sharesAmount, // Pass number of shares, not USDC amount
          orderType: "GTC",
        },
        undefined, // callback
        this.clobClient // Pass the existing CLOB client
      );

      return orderResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async broadcastPosition(decision: TradingDecision): Promise<void> {
    try {
      const message = `🤖 New Position: ${decision.outcome} on "${decision.marketId.slice(
        0,
        8
      )}..."
Size: $${decision.size}
Confidence: ${(decision.confidence * 100).toFixed(1)}%
${decision.reasoning}`;

      // In production, store broadcast request to database
      // For now, just log the message
      elizaLogger.info("Would broadcast: " + message);
    } catch (error) {
      elizaLogger.error("Error broadcasting position: " + error);
    }
  }

  async handleL2Deposit(requiredAmount: number): Promise<boolean> {
    try {
      elizaLogger.info(
        `Attempting to deposit $${requiredAmount} from L1 to L2...`
      );

      // Import deposit manager
      const { depositUSDC } = await import(
        "../../../plugin-polymarket/src/utils/depositManager.js"
      );

      // Add a buffer to the required amount
      const depositAmount = Math.ceil(requiredAmount + 2); // Add $2 buffer

      elizaLogger.info(`Depositing $${depositAmount} USDC to Polymarket L2...`);

      const depositResult = await depositUSDC(
        this.runtime,
        depositAmount.toString()
      );

      if (depositResult.success && depositResult.transactionHash) {
        elizaLogger.info(
          `✅ Deposit successful! TX: ${depositResult.transactionHash}`
        );
        elizaLogger.info(
          `Deposit will be available on L2 shortly. Transaction: ${depositResult.transactionHash}`
        );
        return true;
      } else {
        elizaLogger.error(`Deposit failed - success: ${depositResult.success}`);
        return false;
      }
    } catch (error) {
      elizaLogger.error(`Error during L2 deposit: ${error}`);
      return false;
    }
  }
}