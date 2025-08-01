import {
  logger,
  type IAgentRuntime,
  type Project,
  type ProjectAgent,
} from "@elizaos/core";
import bootstrapPlugin from "@elizaos/plugin-bootstrap";
import starterPlugin from "./plugin.ts";
import polymarketPlugin from "../plugin-polymarket/src/plugin.ts";
import { apiPlugin } from "./api/index.ts";
import { character } from "./character.ts";

// Additional plugins can be imported here as needed
// Note: Web search, news, and social plugins will be integrated in Phase 3-4

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

    // API endpoints for frontend communication
    apiPlugin,

    // Basic conversational capabilities
    starterPlugin,

    // Core prediction market trading
    polymarketPlugin,

    // Future plugins will be added here:
    // - Web search for market research
    // - News monitoring for market intelligence
    // - Social media integration
    // - Browser automation for data collection
  ],
};
const project: Project = {
  agents: [projectAgent],
};

// Export test suites for the test runner
export { testSuites } from "./__tests__/e2e";
export { character } from "./character.ts";

export default project;
