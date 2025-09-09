import type { Plugin } from "@elizaos/core";
import {
  type Action,
  type ActionResult,
  type Content,
  type GenerateTextParams,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type Provider,
  type ProviderResult,
  Service,
  type State,
  logger,
  composePromptFromState,
} from "@elizaos/core";
import { z } from "zod";
import { newsAnalysisAction } from "./actions/news-analysis";
import { marketConfidenceAction } from "./actions/market-confidence";
import { 
  newsContextProvider, 
  marketIntelligenceProvider, 
  tradingSignalsProvider 
} from "./providers/news-context-provider";

/**
 * Define the configuration schema for the plugin
 * Currently empty as this starter plugin doesn't require configuration
 */
const configSchema = z.object({});

/**
 * Example HelloWorld action
 * This demonstrates the simplest possible action structure
 */
/**
 * Represents an action that responds with a simple hello world message.
 *
 * @typedef {Object} Action
 * @property {string} name - The name of the action
 * @property {string[]} similes - The related similes of the action
 * @property {string} description - Description of the action
 * @property {Function} validate - Validation function for the action
 * @property {Function} handler - The function that handles the action
 * @property {Object[]} examples - Array of examples for the action
 */
const conversationAction: Action = {
  name: "CONVERSATION",
  similes: [
    "CHAT",
    "TALK",
    "DISCUSS",
    "ASK",
    "QUESTION",
    "HELP",
    "EXPLAIN",
    "GENERAL",
  ],
  description:
    "Handle general conversation, questions, and requests about prediction markets and trading",

  validate: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
  ): Promise<boolean> => {
    logger.info("=== CONVERSATION ACTION VALIDATE CALLED ===");
    logger.info("Message content:", message.content.text);
    logger.info("Message source:", message.content.source);
    // This is a general fallback action, always valid
    logger.info("Validation result: true");
    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: any,
    callback: HandlerCallback,
    _responses: Memory[],
  ): Promise<ActionResult> => {
    try {
      logger.info("=== CONVERSATION ACTION HANDLER STARTED ===");
      logger.info("Message content:", message.content.text);
      logger.info("Message ID:", message.id);
      logger.info("Runtime character name:", runtime.character?.name);

      // Generate a response using the LLM
      logger.info("Composing state...");
      const composedState = await runtime.composeState(message, [
        "RECENT_MESSAGES",
      ]);
      logger.info(
        "Composed state text length:",
        String(composedState.text?.length || 0),
      );

      logger.info("Calling useModel...");
      const responseText = await runtime.useModel(ModelType.TEXT_LARGE, {
        prompt: `${composedState.text}

Respond naturally as Pamela, a prediction market trading agent. If the user is asking about prediction markets, trading, or Polymarket, provide helpful information. For general questions, respond conversationally and offer to help with prediction market topics.

User message: ${message.content.text}

Response:`,
        stopSequences: [],
      });
      logger.info("Generated response text:", responseText);

      const responseContent: Content = {
        text: responseText,
        actions: ["CONVERSATION"],
        source: message.content.source,
      };

      logger.info("Calling callback with response content...");
      await callback(responseContent);
      logger.info("Callback completed successfully");

      return {
        text: "Responded to conversation",
        values: {
          success: true,
          responded: true,
        },
        data: {
          actionName: "CONVERSATION",
          messageId: message.id,
          timestamp: Date.now(),
        },
        success: true,
      };
    } catch (error) {
      logger.error("Error in CONVERSATION action:", error);

      // Fallback response if LLM fails
      const fallbackContent: Content = {
        text: "I'm Pamela, your prediction market trading assistant! I can help you with Polymarket analysis, trading strategies, and market insights. What would you like to know?",
        actions: ["CONVERSATION"],
        source: message.content.source,
      };

      await callback(fallbackContent);

      return {
        text: "Responded with fallback message",
        values: {
          success: false,
          error: "LLM_FAILED",
        },
        data: {
          actionName: "CONVERSATION",
          error: error instanceof Error ? error.message : String(error),
        },
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      {
        name: "{{name1}}",
        content: {
          text: "show me active prediction markets",
        },
      },
      {
        name: "Pamela",
        content: {
          text: "I can help you find active prediction markets! Let me fetch the current markets for you.",
          actions: ["CONVERSATION"],
        },
      },
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "hello",
        },
      },
      {
        name: "Pamela",
        content: {
          text: "Hello! I'm Pamela, your prediction market trading assistant. I can help you analyze markets, find trading opportunities, and execute trades on Polymarket. What can I help you with?",
          actions: ["CONVERSATION"],
        },
      },
    ],
  ],
};

/**
 * Example Hello World Provider
 * This demonstrates the simplest possible provider implementation
 */
const helloWorldProvider: Provider = {
  name: "HELLO_WORLD_PROVIDER",
  description: "A simple example provider",

  get: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
  ): Promise<ProviderResult> => {
    return {
      text: "I am a provider",
      values: {},
      data: {},
    };
  },
};

export class StarterService extends Service {
  static serviceType = "starter";
  capabilityDescription =
    "This is a starter service which is attached to the agent through the starter plugin.";

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  static async start(runtime: IAgentRuntime) {
    logger.info("*** Starting starter service ***");
    const service = new StarterService(runtime);
    return service;
  }

  static async stop(runtime: IAgentRuntime) {
    logger.info("*** Stopping starter service ***");
    // get the service from the runtime
    const service = runtime.getService(StarterService.serviceType);
    if (!service) {
      throw new Error("Starter service not found");
    }
    service.stop();
  }

  async stop() {
    logger.info("*** Stopping starter service instance ***");
  }
}

const plugin: Plugin = {
  name: "starter",
  description: "A starter plugin for Eliza",
  // Higher priority to ensure conversation action runs
  priority: 200,
  config: {},
  async init(_config: Record<string, string>) {
    logger.info("*** Initializing starter plugin ***");
    // No configuration needed for this starter plugin
  },
  // Removed test models to allow proper LLM providers to work
  models: {},
  routes: [
    {
      name: "helloworld",
      path: "/helloworld",
      type: "GET",
      handler: async (_req: any, res: any) => {
        // send a response
        res.json({
          message: "Hello World!",
        });
      },
    },
  ],
  events: {
    // Removed MESSAGE_RECEIVED handler - let bootstrap plugin handle it
    VOICE_MESSAGE_RECEIVED: [
      async (params) => {
        logger.info("VOICE_MESSAGE_RECEIVED event received");
        // print the keys
        logger.info("Keys:", JSON.stringify(Object.keys(params)));
      },
    ],
    WORLD_CONNECTED: [
      async (params) => {
        logger.info("WORLD_CONNECTED event received");
        // print the keys
        logger.info("Keys:", JSON.stringify(Object.keys(params)));
      },
    ],
    WORLD_JOINED: [
      async (params) => {
        logger.info("WORLD_JOINED event received");
        // print the keys
        logger.info("Keys:", JSON.stringify(Object.keys(params)));
      },
    ],
  },
  services: [StarterService],
  actions: [
    conversationAction,
    newsAnalysisAction,
    marketConfidenceAction,
  ],
  providers: [
    helloWorldProvider,
    newsContextProvider,
    marketIntelligenceProvider,
    tradingSignalsProvider,
  ],
};

export default plugin;
