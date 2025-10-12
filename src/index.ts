import {
  logger,
  type IAgentRuntime,
  type Project,
  type ProjectAgent,
  type Character,
} from "@elizaos/core";
// @ts-ignore - Plugin may not have type definitions
import bootstrapPlugin from "@elizaos/plugin-bootstrap";
import starterPlugin from "./plugin.ts";
import polymarketPlugin from "@theschein/plugin-polymarket";
import { getNewsService } from "./services/news";
import { RedemptionService } from "./services/redemption-service";
import { IndexTradingService } from "./services/IndexTradingService";
import { InvestmentFundService } from "./services/InvestmentFundService";

// Import character (loaded and validated in character.ts)
import { character } from "./character.js";

// Import API server and wallet manager for SPMC integration
import { startApiServer } from "./api/server.js";
import { initializeWalletManager } from "./wallet/wallet-manager.js";

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

// Initialize wallet manager and API server before ElizaOS runtime
logger.info("Initializing SPMC integration...");

// Initialize wallet manager (required for /wallet endpoint)
try {
  await initializeWalletManager();
  logger.info("✓ Wallet manager initialized");
} catch (error) {
  logger.error("✗ Failed to initialize wallet manager:", error);
  throw error;
}

// Start API server on port 8080 (required for SPMC)
const apiPort = parseInt(process.env.API_PORT || "8080", 10);
try {
  await startApiServer(apiPort);
  logger.info("✓ API server started successfully");
} catch (error) {
  logger.error("✗ Failed to start API server:", error);
  throw error;
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
  
  // Start index trading service if configured
  if (process.env.INDEX_TRADING_ENABLED === 'true') {
    try {
      const indexService = IndexTradingService.getInstance();
      await indexService.initialize(runtime);
      await indexService.start();
      logger.info("Index trading service started successfully");
    } catch (error) {
      logger.warn("Failed to start index trading service:", error);
    }
  }

  // Start investment fund service if configured
  if (process.env.INVESTMENT_FUND_ENABLED === 'true') {
    try {
      const fundService = InvestmentFundService.fromEnvironment();
      await fundService.initialize(runtime);
      await fundService.start();
      logger.info("Investment fund service started successfully");
    } catch (error) {
      logger.warn("Failed to start investment fund service:", error);
    }
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

// Export the loaded character
export { character };

export default project;
