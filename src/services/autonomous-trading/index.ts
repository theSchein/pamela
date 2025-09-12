/**
 * Autonomous Trading Service - Main Orchestrator
 * 
 * This service coordinates autonomous trading operations on Polymarket prediction markets.
 * It manages the complete trading lifecycle from market scanning to trade execution.
 * 
 * ## Architecture
 * 
 * The service is composed of several specialized modules:
 * - MarketScanner: Discovers trading opportunities based on configured strategies
 * - OpportunityEvaluator: Evaluates opportunities and determines position sizing
 * - TradeExecutor: Handles order placement and execution through CLOB API
 * - PositionManager: Tracks portfolio positions and P&L
 * - BalanceManager: Monitors USDC balance with smart caching
 * - DirectOrder: Direct CLOB API integration for programmatic order placement
 * 
 * ## Trading Strategies
 * 
 * Currently supports:
 * 1. Simple Threshold Strategy - Trades when prices hit configured thresholds
 * 2. ML Strategy (planned) - Uses machine learning for probability prediction
 * 
 * ## Adding New Strategies
 * 
 * To implement a new trading strategy:
 * 1. Extend MarketScanner with a new find*Opportunities() method
 * 2. Customize OpportunityEvaluator for position sizing logic
 * 3. Update TradingConfig with strategy-specific parameters
 * 
 * ## Configuration
 * 
 * Environment variables:
 * - UNSUPERVISED_MODE: Enable autonomous trading (default: false)
 * - MAX_POSITION_SIZE: Maximum position size per trade (default: 100)
 * - MIN_CONFIDENCE_THRESHOLD: Minimum confidence to trade (default: 0.7)
 * - MAX_DAILY_TRADES: Daily trade limit (default: 10)
 * - MAX_OPEN_POSITIONS: Maximum concurrent positions (default: 20)
 * - SIMPLE_STRATEGY_ENABLED: Use simple threshold strategy
 * - USE_HARDCODED_MARKETS: Monitor specific markets only
 * 
 * ## Risk Management
 * 
 * Built-in safeguards:
 * - Daily trade limits
 * - Maximum position limits
 * - Minimum confidence thresholds
 * - Balance validation before trades
 * - Automatic L1->L2 deposit handling
 */

import { elizaLogger, IAgentRuntime, Service } from "@elizaos/core";
import { TradingConfig } from "../../config/trading-config.js";
import { getMarketsToMonitor } from "../../config/hardcoded-markets.js";
import { initializeClobClient } from "@theschein/plugin-polymarket";

import { MarketScanner } from "./market-scanner.js";
import { OpportunityEvaluator } from "./opportunity-evaluator.js";
import { TradeExecutor } from "./trade-executor.js";
import { PositionManager } from "./position-manager.js";
import { BalanceManager } from "./balance-manager.js";
import { TradingDecision } from "./types.js";

export class AutonomousTradingService extends Service {
  private tradingConfig: TradingConfig;
  private dailyTradeCount: number = 0;
  private lastResetDate: Date;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private clobClient: any = null;

  // Modular components
  private marketScanner: MarketScanner | null = null;
  private opportunityEvaluator: OpportunityEvaluator | null = null;
  private tradeExecutor: TradeExecutor | null = null;
  private positionManager: PositionManager | null = null;
  private balanceManager: BalanceManager | null = null;

  private static instance: AutonomousTradingService | null = null;

  static get serviceType(): string {
    return "AUTONOMOUS_TRADING";
  }

  get capabilityDescription(): string {
    return "Autonomous trading service for prediction markets";
  }

  constructor() {
    super();
    // Read config fresh from environment
    this.tradingConfig = {
      unsupervisedMode: process.env.UNSUPERVISED_MODE === "true",
      maxPositionSize: Number(process.env.MAX_POSITION_SIZE) || 100,
      minConfidenceThreshold:
        Number(process.env.MIN_CONFIDENCE_THRESHOLD) || 0.7,
      maxDailyTrades: Number(process.env.MAX_DAILY_TRADES) || 10,
      maxOpenPositions: Number(process.env.MAX_OPEN_POSITIONS) || 20,
      riskLimitPerTrade: Number(process.env.RISK_LIMIT_PER_TRADE) || 50,
      autoRedemptionEnabled: process.env.AUTO_REDEMPTION === "true",
      socialBroadcastEnabled: process.env.SOCIAL_BROADCAST === "true",
      simpleStrategyEnabled: process.env.SIMPLE_STRATEGY_ENABLED === "true",
      useHardcodedMarkets: process.env.USE_HARDCODED_MARKETS === "true",
    };
    this.lastResetDate = new Date();
  }

