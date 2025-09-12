/**
 * Balance Manager Module
 * 
 * Manages USDC balance monitoring and validation for the trading service.
 * Implements smart caching to reduce API calls while ensuring trades have
 * sufficient funds.
 * 
 * Features:
 * - Balance checking with configurable caching (30 second default)
 * - Pre-trade balance validation
 * - Initial balance logging with warnings
 * - Balance status reporting
 * - Efficient API usage through cache management
 * 
 * The balance manager prevents failed trades due to insufficient funds and
 * provides clear feedback when deposits are needed.
 */

import { elizaLogger, IAgentRuntime } from "@elizaos/core";
import { checkPolymarketBalance } from "./polymarket-utils.js";
import { BalanceInfo } from "./types.js";

export class BalanceManager {
  private runtime: IAgentRuntime;
  private lastBalanceCheck: Date | null = null;
  private cachedBalance: number = 0;
  private cacheExpiryMs = 30000; // 30 seconds cache

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
  }

  async checkBalance(requiredAmount?: number): Promise<BalanceInfo> {
    try {
      const balanceInfo = await checkPolymarketBalance(
        this.runtime,
        requiredAmount?.toString() || "0"
      );

      this.cachedBalance = parseFloat(balanceInfo.usdcBalance);
      this.lastBalanceCheck = new Date();

      if (requiredAmount) {
        elizaLogger.info(
          `Balance check: Available=$${balanceInfo.usdcBalance}, Required=$${requiredAmount}, Sufficient=${balanceInfo.hasEnoughBalance}`
        );
      }

      return balanceInfo;
    } catch (error) {
      elizaLogger.error("Error checking balance: " + error);
      return {
        hasEnoughBalance: false,
        usdcBalance: "0",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getBalance(): Promise<number> {
    // Use cached balance if recent
    if (
      this.lastBalanceCheck &&
      Date.now() - this.lastBalanceCheck.getTime() < this.cacheExpiryMs
    ) {
      return this.cachedBalance;
    }

    const balanceInfo = await this.checkBalance();
    return parseFloat(balanceInfo.usdcBalance);
  }

  async hasEnoughBalance(amount: number): Promise<boolean> {
    const balanceInfo = await this.checkBalance(amount);
    return balanceInfo.hasEnoughBalance;
  }

  async logInitialBalance(): Promise<void> {
    try {
      const balanceInfo = await this.checkBalance();
      const balance = parseFloat(balanceInfo.usdcBalance);
      elizaLogger.info(`💰 Polymarket Balance: $${balance.toFixed(2)} USDC`);

      if (balance < 1) {
        elizaLogger.warn(
          "⚠️  WARNING: No USDC balance found in Polymarket account!"
        );
        elizaLogger.warn(
          "📝 You need to deposit USDC to your Polymarket account to enable trading"
        );
        elizaLogger.warn("🔗 Visit app.polymarket.com to deposit funds");
      }
    } catch (error) {
      elizaLogger.error("Failed to check initial balance: " + error);
    }
  }

  getBalanceStatus(): string {
    if (!this.lastBalanceCheck) {
      return "Balance not checked yet";
    }

    const ageMs = Date.now() - this.lastBalanceCheck.getTime();
    const ageMinutes = Math.floor(ageMs / 60000);

    return `
💰 Balance Status:
- Current Balance: $${this.cachedBalance.toFixed(2)} USDC
- Last Updated: ${ageMinutes} minutes ago
- Status: ${this.cachedBalance >= 1 ? "✅ Ready to trade" : "⚠️ Insufficient balance"}
    `.trim();
  }
}