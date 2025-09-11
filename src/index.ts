import {
  logger,
  type IAgentRuntime,
  type Project,
  type ProjectAgent,
} from "@elizaos/core";
import bootstrapPlugin from "@elizaos/plugin-bootstrap";
import starterPlugin from "./plugin.ts";
import polymarketPlugin from "@theschein/plugin-polymarket";
import { character } from "./character.ts";
import { getNewsService } from "./services/news";
import { RedemptionService } from "./services/redemption-service";

// Conditionally import Discord plugin if configured
let discordPlugin: any = null;
if (process.env.DISCORD_API_TOKEN) {
  try {
    const discordModule = await import("@elizaos/plugin-discord");
    discordPlugin = discordModule.default;
    logger.info("Discord plugin loaded successfully");
  } catch (error) {
    logger.warn(
      "Failed to load Discord plugin - make sure @elizaos/plugin-discord is installed",
    );
  }
}

// Additional plugins can be imported here as needed
// Note: Web search, news, and social plugins will be integrated in Phase 3-4

const initCharacter = async ({ runtime }: { runtime: IAgentRuntime }) => {
  logger.info("Initializing character");
  logger.info("Name: ", character.name);
  
  // Start news service if configured
  if (runtime.getSetting("NEWS_API_KEY")) {
    try {
      const newsService = getNewsService();
      await newsService.start();
      logger.info("News service started successfully");
    } catch (error) {
      logger.warn("Failed to start news service:", error);
    }
  }
  
  // Start redemption service
  try {
    await RedemptionService.start(runtime);
    logger.info("Redemption service started successfully");
  } catch (error) {
    logger.warn("Failed to start redemption service:", error);
  }
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
    polymarketPlugin,

    // Discord plugin (if configured)
    ...(discordPlugin ? [discordPlugin] : []),

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

// Export character
export { character } from "./character.ts";

export default project;