  static async start(
    runtime: IAgentRuntime
  ): Promise<AutonomousTradingService> {
    elizaLogger.info("Starting Autonomous Trading Service");
    if (!AutonomousTradingService.instance) {
      AutonomousTradingService.instance = new AutonomousTradingService();
      await AutonomousTradingService.instance.initialize(runtime);
    }
    return AutonomousTradingService.instance;
  }

  static async stop(_runtime: IAgentRuntime): Promise<void> {
    elizaLogger.info("Stopping Autonomous Trading Service");
    if (AutonomousTradingService.instance) {
      await AutonomousTradingService.instance.stop();
      AutonomousTradingService.instance = null;
    }
  }

  async initialize(runtime: IAgentRuntime): Promise<void> {
    this.runtime = runtime;
    elizaLogger.info("🤖 === AUTONOMOUS TRADING SERVICE STARTING ===");
    elizaLogger.info(
      "Configuration: " +
        JSON.stringify({
          unsupervisedMode: this.tradingConfig.unsupervisedMode,
          simpleStrategy: process.env.SIMPLE_STRATEGY_ENABLED,
          hardcodedMarkets: process.env.USE_HARDCODED_MARKETS,
          maxDailyTrades: this.tradingConfig.maxDailyTrades,
          maxPositionSize: this.tradingConfig.maxPositionSize,
        })
    );

    // Initialize CLOB client for market data
    try {
      this.clobClient = await initializeClobClient(runtime);
      elizaLogger.info("CLOB client initialized successfully");
    } catch (error) {
      elizaLogger.error("Failed to initialize CLOB client: " + error);
      return;
    }

    // Initialize modular components
    this.initializeComponents(runtime);

    // Check initial balance
    await this.balanceManager?.logInitialBalance();

    if (!this.tradingConfig.unsupervisedMode) {
      elizaLogger.info(
        "⚠️  UNSUPERVISED MODE DISABLED - Running in monitoring mode only"
      );
      elizaLogger.info(
        "📊 Markets will be scanned but NO trades will be executed"
      );
      elizaLogger.info(
        "💡 To enable trading: Set UNSUPERVISED_MODE=true in .env"
      );
    } else {
      elizaLogger.info(
        "🚨 UNSUPERVISED MODE ENABLED - Trades will be executed automatically!"
      );
    }

    await this.positionManager?.loadExistingPositions();
    this.startAutonomousTrading();
  }

  private initializeComponents(runtime: IAgentRuntime): void {
    // Initialize position manager first as it's needed by scanner
    this.positionManager = new PositionManager(runtime);
    
    // Initialize other components
    this.marketScanner = new MarketScanner(
      this.positionManager.getOpenPositions()
    );
    this.opportunityEvaluator = new OpportunityEvaluator(this.tradingConfig);
    this.tradeExecutor = new TradeExecutor(
      runtime,
      this.clobClient,
      this.tradingConfig
    );
    this.balanceManager = new BalanceManager(runtime);
  }

  private startAutonomousTrading(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    elizaLogger.info(
      "📡 Starting market monitoring - scanning every 60 seconds"
    );
    elizaLogger.info(
      `🎯 Monitoring ${getMarketsToMonitor()?.length || 0} hardcoded markets`
    );

    this.scanInterval = setInterval(async () => {
      elizaLogger.debug("⏰ Running scheduled market scan...");
      await this.scanAndTrade();
    }, 60000); // Scan every minute

    // Initial scan
    elizaLogger.info("🔍 Running initial market scan...");
    this.scanAndTrade();
  }

  private async scanAndTrade(): Promise<void> {
    try {
      this.checkDailyReset();

      if (!this.canTrade()) {
        elizaLogger.debug("Trading conditions not met, skipping scan");
        return;
      }

      const opportunities = await this.marketScanner!.findOpportunities();

      if (opportunities.length > 0) {
        elizaLogger.info(
          `✨ Found ${opportunities.length} trading opportunities!`
        );
        for (const opp of opportunities) {
          elizaLogger.info(
            `  📈 ${opp.question}: ${opp.outcome} @ ${(opp.currentPrice * 100).toFixed(
              1
            )}%`
          );
        }
      } else {
        elizaLogger.debug("No trading opportunities found in current scan");
      }

      for (const opportunity of opportunities) {
        if (!this.canTrade()) break;

        const decision = await this.opportunityEvaluator!.evaluate(opportunity);

        if (decision.shouldTrade) {
          if (this.tradingConfig.unsupervisedMode) {
            elizaLogger.info(`🎲 EXECUTING TRADE: ${opportunity.question}`);
            await this.handleTrade(decision);
          } else {
            elizaLogger.info(
              `📋 WOULD TRADE (monitoring mode): ${opportunity.question}`
            );
            elizaLogger.info(`   Details: ${decision.reasoning}`);
          }
        } else {
          elizaLogger.debug(`❌ Skipping opportunity: ${decision.reasoning}`);
        }
      }
    } catch (error) {
      elizaLogger.error("Error during autonomous trading scan: " + error);
    }
  }

