import { type Character } from "@elizaos/core";
import fs from "fs";
import path from "path";
import { getCharacter, pamela as defaultCharacter } from "../characters/index.js";

/**
 * Load agent character configuration with fallback support
 *
 * Priority order:
 * 1. /app/config.json (SPMC injected config)
 * 2. agents/<name>/agent-config.json (legacy monorepo structure)
 * 3. src/characters/ registry (new character registry)
 * 4. Default character (pamela)
 */
export async function loadCharacter(): Promise<Character> {
  // Priority 1: Check for SPMC injected config at /app/config.json
  const spmcConfigPath = process.env.CONFIG_PATH || "/app/config.json";
  if (fs.existsSync(spmcConfigPath)) {
    try {
      const configData = fs.readFileSync(spmcConfigPath, "utf-8");
      const config = JSON.parse(configData);

      if (config.character) {
        console.log(`✓ Loaded character from SPMC config: ${spmcConfigPath}`);
        return buildCharacterFromConfig(config.character);
      }

      // Config exists but no character definition - try loading by name
      if (config.agent_character) {
        const registryChar = getCharacter(config.agent_character);
        if (registryChar) {
          console.log(`✓ Loaded character '${config.agent_character}' from registry (via SPMC config)`);
          return registryChar;
        }
      }
    } catch (error) {
      console.warn(`Failed to load SPMC config from ${spmcConfigPath}:`, error);
    }
  }

  // Priority 2: Check for agent-specific config (legacy monorepo)
  const agentName = process.env.AGENT_CHARACTER || "pamela";
  const legacyConfigPath = path.join(process.cwd(), "agents", agentName, "agent-config.json");

  if (fs.existsSync(legacyConfigPath)) {
    try {
      const configData = fs.readFileSync(legacyConfigPath, "utf-8");
      const config = JSON.parse(configData);
      console.log(`✓ Loaded character from legacy config: ${legacyConfigPath}`);
      return buildCharacterFromConfig(config);
    } catch (error) {
      console.warn(`Failed to load legacy config from ${legacyConfigPath}:`, error);
    }
  }

  // Priority 3: Load from character registry
  const registryChar = getCharacter(agentName);
  if (registryChar) {
    console.log(`✓ Loaded character '${agentName}' from registry`);
    return registryChar;
  }

  // Priority 4: Default to pamela
  console.log(`⚠ No character found for '${agentName}', using default (pamela)`);
  return defaultCharacter;
}

/**
 * Build a Character object from config JSON
 */
function buildCharacterFromConfig(config: any): Character {
  return {
    id: config.id as `${string}-${string}-${string}-${string}-${string}`,
    name: config.name,
    plugins: [],
    settings: config.settings || {
      secrets: {},
      avatar: "https://elizaos.github.io/eliza-avatars/Eliza/portrait.png",
      autoJoinChannels: true,
    },
    system: config.system,
    bio: config.bio || [],
    topics: config.topics || [],
    adjectives: config.adjectives || [],
    style: config.style || {
      all: [],
      chat: [],
      post: [],
    },
    messageExamples: config.messageExamples || [],
  };
}

/**
 * Validate character configuration
 */
export function validateCharacter(character: Character): void {
  if (!character.id) {
    throw new Error("Character must have an id");
  }
  if (!character.name) {
    throw new Error("Character must have a name");
  }
  if (!character.system) {
    throw new Error("Character must have a system prompt");
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(character.id)) {
    throw new Error(`Invalid character ID format: ${character.id}`);
  }

  console.log(`✓ Character validation passed: ${character.name} (${character.id})`);
}
