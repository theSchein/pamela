#!/usr/bin/env tsx
/**
 * Trading Simulation Script
 * Simulates the full trading flow without executing real trades
 */

import { elizaLogger } from "@elizaos/core";
import { AutonomousTradingService } from "../src/services/autonomous-trading/index.js";
import { getSimpleStrategyConfig } from "../src/config/hardcoded-markets.js";
import dotenv from "dotenv";

dotenv.config();

// Override unsupervised mode for safety
process.env.UNSUPERVISED_MODE = "false";

async function simulateTrading() {
  console.log("=== Trading Simulation ===\n");
  console.log("⚠️  SIMULATION MODE - No real trades will be executed\n");

  const config = getSimpleStrategyConfig();
  const service = new AutonomousTradingService();

  // Mock runtime
  const mockRuntime = {
    agentId: "test-agent",
    databaseAdapter: {
      getMemories: async () => [],
    },
    generateText: async () => "0.5",
    getSetting: (key: string) => {
      // Override for simulation
      if (key === "UNSUPERVISED_MODE") return "false";
      return process.env[key];
    },
    logger: elizaLogger,
  };

  // Manually set trading config for simulation
  service["tradingConfig"] = {
    unsupervisedMode: false, // Safety override
    maxPositionSize: 100,
    minConfidenceThreshold: 0.7,
    maxDailyTrades: 10,
    maxOpenPositions: 20,
    riskLimitPerTrade: 50,
    autoRedemptionEnabled: false,
    socialBroadcastEnabled: false,
    tradingHoursRestriction: undefined,
  };

  service["runtime"] = mockRuntime;

  console.log("1. Finding Trading Opportunities...");
  const opportunities =
    await service["findSimpleStrategyOpportunities"].call(service);

  if (opportunities.length === 0) {
    console.log("   No opportunities found");
    return;
  }

  console.log(`   Found ${opportunities.length} opportunities:\n`);

  for (const opp of opportunities) {
    console.log(`   Market: ${opp.question}`);
    console.log(`   - Outcome: ${opp.outcome}`);
    console.log(`   - Current Price: ${(opp.currentPrice * 100).toFixed(1)}%`);
    console.log(`   - Confidence: ${(opp.confidence * 100).toFixed(1)}%`);
    console.log(`   - Expected Value: $${opp.expectedValue.toFixed(2)}`);
    console.log(`   - Signal: ${opp.newsSignals[0]}\n`);
  }

  console.log("2. Evaluating Trading Decisions...\n");

  const decisions = [];
  for (const opp of opportunities) {
    const decision = await service["evaluateOpportunity"].call(service, opp);
    decisions.push(decision);

    console.log(`   Market: ${opp.question.slice(0, 50)}...`);
    console.log(
      `   - Should Trade: ${decision.shouldTrade ? "✅ YES" : "❌ NO"}`,
    );
    console.log(`   - Size: $${decision.size}`);
    console.log(`   - Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
    console.log(`   - Reasoning: ${decision.reasoning}\n`);
  }

  console.log("3. Simulated Trade Execution...\n");

  let totalPositions = 0;
  let totalRisk = 0;

  for (const decision of decisions) {
    if (decision.shouldTrade) {
      totalPositions++;
      totalRisk += decision.size;

      console.log(`   📊 SIMULATED TRADE #${totalPositions}:`);
      console.log(`      Market ID: ${decision.marketId.slice(0, 20)}...`);
      console.log(`      Action: BUY ${decision.outcome}`);
      console.log(`      Size: $${decision.size}`);
      console.log(`      Price: ${(decision.price * 100).toFixed(1)}%`);
      console.log(
        `      Potential Profit: $${((decision.size * (1 - decision.price)) / decision.price).toFixed(2)}`,
      );
      console.log(`      Potential Loss: $${decision.size.toFixed(2)}\n`);
    }
  }

  console.log("4. Simulation Summary:");
  console.log(`   - Opportunities Found: ${opportunities.length}`);
  console.log(`   - Trades to Execute: ${totalPositions}`);
  console.log(`   - Total Risk: $${totalRisk.toFixed(2)}`);
  console.log(
    `   - Risk per Trade: $${totalPositions > 0 ? (totalRisk / totalPositions).toFixed(2) : "0.00"}`,
  );

  if (totalPositions > 0) {
    console.log("\n💡 Next Steps:");
    console.log("   1. Review the trades above");
    console.log("   2. If comfortable, set UNSUPERVISED_MODE=true in .env");
    console.log("   3. Run 'npm start' to begin live trading");
    console.log("   4. Monitor logs for trade execution");
    console.log("\n⚠️  IMPORTANT: Start with small position sizes to test!");
  } else {
    console.log("\n   No trades would be executed with current settings");
  }
}

// Run simulation
simulateTrading().catch(console.error);
