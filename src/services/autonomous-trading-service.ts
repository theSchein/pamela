import {
  elizaLogger,
  IAgentRuntime,
  Service,
  Memory,
  UUID,
  Content,
  HandlerCallback,
  State,
} from "@elizaos/core";
import {
  DEFAULT_TRADING_CONFIG,
  TradingConfig,
} from "../config/trading-config.js";
import {
  getMarketsToMonitor,
  getSimpleStrategyConfig,
  isHardcodedMarket,
} from "../config/hardcoded-markets.js";

// Import Polymarket plugin actions directly
import { placeOrderAction } from "../../plugin-polymarket/src/actions/placeOrder.js";
import { getPortfolioPositionsAction } from "../../plugin-polymarket/src/actions/getPortfolioPositions.js";
import { getWalletBalanceAction } from "../../plugin-polymarket/src/actions/getWalletBalance.js";
import { initializeClobClient } from "../../plugin-polymarket/src/utils/clobClient.js";
import { placeDirectOrder } from "./direct-order-placement.js";
import { checkPolymarketBalance } from "../../plugin-polymarket/src/utils/balanceChecker.js";

interface MarketOpportunity {
  marketId: string;
  question: string;
  outcome: "YES" | "NO";
  currentPrice: number;
  predictedProbability: number;
  confidence: number;
  expectedValue: number;
  newsSignals: string[];
  riskScore: number;
}

interface TradingDecision {
  shouldTrade: boolean;
  marketId: string;
  outcome: "YES" | "NO";
  size: number;
  price: number;
  confidence: number;
  reasoning: string;
}

