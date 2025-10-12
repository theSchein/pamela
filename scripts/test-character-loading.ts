#!/usr/bin/env tsx

/**
 * Test script for character loading system
 *
 * Tests:
 * 1. Loading from character registry
 * 2. Loading from legacy agents/ folder
 * 3. Character validation
 * 4. All character names work
 */

import { getCharacter, listCharacters } from "../src/characters/index.js";
import { loadCharacter, validateCharacter } from "../src/utils/character-loader.js";

async function testCharacterRegistry() {
  console.log("=== Testing Character Registry ===\n");

  // List all available characters
  const characterNames = listCharacters();
  console.log(`Available characters: ${characterNames.join(", ")}\n`);

  // Test each character
  for (const name of characterNames) {
    const char = getCharacter(name);
    if (char) {
      console.log(`✓ ${name}: ${char.name} (${char.id})`);
      try {
        validateCharacter(char);
      } catch (error) {
        console.error(`✗ Validation failed for ${name}:`, error);
      }
    } else {
      console.error(`✗ Failed to load character: ${name}`);
    }
  }

  console.log("\n");
}

async function testCharacterLoader() {
  console.log("=== Testing Character Loader ===\n");

  const testCases = [
    { name: "pamela", description: "Default character" },
    { name: "lib-out", description: "Index follower" },
    { name: "libout", description: "Index follower (alias)" },
    { name: "chalk-eater", description: "Market scanner" },
    { name: "nothing-ever-happens", description: "Contrarian" },
    { name: "trumped-up", description: "Political markets" },
  ];

  for (const testCase of testCases) {
    try {
      // Set environment variable
      process.env.AGENT_CHARACTER = testCase.name;

      const char = await loadCharacter();
      validateCharacter(char);

      console.log(`✓ ${testCase.name}: ${char.name} - ${testCase.description}`);
    } catch (error) {
      console.error(`✗ Failed to load ${testCase.name}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log("\n");
}

async function testLegacyConfig() {
  console.log("=== Testing Legacy Config Loading ===\n");

  // Test loading from agents/ folder (if it exists)
  const fs = await import("fs");
  const path = await import("path");

  const agentsDir = path.join(process.cwd(), "agents");
  if (fs.existsSync(agentsDir)) {
    const agents = fs.readdirSync(agentsDir);
    console.log(`Found ${agents.length} agent configs in agents/ folder\n`);

    for (const agentName of agents) {
      const configPath = path.join(agentsDir, agentName, "agent-config.json");
      if (fs.existsSync(configPath)) {
        try {
          process.env.AGENT_CHARACTER = agentName;
          const char = await loadCharacter();
          validateCharacter(char);
          console.log(`✓ Legacy config: ${agentName} -> ${char.name}`);
        } catch (error) {
          console.error(`✗ Failed to load legacy config ${agentName}:`, error instanceof Error ? error.message : error);
        }
      }
    }
  } else {
    console.log("No agents/ folder found - skipping legacy config test");
  }

  console.log("\n");
}

async function testSPMCConfig() {
  console.log("=== Testing SPMC Config Loading ===\n");

  const fs = await import("fs");
  const os = await import("os");
  const path = await import("path");

  // Create a temporary SPMC config
  const tmpDir = os.tmpdir();
  const tmpConfig = path.join(tmpDir, "test-spmc-config.json");

  const spmcConfig = {
    agent_character: "pamela",
    agent_id: "885c8140-1f94-4be4-b553-ab5558b4d800",
    group_id: "test-group-id",
    spmc_api_url: "https://api.spmc.dev",
    character: {
      id: "885c8140-1f94-4be4-b553-ab5558b4d800",
      name: "Test Pamela",
      system: "Test system prompt",
      bio: ["Test bio"],
      topics: ["test topics"],
      adjectives: ["test"],
      style: {
        all: ["test"],
        chat: ["test"],
        post: ["test"],
      },
    },
  };

  try {
    // Write test config
    fs.writeFileSync(tmpConfig, JSON.stringify(spmcConfig, null, 2));
    console.log(`Created test config: ${tmpConfig}`);

    // Set CONFIG_PATH to test location
    process.env.CONFIG_PATH = tmpConfig;

    const char = await loadCharacter();
    validateCharacter(char);

    if (char.name === "Test Pamela") {
      console.log("✓ SPMC config loaded successfully");
      console.log(`  Name: ${char.name}`);
      console.log(`  System: ${char.system}`);
    } else {
      console.error("✗ SPMC config did not load correctly");
    }

    // Clean up
    fs.unlinkSync(tmpConfig);
    delete process.env.CONFIG_PATH;
  } catch (error) {
    console.error("✗ SPMC config test failed:", error instanceof Error ? error.message : error);
  }

  console.log("\n");
}

async function main() {
  console.log("\n🧪 Character Loading System Test Suite\n");
  console.log("=" .repeat(60) + "\n");

  try {
    await testCharacterRegistry();
    await testCharacterLoader();
    await testLegacyConfig();
    await testSPMCConfig();

    console.log("=" .repeat(60));
    console.log("\n✅ All tests completed!\n");
  } catch (error) {
    console.error("\n❌ Test suite failed:", error);
    process.exit(1);
  }
}

main();
