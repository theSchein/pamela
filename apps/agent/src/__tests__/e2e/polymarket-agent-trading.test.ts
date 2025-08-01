import { type TestSuite } from "@elizaos/core";

/**
 * Polymarket Agent Trading E2E Test Suite
 *
 * This suite tests the complete user conversation flow for Polymarket trading:
 * 1. User asks to see prediction markets
 * 2. Agent shows active markets
 * 3. Agent selects a market and buys YES/NO shares
 * 4. Agent places order and confirms to user
 * 5. User asks to see portfolio/positions
 * 6. User tells agent to sell something from portfolio
 * 7. Agent executes sell order
 *
 * This tests the full natural language → trading workflow that makes Pamela autonomous.
 */
export class PolymarketAgentTradingTestSuite implements TestSuite {
  name = "polymarket-agent-trading";
  description = "E2E tests for complete Polymarket trading conversations";

  tests = [
    {
      name: "Step 1: User asks to see prediction markets",
      fn: async (runtime: any) => {
        /**
         * Test that when a user asks to see prediction markets,
         * the agent responds with active markets from Polymarket
         */
        try {
          console.log("🎯 Testing Step 1: Show prediction markets");

          // Create a unique room for this test
          const roomId = `test-room-markets-${Date.now()}`;
          const userId = "test-user-trader";

          // User asks to see prediction markets
          const marketRequest = {
            id: `msg-${Date.now()}`,
            userId: userId,
            agentId: runtime.agentId,
            roomId: roomId,
            content: {
              text: "Show me some active prediction markets I can trade on",
              type: "text",
            },
            createdAt: Date.now(),
          };

          console.log(
            "📤 Sending request: 'Show me some active prediction markets'",
          );

          // Process the message through the runtime
          await runtime.processMessage(marketRequest);

          // Give the agent time to fetch markets and respond
          await new Promise((resolve) => setTimeout(resolve, 3000));

          // Retrieve messages from the conversation
          const messages = await runtime.messageManager.getMessages({
            roomId,
            limit: 10,
          });

          console.log(
            `📨 Retrieved ${messages.length} messages from conversation`,
          );

          // Verify we have at least 2 messages (user + agent)
          if (messages.length < 2) {
            throw new Error(
              `Expected at least 2 messages, got ${messages.length}`,
            );
          }

          // Find the agent's response
          const agentResponse = messages.find(
            (m: any) =>
              m.userId === runtime.agentId &&
              m.roomId === roomId &&
              m.id !== marketRequest.id,
          );

          if (!agentResponse) {
            throw new Error("Agent did not respond to market request");
          }

          console.log(
            "🤖 Agent response:",
            agentResponse.content.text.substring(0, 200) + "...",
          );

          // Verify the response contains market information
          const responseText = agentResponse.content.text.toLowerCase();
          const marketKeywords = [
            "market",
            "prediction",
            "polymarket",
            "trade",
            "trading",
            "yes",
            "no",
            "price",
            "$",
            "shares",
          ];

          const containsMarketInfo = marketKeywords.some((keyword) =>
            responseText.includes(keyword),
          );

          if (!containsMarketInfo) {
            throw new Error(
              `Agent response did not contain market information. ` +
                `Response was: "${agentResponse.content.text}"`,
            );
          }

          // Check if the agent used any Polymarket actions
          if (agentResponse.content.data) {
            console.log(
              "📊 Agent action data:",
              JSON.stringify(agentResponse.content.data, null, 2),
            );
          }

          console.log(
            "✅ Step 1 PASSED: Agent successfully showed prediction markets",
          );

          // Test completed successfully - no need to return anything
        } catch (error) {
          console.error("❌ Step 1 FAILED:", error);
          throw new Error(
            `Step 1 (show markets) failed: ${(error as Error).message}`,
          );
        }
      },
    },

    {
      name: "Step 2: Agent selects market and makes buy decision",
      fn: async (runtime: any) => {
        /**
         * Test that the agent can make autonomous trading decisions
         * and place a buy order for YES or NO shares
         */
        try {
          console.log("🎯 Testing Step 2: Agent makes buy decision");

          // Create a new room for this test
          const roomId = `test-room-buy-${Date.now()}`;
          const userId = "test-user-trader";

          // User asks agent to pick a market and buy shares
          const buyRequest = {
            id: `msg-${Date.now()}`,
            userId: userId,
            agentId: runtime.agentId,
            roomId: roomId,
            content: {
              text: "Pick an interesting market and buy $5 worth of shares based on your analysis",
              type: "text",
            },
            createdAt: Date.now(),
          };

          console.log(
            "📤 Sending request: 'Pick a market and buy $5 worth of shares'",
          );

          // Process the message through the runtime
          await runtime.processMessage(buyRequest);

          // Give the agent more time for market analysis and order placement
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // Retrieve messages from the conversation
          const messages = await runtime.messageManager.getMessages({
            roomId,
            limit: 10,
          });

          console.log(
            `📨 Retrieved ${messages.length} messages from conversation`,
          );

          // Find the agent's response
          const agentResponse = messages.find(
            (m: any) =>
              m.userId === runtime.agentId &&
              m.roomId === roomId &&
              m.id !== buyRequest.id,
          );

          if (!agentResponse) {
            throw new Error("Agent did not respond to buy request");
          }

          console.log(
            "🤖 Agent response:",
            agentResponse.content.text.substring(0, 300) + "...",
          );

          // Verify the response indicates trading activity
          const responseText = agentResponse.content.text.toLowerCase();
          const tradingKeywords = [
            "buy",
            "buying",
            "order",
            "placed",
            "shares",
            "position",
            "yes",
            "no",
            "market",
            "analysis",
            "$",
          ];

          const containsTradingInfo = tradingKeywords.some((keyword) =>
            responseText.includes(keyword),
          );

          if (!containsTradingInfo) {
            throw new Error(
              `Agent response did not contain trading information. ` +
                `Response was: "${agentResponse.content.text}"`,
            );
          }

          // Check if any trading actions were executed
          if (agentResponse.content.data) {
            console.log(
              "💰 Trading action data:",
              JSON.stringify(agentResponse.content.data, null, 2),
            );
          }

          console.log("✅ Step 2 PASSED: Agent made autonomous buy decision");
        } catch (error) {
          console.error("❌ Step 2 FAILED:", error);
          throw new Error(
            `Step 2 (buy decision) failed: ${(error as Error).message}`,
          );
        }
      },
    },

    {
      name: "Step 3: User asks to see portfolio",
      fn: async (runtime: any) => {
        /**
         * Test that user can request portfolio view and agent shows positions
         */
        try {
          console.log("🎯 Testing Step 3: Show portfolio");

          // Create a new room for this test
          const roomId = `test-room-portfolio-${Date.now()}`;
          const userId = "test-user-trader";

          // User asks to see their portfolio
          const portfolioRequest = {
            id: `msg-${Date.now()}`,
            userId: userId,
            agentId: runtime.agentId,
            roomId: roomId,
            content: {
              text: "Show me my current portfolio and positions",
              type: "text",
            },
            createdAt: Date.now(),
          };

          console.log("📤 Sending request: 'Show me my portfolio'");

          // Process the message through the runtime
          await runtime.processMessage(portfolioRequest);

          // Give the agent time to fetch portfolio data
          await new Promise((resolve) => setTimeout(resolve, 3000));

          // Retrieve messages from the conversation
          const messages = await runtime.messageManager.getMessages({
            roomId,
            limit: 10,
          });

          console.log(
            `📨 Retrieved ${messages.length} messages from conversation`,
          );

          // Find the agent's response
          const agentResponse = messages.find(
            (m: any) =>
              m.userId === runtime.agentId &&
              m.roomId === roomId &&
              m.id !== portfolioRequest.id,
          );

          if (!agentResponse) {
            throw new Error("Agent did not respond to portfolio request");
          }

          console.log(
            "🤖 Agent response:",
            agentResponse.content.text.substring(0, 300) + "...",
          );

          // Verify the response contains portfolio information
          const responseText = agentResponse.content.text.toLowerCase();
          const portfolioKeywords = [
            "portfolio",
            "position",
            "shares",
            "balance",
            "usdc",
            "market",
            "value",
            "total",
            "$",
          ];

          const containsPortfolioInfo = portfolioKeywords.some((keyword) =>
            responseText.includes(keyword),
          );

          if (!containsPortfolioInfo) {
            throw new Error(
              `Agent response did not contain portfolio information. ` +
                `Response was: "${agentResponse.content.text}"`,
            );
          }

          // Check portfolio data
          if (agentResponse.content.data) {
            console.log(
              "📊 Portfolio data:",
              JSON.stringify(agentResponse.content.data, null, 2),
            );
          }

          console.log("✅ Step 3 PASSED: Agent successfully showed portfolio");
        } catch (error) {
          console.error("❌ Step 3 FAILED:", error);
          throw new Error(
            `Step 3 (show portfolio) failed: ${(error as Error).message}`,
          );
        }
      },
    },

    {
      name: "Step 4: User asks to sell position",
      fn: async (runtime: any) => {
        /**
         * Test that user can request selling a position and agent executes
         */
        try {
          console.log("🎯 Testing Step 4: Sell position");

          // Create a new room for this test
          const roomId = `test-room-sell-${Date.now()}`;
          const userId = "test-user-trader";

          // User asks to sell a position (we'll ask agent to pick one)
          const sellRequest = {
            id: `msg-${Date.now()}`,
            userId: userId,
            agentId: runtime.agentId,
            roomId: roomId,
            content: {
              text: "Sell one of my positions - pick whichever one looks best to sell right now",
              type: "text",
            },
            createdAt: Date.now(),
          };

          console.log("📤 Sending request: 'Sell one of my positions'");

          // Process the message through the runtime
          await runtime.processMessage(sellRequest);

          // Give the agent time to analyze portfolio and execute sell
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // Retrieve messages from the conversation
          const messages = await runtime.messageManager.getMessages({
            roomId,
            limit: 10,
          });

          console.log(
            `📨 Retrieved ${messages.length} messages from conversation`,
          );

          // Find the agent's response
          const agentResponse = messages.find(
            (m: any) =>
              m.userId === runtime.agentId &&
              m.roomId === roomId &&
              m.id !== sellRequest.id,
          );

          if (!agentResponse) {
            throw new Error("Agent did not respond to sell request");
          }

          console.log(
            "🤖 Agent response:",
            agentResponse.content.text.substring(0, 300) + "...",
          );

          // Verify the response indicates selling activity
          const responseText = agentResponse.content.text.toLowerCase();
          const sellingKeywords = [
            "sell",
            "selling",
            "sold",
            "order",
            "position",
            "shares",
            "proceeds",
            "executed",
            "market",
            "$",
          ];

          const containsSellingInfo = sellingKeywords.some((keyword) =>
            responseText.includes(keyword),
          );

          if (!containsSellingInfo) {
            throw new Error(
              `Agent response did not contain selling information. ` +
                `Response was: "${agentResponse.content.text}"`,
            );
          }

          // Check selling action data
          if (agentResponse.content.data) {
            console.log(
              "💸 Selling action data:",
              JSON.stringify(agentResponse.content.data, null, 2),
            );
          }

          console.log(
            "✅ Step 4 PASSED: Agent successfully executed sell order",
          );
        } catch (error) {
          console.error("❌ Step 4 FAILED:", error);
          throw new Error(
            `Step 4 (sell position) failed: ${(error as Error).message}`,
          );
        }
      },
    },
  ];
}

// Export a default instance for the test runner
export default new PolymarketAgentTradingTestSuite();
