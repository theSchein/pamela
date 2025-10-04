import { type Character } from "@elizaos/core";
import { logger } from "@elizaos/core";

/**
 * Character Loader for Monorepo Architecture
 *
 * Loads character configuration based on AGENT_CHARACTER environment variable.
 * Supports multiple agents in a single codebase.
 *
 * Usage:
 *   AGENT_CHARACTER=agent1 npm run dev
 *   AGENT_CHARACTER=agent2 npm run dev
 *
 * Agent configs should be placed in agents/<name>/agent-config.json
 * If AGENT_CHARACTER is not set, falls back to default configuration
 */

/**
 * This function is deprecated - character loading now happens in src/character.ts
 * which loads agent configs from agents/<name>/agent-config.json
 * @param characterName - Name of the character (for backwards compatibility)
 * @returns Character configuration from src/character.ts
 */
async function loadCharacterFile(characterName: string): Promise<Character> {
  logger.info(`Loading character configuration for: ${characterName}`);
  // All character loading now happens through the unified character.ts file
  const characterModule = await import("../character.ts");
  if (!characterModule.character) {
    throw new Error("character.ts must export a 'character' object");
  }
  return characterModule.character;
}

/**
 * Loads the appropriate character based on AGENT_CHARACTER env var
 * @returns Character configuration
 */
export async function loadCharacter(): Promise<Character> {
  const agentCharacter = process.env.AGENT_CHARACTER;

  if (agentCharacter) {
    logger.info(`AGENT_CHARACTER set to: ${agentCharacter}`);
    return await loadCharacterFile(agentCharacter);
  }

  // Fallback to legacy src/character.ts if AGENT_CHARACTER not set
  logger.info("AGENT_CHARACTER not set, loading default character from src/character.ts");
  try {
    const defaultCharacter = await import("../character.ts");
    if (!defaultCharacter.character) {
      throw new Error("Default character.ts must export a 'character' object");
    }
    return defaultCharacter.character;
  } catch (error) {
    logger.error("Failed to load default character:", error);
    throw new Error(
      "Could not load default character. Make sure src/character.ts exists " +
      "or set AGENT_CHARACTER environment variable."
    );
  }
}

/**
 * Validates that a character configuration has required fields
 * @param character - Character to validate
 * @throws Error if character is invalid
 */
export function validateCharacter(character: Character): void {
  const requiredFields = ['id', 'name', 'system'];

  for (const field of requiredFields) {
    if (!(field in character)) {
      throw new Error(`Character is missing required field: ${field}`);
    }
  }

  // Validate UUID format for id
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (character.id && !uuidRegex.test(character.id)) {
    throw new Error(`Character id must be a valid UUID. Got: ${character.id}`);
  }

  logger.info(`Character validation passed for: ${character.name} (${character.id})`);
}
