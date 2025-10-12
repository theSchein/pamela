#!/usr/bin/env tsx

/**
 * Test script for API server
 *
 * Tests:
 * 1. API server starts successfully
 * 2. /health endpoint responds
 * 3. /wallet endpoint responds
 * 4. Response formats are correct
 */

import { startApiServer } from "../src/api/server.js";
import { initializeWalletManager } from "../src/wallet/wallet-manager.js";

async function testApiServer() {
  console.log("\n🧪 API Server Test Suite\n");
  console.log("=" .repeat(60) + "\n");

  let apiServer;

  try {
    // Initialize wallet manager first
    console.log("=== Initializing Wallet Manager ===\n");
    await initializeWalletManager();
    console.log("✓ Wallet manager initialized\n");

    // Start API server on test port
    console.log("=== Starting API Server ===\n");
    const testPort = 8081; // Use different port to avoid conflicts
    apiServer = await startApiServer(testPort);
    console.log(`✓ API server started on port ${testPort}\n`);

    // Wait a moment for server to be fully ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test /health endpoint
    console.log("=== Testing /health Endpoint ===\n");
    const healthResponse = await fetch(`http://localhost:${testPort}/health`);
    const healthData = await healthResponse.json();

    console.log(`Status: ${healthResponse.status}`);
    console.log(`Response:`, JSON.stringify(healthData, null, 2));

    if (healthResponse.status === 200 && healthData.status === "healthy") {
      console.log("✓ Health endpoint working correctly\n");
    } else {
      console.log("⚠ Health endpoint returned unexpected status\n");
    }

    // Test /wallet endpoint
    console.log("=== Testing /wallet Endpoint ===\n");
    const walletResponse = await fetch(`http://localhost:${testPort}/wallet`);
    const walletData = await walletResponse.json();

    console.log(`Status: ${walletResponse.status}`);
    console.log(`Response:`, JSON.stringify(walletData, null, 2));

    if (walletResponse.status === 200 && walletData.wallet_address) {
      console.log("✓ Wallet endpoint working correctly\n");
      console.log(`  Wallet address: ${walletData.wallet_address}`);
    } else {
      console.log("⚠ Wallet endpoint returned unexpected response\n");
    }

    // Test root endpoint
    console.log("\n=== Testing Root Endpoint ===\n");
    const rootResponse = await fetch(`http://localhost:${testPort}/`, {
      redirect: "manual"
    });
    console.log(`Status: ${rootResponse.status}`);
    if (rootResponse.status === 302 || rootResponse.status === 301) {
      console.log("✓ Root redirects to /health\n");
    }

    // Test 404 handling
    console.log("=== Testing 404 Handler ===\n");
    const notFoundResponse = await fetch(`http://localhost:${testPort}/nonexistent`);
    const notFoundData = await notFoundResponse.json();

    console.log(`Status: ${notFoundResponse.status}`);
    if (notFoundResponse.status === 404) {
      console.log("✓ 404 handler working correctly");
      console.log(`  Available endpoints: ${notFoundData.available_endpoints?.join(", ")}\n`);
    }

    console.log("=" .repeat(60));
    console.log("\n✅ All API server tests completed!\n");

    // Stop server
    console.log("Stopping API server...");
    await apiServer.stop();
    console.log("✓ Server stopped\n");

  } catch (error) {
    console.error("\n❌ Test failed:", error);
    if (apiServer) {
      await apiServer.stop();
    }
    process.exit(1);
  }
}

testApiServer();
