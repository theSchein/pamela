import { type TestSuite } from "@elizaos/core";

/**
 * Basic Agent Test Suite
 *
 * Simple tests to verify that Pamela agent is working correctly
 * before testing complex trading workflows.
 */
export class BasicAgentTestSuite implements TestSuite {
  name = "basic-agent";
  description = "Basic agent functionality tests";

  tests = [
    {
      name: "Agent responds to basic greeting",
      fn: async (runtime: any) => {
        try {
          console.log("🎯 Testing basic agent greeting response");

          // Create a unique room for this test
          const roomId = `test-room-greeting-${Date.now()}`;
          const userId = "test-user";

          // Send a simple greeting
          const greetingMessage = {
            id: `msg-${Date.now()}`,
            userId: userId,
            agentId: runtime.agentId,
            roomId: roomId,
            content: {
              text: "Hello Pamela!",
              type: "text",
            },
            createdAt: Date.now(),
          };

          console.log("📤 Sending greeting: 'Hello Pamela!'");

          // Process the message through the runtime
          await runtime.processMessage(greetingMessage);

          // Give the agent time to respond
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Retrieve messages from the conversation
          const messages = await runtime.messageManager.getMessages({
            roomId,
            limit: 10,
          });

          console.log(`📨 Retrieved ${messages.length} messages`);

          // Verify we have at least 2 messages (user + agent)
          if (messages.length < 2) {
            throw new Error(
              `Expected at least 2 messages, got ${messages.length}`,
            );
          }

          // Find the agent's response
          const agentResponse = messages.find(
            (m: any) =>
              m.userId === runtime.agentId && m.id !== greetingMessage.id,
          );

          if (!agentResponse) {
            throw new Error("Agent did not respond to greeting");
          }

          console.log("🤖 Agent response:", agentResponse.content.text);

          // Verify the response is reasonable (has some content)
          if (
            !agentResponse.content.text ||
            agentResponse.content.text.length < 5
          ) {
            throw new Error("Agent response was too short or empty");
          }

          console.log("✅ Basic agent greeting test PASSED");
        } catch (error) {
          console.error("❌ Basic agent greeting test FAILED:", error);
          throw new Error(
            `Basic greeting test failed: ${(error as Error).message}`,
          );
        }
      },
    },

    {
      name: "Agent has Pamela character loaded",
      fn: async (runtime: any) => {
        try {
          console.log("🎯 Testing agent character is Pamela");

          // Verify character is loaded
          if (!runtime.character) {
            throw new Error("Character not loaded in runtime");
          }

          // Verify the character has the expected name
          if (runtime.character.name !== "Pamela") {
            throw new Error(
              `Expected character name 'Pamela', got '${runtime.character.name}'`,
            );
          }

          // Verify character has prediction market focus
          const system = runtime.character.system?.toLowerCase() || "";
          const bio = runtime.character.bio?.join(" ").toLowerCase() || "";

          const tradingKeywords = [
            "polymarket",
            "prediction",
            "trading",
            "market",
          ];
          const hasTradeKeywords = tradingKeywords.some(
            (keyword) => system.includes(keyword) || bio.includes(keyword),
          );

          if (!hasTradeKeywords) {
            throw new Error(
              "Character doesn't appear to be configured for trading",
            );
          }

          console.log("✅ Pamela character properly loaded with trading focus");
        } catch (error) {
          console.error("❌ Character test FAILED:", error);
          throw new Error(`Character test failed: ${(error as Error).message}`);
        }
      },
    },

    {
      name: "Polymarket plugin is available",
      fn: async (runtime: any) => {
        try {
          console.log("🎯 Testing Polymarket plugin availability");

          // Check if runtime has plugins/actions available
          if (!runtime.actions || !Array.isArray(runtime.actions)) {
            throw new Error("Runtime actions not available");
          }

          // Look for some key Polymarket actions
          const polymarketActions = [
            "DIRECT_PLACE_ORDER",
            "GET_PORTFOLIO_POSITIONS",
            "GET_SAMPLING_MARKETS",
            "SETUP_TRADING",
          ];

          const availableActions = runtime.actions.map((a: any) => a.name);
          console.log(`📋 Available actions: ${availableActions.length} total`);

          const foundActions = polymarketActions.filter((action) =>
            availableActions.includes(action),
          );

          if (foundActions.length === 0) {
            console.log("Available actions:", availableActions);
            throw new Error("No Polymarket actions found in runtime");
          }

          console.log(
            `✅ Found ${foundActions.length} Polymarket actions: ${foundActions.join(", ")}`,
          );
        } catch (error) {
          console.error("❌ Plugin test FAILED:", error);
          throw new Error(`Plugin test failed: ${(error as Error).message}`);
        }
      },
    },
  ];
}

// Export a default instance for the test runner
export default new BasicAgentTestSuite();