export class AutonomousTradingService extends Service {
  private tradingConfig: TradingConfig;
  private dailyTradeCount: number = 0;
  private openPositions: Map<string, any> = new Map();
  private lastResetDate: Date;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private clobClient: any = null;
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
    runtime: IAgentRuntime,
  ): Promise<AutonomousTradingService> {
    elizaLogger.info("Starting Autonomous Trading Service");
    if (!AutonomousTradingService.instance) {
      AutonomousTradingService.instance = new AutonomousTradingService();
      await AutonomousTradingService.instance.initialize(runtime);
    }
    return AutonomousTradingService.instance;
  }

  static async stop(runtime: IAgentRuntime): Promise<void> {
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
        }),
    );

    // Initialize CLOB client for market data
    try {
      this.clobClient = await initializeClobClient(runtime);
      elizaLogger.info("CLOB client initialized successfully");
    } catch (error) {
      elizaLogger.error("Failed to initialize CLOB client: " + error);
      return;
    }

    // Check initial balance
    try {
      const balanceInfo = await checkPolymarketBalance(runtime, "0");
      const balance = parseFloat(balanceInfo.usdcBalance);
      elizaLogger.info(`💰 Polymarket Balance: $${balance.toFixed(2)} USDC`);

      if (balance < 1) {
        elizaLogger.warn(
          "⚠️  WARNING: No USDC balance found in Polymarket account!",
        );
        elizaLogger.warn(
          "📝 You need to deposit USDC to your Polymarket account to enable trading",
        );
        elizaLogger.warn("🔗 Visit app.polymarket.com to deposit funds");
      }
    } catch (error) {
      elizaLogger.error("Failed to check initial balance: " + error);
    }

    if (!this.tradingConfig.unsupervisedMode) {
      elizaLogger.info(
        "⚠️  UNSUPERVISED MODE DISABLED - Running in monitoring mode only",
      );
      elizaLogger.info(
        "📊 Markets will be scanned but NO trades will be executed",
      );
      elizaLogger.info(
        "💡 To enable trading: Set UNSUPERVISED_MODE=true in .env",
      );
    } else {
      elizaLogger.info(
        "🚨 UNSUPERVISED MODE ENABLED - Trades will be executed automatically!",
      );
    }

    await this.loadExistingPositions();
    this.startAutonomousTrading();
  }

  private async loadExistingPositions(): Promise<void> {
    try {
      // Use the getPortfolioPositions action to load positions
      const message = {
        id: crypto.randomUUID() as UUID,
        userId: this.runtime.agentId as UUID,
        agentId: this.runtime.agentId as UUID,
        roomId: this.runtime.agentId as UUID,
        content: { text: "get my positions" },
        createdAt: Date.now(),
        entityId: null,
      } as unknown as Memory;

      const callback: HandlerCallback = async (content: Content) => {
        const data = content as any;
        if (data?.data?.positions) {
          this.openPositions.clear();
          data.data.positions.forEach((pos: any) => {
            this.openPositions.set(pos.marketConditionId || pos.tokenId, pos);
          });
        }
        return [];
      };

      const state: State = {
        recentMessagesData: [
          {
            userId: this.runtime.agentId,
            username: "autonomous-trader",
            content: { text: "get my positions" },
          },
        ],
        values: {},
        data: {},
        text: "get my positions",
      } as State;

      const result = await getPortfolioPositionsAction.handler(
        this.runtime,
        message,
        state,
        undefined,
        callback,
      );

      elizaLogger.info(
        `Loaded ${this.openPositions.size} open positions from wallet`,
      );
    } catch (error) {
      elizaLogger.error("Failed to load existing positions: " + error);
    }
  }

  private startAutonomousTrading(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    elizaLogger.info(
      "📡 Starting market monitoring - scanning every 60 seconds",
    );
    elizaLogger.info(
      `🎯 Monitoring ${getMarketsToMonitor()?.length || 0} hardcoded markets`,
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

      const opportunities = await this.findTradingOpportunities();

      if (opportunities.length > 0) {
        elizaLogger.info(
          `✨ Found ${opportunities.length} trading opportunities!`,
        );
        for (const opp of opportunities) {
          elizaLogger.info(
            `  📈 ${opp.question}: ${opp.outcome} @ ${(opp.currentPrice * 100).toFixed(1)}%`,
          );
        }
      } else {
        elizaLogger.debug("No trading opportunities found in current scan");
      }

      for (const opportunity of opportunities) {
        if (!this.canTrade()) break;

        const decision = await this.evaluateOpportunity(opportunity);

        if (decision.shouldTrade) {
          if (this.tradingConfig.unsupervisedMode) {
            elizaLogger.info(`🎲 EXECUTING TRADE: ${opportunity.question}`);
            await this.executeTrade(decision);
          } else {
            elizaLogger.info(
              `📋 WOULD TRADE (monitoring mode): ${opportunity.question}`,
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

    if (this.openPositions.size >= this.tradingConfig.maxOpenPositions) {
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

  private async findTradingOpportunities(): Promise<MarketOpportunity[]> {
    // Check if we should use simple strategy with hardcoded markets
    const simpleConfig = getSimpleStrategyConfig();
    if (simpleConfig.ENABLED && simpleConfig.USE_HARDCODED_ONLY) {
      return this.findSimpleStrategyOpportunities();
    }

    const opportunities: MarketOpportunity[] = [];

    try {
      // For ML strategy, we would use searchMarkets action
      // For now, return empty as this would require more complex integration
      elizaLogger.info(
        "ML-based market scanning not yet implemented with plugin",
      );
      return [];

      // This would need to be reimplemented with plugin actions

      // Sort by expected value
      opportunities.sort((a, b) => b.expectedValue - a.expectedValue);

      elizaLogger.info(`Found ${opportunities.length} trading opportunities`);
      return opportunities.slice(0, 5); // Return top 5 opportunities
    } catch (error) {
      elizaLogger.error("Error finding trading opportunities: " + error);
      return [];
    }
  }

  /**
   * Find opportunities using the simple threshold strategy
   */
  private async findSimpleStrategyOpportunities(): Promise<
    MarketOpportunity[]
  > {
    const opportunities: MarketOpportunity[] = [];
    const config = getSimpleStrategyConfig();

    try {
      const marketIds = getMarketsToMonitor();
      if (!marketIds || marketIds.length === 0) {
        elizaLogger.warn("No hardcoded markets configured");
        return [];
      }

      elizaLogger.info(
        `Checking ${marketIds.length} hardcoded markets for simple strategy opportunities`,
      );

      for (const conditionId of marketIds) {
        // Skip if we already have a position in this market
        if (this.openPositions.has(conditionId)) {
          elizaLogger.debug(
            `Skipping ${conditionId.slice(0, 10)}... - already have position`,
          );
          continue;
        }

        // Get market data directly from Gamma API
        const marketUrl = `https://gamma-api.polymarket.com/markets?condition_ids=${conditionId}`;
        const response = await fetch(marketUrl);

        if (!response.ok) {
          elizaLogger.debug(
            `Failed to fetch market ${conditionId.slice(0, 10)}...`,
          );
          continue;
        }

        const marketData = (await response.json()) as any[];
        const market = marketData[0];

        if (!market || !market.active) {
          elizaLogger.debug(
            `Market ${conditionId.slice(0, 10)}... not found or inactive`,
          );
          continue;
        }

        elizaLogger.debug(`Analyzing market: ${market.question}`);

        // Parse outcomes
        const outcomes = JSON.parse(market.outcomes || '["Yes", "No"]');
        const clobTokenIds = JSON.parse(market.clobTokenIds || "[]");

        // Get prices from outcomePrices or market maker data
        let prices: number[] = [];
        if (market.outcomePrices) {
          // outcomePrices is already a JSON string array like "[\"0.045\", \"0.955\"]"
          const priceStrings = JSON.parse(market.outcomePrices);
          prices = priceStrings.map((p: string) => parseFloat(p));
        } else if (market.marketMakerData) {
          const mmData = JSON.parse(market.marketMakerData || "{}");
          prices = mmData.prices || [];
        } else if (market.bestBid && market.bestAsk) {
          // bestBid and bestAsk are single values, not arrays
          const bid = parseFloat(market.bestBid || "0.5");
          const ask = parseFloat(market.bestAsk || "0.5");
          prices = [(bid + ask) / 2];
        }

        // Check each outcome for simple strategy triggers
        for (let i = 0; i < outcomes.length; i++) {
          const outcomeName = outcomes[i].toUpperCase();
          const price = prices[i] || 0.5;

          // Check if price meets our simple criteria
          // Buy when price is BELOW threshold (cheap)
          if (price <= config.BUY_THRESHOLD) {
            const edge = config.BUY_THRESHOLD - price;

            if (edge >= config.MIN_EDGE) {
              elizaLogger.info(
                `Simple strategy opportunity found: ${market.question}`,
              );
              elizaLogger.info(
                `  ${outcomeName} at ${(price * 100).toFixed(1)}% (below ${config.BUY_THRESHOLD * 100}% threshold)`,
              );

              opportunities.push({
                marketId: conditionId,
                question: market.question,
                outcome: outcomeName as "YES" | "NO",
                currentPrice: price,
                predictedProbability: price + edge,
                confidence: 0.9,
                expectedValue: edge * 100,
                newsSignals: [
                  `Simple strategy: ${outcomeName} below ${config.BUY_THRESHOLD * 100}%`,
                ],
                riskScore: 0.1,
              });
            }
          }

          // Alternative: look for NO being cheap (YES being expensive)
          // This means YES is above 90%, so we buy NO
          if (outcomeName === "YES" && price >= config.SELL_THRESHOLD) {
            // The YES is expensive, so NO is cheap
            const noPrice = 1 - price;
            const edge = price - config.SELL_THRESHOLD;

            if (edge >= config.MIN_EDGE && noPrice <= config.BUY_THRESHOLD) {
              elizaLogger.info(
                `Simple strategy opportunity found (inverse): ${market.question}`,
              );
              elizaLogger.info(
                `  NO at ${(noPrice * 100).toFixed(1)}% (YES above ${config.SELL_THRESHOLD * 100}% threshold)`,
              );

              opportunities.push({
                marketId: conditionId,
                question: market.question,
                outcome: "NO",
                currentPrice: noPrice,
                predictedProbability: noPrice + edge,
                confidence: 0.9,
                expectedValue: edge * 100,
                newsSignals: [
                  `Simple strategy: YES above ${config.SELL_THRESHOLD * 100}%, buying NO`,
                ],
                riskScore: 0.1,
              });
            }
          }
        }
      }

      elizaLogger.info(
        `Found ${opportunities.length} simple strategy opportunities`,
      );
      return opportunities;
    } catch (error) {
      elizaLogger.error(
        "Error finding simple strategy opportunities: " + error,
      );
      return [];
    }
  }

  private async analyzeMarket(market: any): Promise<MarketOpportunity | null> {
    try {
      // Get news signals for this market
      const newsSignals = await this.getNewsSignals(market.question);

      // Calculate predicted probability based on signals
      const predictedProbability = await this.calculateProbability(
        market,
        newsSignals,
      );

      // Determine best outcome to trade
      const yesPrice =
        market.outcomes?.find((o: any) => o.name === "Yes")?.price || 0.5;
      const noPrice =
        market.outcomes?.find((o: any) => o.name === "No")?.price || 0.5;

      let outcome: "YES" | "NO";
      let currentPrice: number;
      let expectedValue: number;

      if (predictedProbability > yesPrice) {
        outcome = "YES";
        currentPrice = yesPrice;
        expectedValue = (predictedProbability - yesPrice) * 100;
      } else if (1 - predictedProbability > noPrice) {
        outcome = "NO";
        currentPrice = noPrice;
        expectedValue = (1 - predictedProbability - noPrice) * 100;
      } else {
        return null; // No edge
      }

      // Calculate confidence based on edge size and news signal strength
      const edgeSize = Math.abs(predictedProbability - currentPrice);
      const signalStrength = newsSignals.length > 0 ? 0.2 : 0;
      const confidence = Math.min(0.95, edgeSize + signalStrength);

      // Calculate risk score
      const riskScore = this.calculateRiskScore(market, edgeSize);

      return {
        marketId: market.id,
        question: market.question,
        outcome,
        currentPrice,
        predictedProbability,
        confidence,
        expectedValue,
        newsSignals,
        riskScore,
      };
    } catch (error) {
      elizaLogger.error("Error analyzing market: " + market.id + " - " + error);
      return null;
    }
  }

  private async getNewsSignals(_question: string): Promise<string[]> {
    const signals: string[] = [];

    try {
      // In production, this would query news from database
      // For now, return empty signals
      return signals;
    } catch (error) {
      elizaLogger.error("Error getting news signals: " + error);
    }

    return signals;
  }

  private async calculateProbability(
    market: any,
    _newsSignals: string[],
  ): Promise<number> {
    try {
      // Use LLM to analyze market with news context
      // In production, this would use the runtime's LLM with a prompt
      // analyzing the market question, prices, volume, and news signals
      // For now, return a mock probability
      const response = market?.outcomes ? "0.5" : "0.5";

      const probability = parseFloat(response.trim());
      return isNaN(probability) ? 0.5 : Math.max(0, Math.min(1, probability));
    } catch (error) {
      elizaLogger.error("Error calculating probability: " + error);
      return 0.5; // Default to market price
    }
  }

  private calculateRiskScore(market: any, edgeSize: number): number {
    // Higher risk for:
    // - Low volume markets
    // - Markets closing soon
    // - Small edge size

    const volumeRisk = market.volume < 50000 ? 0.3 : 0;
    const timeRisk =
      market.endDate &&
      new Date(market.endDate).getTime() - Date.now() < 86400000
        ? 0.3
        : 0;
    const edgeRisk = edgeSize < 0.1 ? 0.4 : 0;

    return volumeRisk + timeRisk + edgeRisk;
  }

  private async evaluateOpportunity(
    opportunity: MarketOpportunity,
  ): Promise<TradingDecision> {
    // Use fixed size for simple strategy testing
    const simpleConfig = getSimpleStrategyConfig();
    const adjustedSize = simpleConfig.ENABLED
      ? simpleConfig.TEST_POSITION_SIZE
      : this.calculatePositionSize(opportunity);

    // Final confidence check with risk adjustment
    const finalConfidence =
      opportunity.confidence * (1 - opportunity.riskScore);

    // Override for simple strategy - always trade if we found an opportunity
    const shouldTrade = simpleConfig.ENABLED
      ? adjustedSize > 0 && opportunity.confidence > 0.8
      : finalConfidence >= this.tradingConfig.minConfidenceThreshold &&
        adjustedSize > 0 &&
        opportunity.expectedValue > 5; // Minimum $5 expected value

    const reasoning = this.generateTradingReasoning(opportunity, shouldTrade);

    return {
      shouldTrade,
      marketId: opportunity.marketId,
      outcome: opportunity.outcome,
      size: adjustedSize,
      price: opportunity.currentPrice,
      confidence: finalConfidence,
      reasoning,
    };
  }

  private calculatePositionSize(opportunity: MarketOpportunity): number {
    // Kelly Criterion-inspired sizing
    const edge = Math.abs(
      opportunity.predictedProbability - opportunity.currentPrice,
    );
    const kellyFraction = edge / (1 - opportunity.currentPrice);

    // Apply conservative factor and limits
    const conservativeFactor = 0.25; // Use 25% of Kelly
    const rawSize =
      kellyFraction * conservativeFactor * this.tradingConfig.maxPositionSize;

    // Apply risk limit
    const riskAdjustedSize = Math.min(
      rawSize,
      this.tradingConfig.riskLimitPerTrade,
    );

    // Round to nearest dollar
    return Math.floor(riskAdjustedSize);
  }

  private generateTradingReasoning(
    opportunity: MarketOpportunity,
    shouldTrade: boolean,
  ): string {
    const reasons = [];

    if (shouldTrade) {
      reasons.push(
        `High confidence trade (${(opportunity.confidence * 100).toFixed(1)}%)`,
      );
      reasons.push(`Expected value: $${opportunity.expectedValue.toFixed(2)}`);

      if (opportunity.newsSignals.length > 0) {
        reasons.push(
          `Supported by ${opportunity.newsSignals.length} news signals`,
        );
      }

      reasons.push(
        `Predicted probability: ${(opportunity.predictedProbability * 100).toFixed(1)}%`,
      );
      reasons.push(
        `Current price: ${(opportunity.currentPrice * 100).toFixed(1)}%`,
      );
    } else {
      if (opportunity.confidence < this.tradingConfig.minConfidenceThreshold) {
        reasons.push(
          `Confidence too low (${(opportunity.confidence * 100).toFixed(1)}%)`,
        );
      }
      if (opportunity.expectedValue <= 5) {
        reasons.push(
          `Expected value too small ($${opportunity.expectedValue.toFixed(2)})`,
        );
      }
      if (opportunity.riskScore > 0.5) {
        reasons.push(
          `Risk score too high (${(opportunity.riskScore * 100).toFixed(1)}%)`,
        );
      }
    }

    return reasons.join(". ");
  }

  private async executeTrade(decision: TradingDecision): Promise<void> {
    try {
      elizaLogger.info(
        "Executing autonomous trade: " +
          JSON.stringify({
            marketId: decision.marketId,
            outcome: decision.outcome,
            size: decision.size,
            confidence: decision.confidence,
          }),
      );

      // Check wallet balance before attempting to place order
      const balanceCheck = await this.checkBalance(decision.size);
      if (!balanceCheck.hasEnoughBalance) {
        elizaLogger.error(
          `Insufficient balance for trade. Required: $${decision.size}, Available: $${balanceCheck.usdcBalance}`,
        );
        elizaLogger.info(
          "⚠️  Trade skipped due to insufficient balance. Consider depositing USDC to your Polymarket account.",
        );
        return;
      }

      elizaLogger.info(
        `✅ Balance check passed. Available: $${balanceCheck.usdcBalance}, Required: $${decision.size}`,
      );

      // In production, store trading decision to database
      // For now, just log the decision

      // Execute the trade through Polymarket action
      // This would integrate with the existing Polymarket plugin
      const tradeResult = await this.placeOrder(decision);

      if (tradeResult.success) {
        this.dailyTradeCount++;
        // Reload positions after successful trade
        await this.loadExistingPositions();

        // Broadcast to social media if enabled
        if (this.tradingConfig.socialBroadcastEnabled) {
          await this.broadcastPosition(decision);
        }

        elizaLogger.info(
          "Trade executed successfully: " +
            tradeResult.orderId +
            " for market " +
            decision.marketId,
        );
      } else {
        // Check if it's a balance/allowance error and try to handle it
        if (
          tradeResult.error &&
          tradeResult.error.includes("not enough balance / allowance")
        ) {
          elizaLogger.info(
            "Detected L2 balance issue, attempting automatic deposit from L1...",
          );

          // Try to deposit and retry the order
          const depositSuccess = await this.handleL2Deposit(decision.size);
          if (depositSuccess) {
            elizaLogger.info("Deposit successful, retrying order...");

            // Wait a bit for L2 to recognize the deposit
            await new Promise((resolve) => setTimeout(resolve, 5000));

            // Retry the order
            const retryResult = await this.placeOrder(decision);
            if (retryResult.success) {
              this.dailyTradeCount++;
              await this.loadExistingPositions();

              if (this.tradingConfig.socialBroadcastEnabled) {
                await this.broadcastPosition(decision);
              }

              elizaLogger.info(
                "Trade executed successfully after deposit: " +
                  retryResult.orderId,
              );
            } else {
              elizaLogger.error(
                "Trade still failed after deposit: " + retryResult.error,
              );
            }
          } else {
            elizaLogger.error("Could not complete L2 deposit, trade cancelled");
          }
        } else {
          elizaLogger.error(
            "Trade execution failed for market " +
              decision.marketId +
              ": " +
              tradeResult.error,
          );
        }
      }
    } catch (error) {
      elizaLogger.error("Error executing trade: " + error);
    }
  }

  private async placeOrder(decision: TradingDecision): Promise<any> {
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
          "Could not find token ID for outcome " + decision.outcome,
        );
        return { success: false, error: "Token ID not found" };
      }

      // Validate minimum order size ($1 minimum on Polymarket)
      const orderValueUSDC = decision.size;
      if (orderValueUSDC < 1) {
        elizaLogger.warn(
          `Order value $${orderValueUSDC} is below minimum $1, adjusting to minimum`,
        );
        decision.size = Math.max(1, decision.size);
      }

      // Convert USDC amount to number of shares
      // Number of shares = USDC amount / price per share
      const sharesAmount = decision.size / decision.price;

      elizaLogger.info(
        `Placing direct order: ${decision.size} USDC (${sharesAmount.toFixed(2)} shares) of ${decision.outcome} @ ${decision.price} for "${market.question}"`,
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
        this.clobClient, // Pass the existing CLOB client
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
      const message = `🤖 New Position: ${decision.outcome} on "${decision.marketId.slice(0, 8)}..."
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

  private async checkBalance(requiredAmount: number): Promise<any> {
    try {
      const balanceInfo = await checkPolymarketBalance(
        this.runtime,
        requiredAmount.toString(),
      );
      elizaLogger.info(
        `Balance check: Available=$${balanceInfo.usdcBalance}, Required=$${requiredAmount}, Sufficient=${balanceInfo.hasEnoughBalance}`,
      );
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

  private async handleL2Deposit(requiredAmount: number): Promise<boolean> {
    try {
      elizaLogger.info(
        `Attempting to deposit $${requiredAmount} from L1 to L2...`,
      );

      // Import deposit manager
      const { depositUSDC } = await import(
        "../../plugin-polymarket/src/utils/depositManager.js"
      );

      // Add a buffer to the required amount
      const depositAmount = Math.ceil(requiredAmount + 2); // Add $2 buffer

      elizaLogger.info(`Depositing $${depositAmount} USDC to Polymarket L2...`);

      const depositResult = await depositUSDC(
        this.runtime,
        depositAmount.toString(),
      );

      if (depositResult.success && depositResult.transactionHash) {
        elizaLogger.info(
          `✅ Deposit successful! TX: ${depositResult.transactionHash}`,
        );
        elizaLogger.info(
          `Deposit will be available on L2 shortly. Transaction: ${depositResult.transactionHash}`,
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

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    elizaLogger.info("Autonomous Trading Service stopped");
  }
}
