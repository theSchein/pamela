import {
  logger,
  type IAgentRuntime,
  type Project,
  type ProjectAgent,
} from "@elizaos/core";
import bootstrapPlugin from "@elizaos/plugin-bootstrap";
import starterPlugin from "./plugin.ts";
import predictionMarketPlugin from "./prediction-market-plugin.ts";
import { character } from "./character.ts";

// Import ElizaOS plugins for enhanced capabilities
// TODO: Fix plugin version compatibility issues
// import webSearchPlugin from '@elizaos/plugin-web-search';
// import newsPlugin from '@elizaos/plugin-news';
// import twitterPlugin from '@elizaos/plugin-twitter';
// import { browserPlugin } from '@elizaos/plugin-browser';

const initCharacter = ({ runtime }: { runtime: IAgentRuntime }) => {
  logger.info("Initializing character");
  logger.info("Name: ", character.name);
};

export const projectAgent: ProjectAgent = {
  character,
  init: async (runtime: IAgentRuntime) => await initCharacter({ runtime }),
  plugins: [
    // Bootstrap plugin for proper message handling (REQUIRED)
    bootstrapPlugin,

    // Basic conversational capabilities
    starterPlugin,

    // Core prediction market trading
    predictionMarketPlugin,

    // TODO: Re-enable after fixing plugin compatibility issues
    // Web search and news for market research
    // webSearchPlugin,
    // newsPlugin,

    // Social media monitoring for market sentiment
    // twitterPlugin,

    // Web scraping for additional market data
    // browserPlugin,
  ],
};
const project: Project = {
  agents: [projectAgent],
};

// Export test suites for the test runner
export { testSuites } from "./__tests__/e2e";
export { character } from "./character.ts";

export default project;
