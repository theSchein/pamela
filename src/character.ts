import { type Character } from "@elizaos/core";
import { loadCharacter, validateCharacter } from "./utils/character-loader.js";

/**
 * Load character using new character loader with fallback support
 *
 * Priority order:
 * 1. /app/config.json (SPMC injected config)
 * 2. agents/<name>/agent-config.json (legacy monorepo)
 * 3. src/characters/ registry (new character registry)
 * 4. Default character (pamela)
 */
const baseCharacter = await loadCharacter();

/**
 * Character configuration with dynamic plugin loading
 *
 * Plugins are loaded based on available environment variables
 */
export const character: Character = {
  ...baseCharacter,

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
};

// Validate character configuration
validateCharacter(character);