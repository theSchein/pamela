import { type Character } from "@elizaos/core";
import fs from "fs";
import path from "path";

/**
 * Load agent configuration from JSON file based on AGENT_CHARACTER env var
 */
function loadAgentConfig() {
  const agentName = process.env.AGENT_CHARACTER || "pamela";
  const configPath = path.join(process.cwd(), "agents", agentName, "agent-config.json");
  
  try {
    const configData = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(configData);
    console.log(`Loaded agent configuration for: ${config.name}`);
    return config;
  } catch (error) {
    console.warn(`Failed to load agent config from ${configPath}, using defaults`);
    // Return default Pamela config if file doesn't exist
    return {
      id: "885c8140-1f94-4be4-b553-ab5558b4d800",
      name: "Pamela",
      system: "You are Pamela, an independent trader with your own money on Polymarket.",
      bio: ["Independent prediction market trader with my own bankroll"],
      topics: ["prediction markets and forecasting"],
      adjectives: ["confident", "savvy"],
      style: {
        all: ["Talk like a real trader, not a bot"],
        chat: ["Be flirty but focused on trading"],
        post: ["Share winning trades with excitement"]
      }
    };
  }
}

const agentConfig = loadAgentConfig();

/**
 * Character configuration loaded from agent-specific JSON file
 */
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
  
  settings: {
    secrets: {},
    avatar: "https://elizaos.github.io/eliza-avatars/Eliza/portrait.png",
    autoJoinChannels: true,
  },
  
  system: agentConfig.system,
  
  bio: agentConfig.bio || [],
  
  topics: agentConfig.topics || [],
  
  adjectives: agentConfig.adjectives || [],
  
  style: agentConfig.style || {
    all: [],
    chat: [],
    post: []
  },
  
  messageExamples: agentConfig.messageExamples || []
};