  private async handleTrade(decision: TradingDecision): Promise<void> {
    // Check wallet balance before attempting to place order
    const balanceCheck = await this.balanceManager!.checkBalance(decision.size);
    if (!balanceCheck.hasEnoughBalance) {
      elizaLogger.error(
        `Insufficient balance for trade. Required: $${decision.size}, Available: $${balanceCheck.usdcBalance}`
      );
      elizaLogger.info(
        "⚠️  Trade skipped due to insufficient balance. Consider depositing USDC to your Polymarket account."
      );
      return;
    }

    elizaLogger.info(
      `✅ Balance check passed. Available: $${balanceCheck.usdcBalance}, Required: $${decision.size}`
    );

    // Execute the trade
    const tradeResult = await this.tradeExecutor!.executeTrade(decision);

    if (tradeResult.success) {
      this.dailyTradeCount++;
      // Reload positions after successful trade
      await this.positionManager!.refreshPositions();
    } else {
      // Check if it's a balance/allowance error and try to handle it
      if (
        tradeResult.error &&
        tradeResult.error.includes("not enough balance / allowance")
      ) {
        elizaLogger.info(
          "Detected L2 balance issue, attempting automatic deposit from L1..."
        );

        // Try to deposit and retry the order
        const depositSuccess = await this.tradeExecutor!.handleL2Deposit(
          decision.size
        );
        if (depositSuccess) {
          elizaLogger.info("Deposit successful, retrying order...");

          // Wait a bit for L2 to recognize the deposit
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // Retry the order
          const retryResult = await this.tradeExecutor!.executeTrade(decision);
          if (retryResult.success) {
            this.dailyTradeCount++;
            await this.positionManager!.refreshPositions();
            elizaLogger.info(
              "Trade executed successfully after deposit: " + retryResult.orderId
            );
          } else {
            elizaLogger.error(
              "Trade still failed after deposit: " + retryResult.error
            );
          }
        } else {
          elizaLogger.error("Could not complete L2 deposit, trade cancelled");
        }
      }
    }
  }

  private checkDailyReset(): void {
    const now = new Date();
    if (now.getDate() !== this.lastResetDate.getDate()) {
      this.dailyTradeCount = 0;
      this.lastResetDate = now;
      elizaLogger.info("Daily trade counter reset");
    }
  }

  private canTrade(): boolean {
    if (this.dailyTradeCount >= this.tradingConfig.maxDailyTrades) {
      elizaLogger.debug("Daily trade limit reached");
      return false;
    }

    const positionCount = this.positionManager?.getPositionCount() || 0;
    if (positionCount >= this.tradingConfig.maxOpenPositions) {
      elizaLogger.debug("Maximum open positions reached");
      return false;
    }

    if (this.tradingConfig.tradingHoursRestriction) {
      const now = new Date();
      const hour = now.getHours();
      const { startHour, endHour } = this.tradingConfig.tradingHoursRestriction;

      if (hour < startHour || hour >= endHour) {
        elizaLogger.debug("Outside trading hours");
        return false;
      }
    }

    return true;
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    elizaLogger.info("Autonomous Trading Service stopped");
  }

  // Public methods for status and control
  getStatus(): string {
    const positionSummary = this.positionManager?.getPositionSummary() || "No positions";
    const balanceStatus = this.balanceManager?.getBalanceStatus() || "Balance unknown";
    
    return `
🤖 Autonomous Trading Service Status:
- Service: ${this.isRunning ? "✅ Running" : "❌ Stopped"}
- Mode: ${this.tradingConfig.unsupervisedMode ? "🚨 Unsupervised (Live Trading)" : "👁️ Monitoring Only"}
- Daily Trades: ${this.dailyTradeCount}/${this.tradingConfig.maxDailyTrades}

${positionSummary}

${balanceStatus}
    `.trim();
  }

  getDailyTradeCount(): number {
    return this.dailyTradeCount;
  }

  getTradingConfig(): TradingConfig {
    return this.tradingConfig;
  }
}