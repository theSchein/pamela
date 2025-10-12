import { type Character } from "@elizaos/core";
import { pamela } from "./pamela";
import { libOut } from "./lib-out";
import { chalkEater } from "./chalk-eater";
import { nothingEverHappens } from "./nothing-ever-happens";
import { trumpedUp } from "./trumped-up";

/**
 * Character Registry
 *
 * Centralized registry of all available agent characters.
 * Characters can be loaded by name using the getCharacter() function.
 */

export const characters: Record<string, Character> = {
  pamela,
  "lib-out": libOut,
  libout: libOut, // Alias without hyphen
  "chalk-eater": chalkEater,
  chalkeater: chalkEater, // Alias without hyphen
  "nothing-ever-happens": nothingEverHappens,
  nothingeverhappens: nothingEverHappens, // Alias without hyphens
  "trumped-up": trumpedUp,
  trumpedup: trumpedUp, // Alias without hyphen
};

/**
 * Get character by name
 *
 * @param name - Character name (case-insensitive)
 * @returns Character object or null if not found
 */
export function getCharacter(name: string): Character | null {
  const normalizedName = name.toLowerCase().trim();
  return characters[normalizedName] || null;
}

/**
 * Get character by ID
 *
 * @param id - Character UUID
 * @returns Character object or null if not found
 */
export function getCharacterById(id: string): Character | null {
  return Object.values(characters).find((char) => char.id === id) || null;
}

/**
 * List all available character names
 *
 * @returns Array of character names
 */
export function listCharacters(): string[] {
  return Object.keys(characters).filter((name) => !name.includes(" ")); // Filter out aliases with spaces
}

/**
 * Check if a character exists
 *
 * @param name - Character name (case-insensitive)
 * @returns true if character exists
 */
export function hasCharacter(name: string): boolean {
  return getCharacter(name) !== null;
}

// Export individual characters for direct import
export { pamela, libOut, chalkEater, nothingEverHappens, trumpedUp };

// Default export is the registry
export default characters;
