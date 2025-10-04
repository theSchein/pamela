import { type Character } from "@elizaos/core";
import * as fs from "fs";
import * as path from "path";

/**
 * Generic character template that loads agent-specific configuration
 * from the agent's directory based on AGENT_CHARACTER environment variable
 */

// Load agent-specific configuration
const loadAgentConfig = () => {
  const agentName = process.env.AGENT_CHARACTER || 'pamela';
  const agentDir = path.resolve(__dirname, `../agents/${agentName}`);
  const configPath = path.join(agentDir, 'agent-config.json');
  
  try {
    // Try to load from agent-specific config
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configData);
      console.log(`Loaded agent configuration for: ${agentName}`);
      return config;
    } else {
      console.warn(`No agent config found at ${configPath}, using defaults`);
    }
  } catch (error) {
    console.error(`Error loading agent config:`, error);
  }
  
  // Return default configuration
  return {
    id: process.env.AGENT_ID || "00000000-0000-0000-0000-000000000000",
    name: process.env.AGENT_NAME || "Trading Agent",
    bio: ["Autonomous trading agent on Polymarket"],
    topics: ["prediction markets", "trading"],
    adjectives: ["analytical", "precise"],
    system: "You are a trading agent. Follow your configured strategy.",
    messageExamples: [],
    style: {
      all: ["be concise", "be professional"],
      chat: ["respond directly"],
      post: ["share updates"]
    }
  };
};

const agentConfig = loadAgentConfig();

export const character: Character = {
  id: agentConfig.id as `${string}-${string}-${string}-${string}-${string}`,
  name: agentConfig.name,
  
  plugins: [
    "@elizaos/plugin-sql",
    
    // LLM plugins based on available credentials
    ...(process.env.ANTHROPIC_API_KEY?.trim()
      ? ["@elizaos/plugin-anthropic"]
      : []),
    ...(process.env.OPENAI_API_KEY?.trim() 
      ? ["@elizaos/plugin-openai"] 
      : []),
    ...(process.env.OLLAMA_API_ENDPOINT?.trim()
      ? ["@elizaos/plugin-ollama"]
      : []),
    
    // Platform plugins
    ...(process.env.TELEGRAM_BOT_TOKEN?.trim()
      ? ["@elizaos/plugin-telegram"]
      : []),
    ...(process.env.DISCORD_API_TOKEN?.trim()
      ? ["@elizaos/plugin-discord"]
      : []),
    ...(process.env.TWITTER_API_KEY?.trim() &&
    process.env.TWITTER_API_SECRET_KEY?.trim() &&
    process.env.TWITTER_ACCESS_TOKEN?.trim() &&
    process.env.TWITTER_ACCESS_TOKEN_SECRET?.trim()
      ? ["@elizaos/plugin-twitter"]
      : []),
    
    // Trading plugin
    "@theschein/plugin-polymarket",
    
    // Bootstrap plugin
    ...(!process.env.IGNORE_BOOTSTRAP ? ["@elizaos/plugin-bootstrap"] : []),
  ],
  
  settings: agentConfig.settings || {
    secrets: {},
    avatar: "https://elizaos.github.io/eliza-avatars/Eliza/portrait.png",
    autoJoinChannels: true,
  },
  
  system: agentConfig.system,
  bio: agentConfig.bio,
  topics: agentConfig.topics,
  adjectives: agentConfig.adjectives,
  messageExamples: agentConfig.messageExamples || [],
  style: agentConfig.style
};