import { type IAgentRuntime, logger } from "@elizaos/core";
import { ClobClient } from "@polymarket/clob-client";
import { SignatureType } from "@polymarket/order-utils";
import { ethers } from "ethers";

// Re-export the ClobClient type for other modules
export type { ClobClient } from "@polymarket/clob-client";

// Define the ApiKeyCreds interface to match the official client
export interface ApiKeyCreds {
  key: string;
  secret: string;
  passphrase: string;
}

// Define the BookParams interface for order book queries
export interface BookParams {
  token_id: string;
  side?: "buy" | "sell";
}

/**
 * Initialize CLOB client with wallet-based authentication and optional API credentials
 * @param runtime - The agent runtime containing configuration
 * @returns Configured CLOB client instance
 */
export async function initializeClobClient(
  runtime: IAgentRuntime,
): Promise<ClobClient> {
  const clobApiUrl =
    runtime.getSetting("CLOB_API_URL") || "https://clob.polymarket.com";
  const clobWsUrl =
    runtime.getSetting("CLOB_WS_URL") ||
    "wss://ws-subscriptions-clob.polymarket.com/ws/";

  const privateKey =
    runtime.getSetting("WALLET_PRIVATE_KEY") ||
    runtime.getSetting("PRIVATE_KEY") ||
    runtime.getSetting("POLYMARKET_PRIVATE_KEY");

  if (!privateKey) {
    throw new Error(
      "No private key found. Please set WALLET_PRIVATE_KEY, PRIVATE_KEY, or POLYMARKET_PRIVATE_KEY in your environment",
    );
  }

  // Check for API credentials
  const apiKey = runtime.getSetting("CLOB_API_KEY");
  const apiSecret =
    runtime.getSetting("CLOB_API_SECRET") || runtime.getSetting("CLOB_SECRET");
  const apiPassphrase =
    runtime.getSetting("CLOB_API_PASSPHRASE") ||
    runtime.getSetting("CLOB_PASS_PHRASE");

  const hasApiCreds = !!(apiKey && apiSecret && apiPassphrase);

  logger.info(`[initializeClobClient] Initializing CLOB client:`, {
    httpUrl: clobApiUrl,
    hasApiCredentials: hasApiCreds,
    authType: hasApiCreds ? "L1 + L2 (API creds)" : "L1 only (wallet)",
  });

  try {
    // Ensure private key has 0x prefix for ethers.js
    const formattedPrivateKey = privateKey.startsWith("0x")
      ? privateKey
      : `0x${privateKey}`;

    const wallet = new ethers.Wallet(formattedPrivateKey);
    const enhancedWallet = {
      ...wallet,
      _signTypedData: async (domain: any, types: any, value: any) =>
        wallet.signTypedData(domain, types, value),
      getAddress: async () => wallet.address,
    };

    logger.info(`[initializeClobClient] Wallet address: ${wallet.address}`);
    logger.info(`[initializeClobClient] Chain ID: 137`);

    // Create API credentials object if available
    let creds: ApiKeyCreds | undefined = undefined;
    if (hasApiCreds) {
      creds = {
        key: apiKey!,
        secret: apiSecret!,
        passphrase: apiPassphrase!,
      };
    }

    const client = new ClobClient(
      clobApiUrl,
      137, // Polygon chain ID
      enhancedWallet as any,
      creds, // API credentials (undefined if not available)
      SignatureType.EOA, // Use EOA signature type for regular private key wallets
    );

    logger.info(
      `[initializeClobClient] CLOB client initialized successfully with ${hasApiCreds ? "API credentials and wallet" : "wallet only"}.`,
    );
    return client;
  } catch (error) {
    logger.error(
      `[initializeClobClient] Failed to initialize CLOB client:`,
      error,
    );
    throw new Error(
      `Failed to initialize CLOB client: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Initialize CLOB client with API credentials for L2 authenticated operations
 * @param runtime - The agent runtime containing configuration
 * @returns Configured CLOB client instance with API credentials
 */
export async function initializeClobClientWithCreds(
  runtime: IAgentRuntime,
): Promise<ClobClient> {
  const clobApiUrl =
    runtime.getSetting("CLOB_API_URL") || "https://clob.polymarket.com";
  const clobWsUrl =
    runtime.getSetting("CLOB_WS_URL") ||
    "wss://ws-subscriptions-clob.polymarket.com/ws/";

  const privateKey =
    runtime.getSetting("WALLET_PRIVATE_KEY") ||
    runtime.getSetting("PRIVATE_KEY") ||
    runtime.getSetting("POLYMARKET_PRIVATE_KEY");

  if (!privateKey) {
    throw new Error(
      "No private key found. Please set WALLET_PRIVATE_KEY, PRIVATE_KEY, or POLYMARKET_PRIVATE_KEY in your environment",
    );
  }

  const apiKey = runtime.getSetting("CLOB_API_KEY");
  const apiSecret =
    runtime.getSetting("CLOB_API_SECRET") || runtime.getSetting("CLOB_SECRET");
  const apiPassphrase =
    runtime.getSetting("CLOB_API_PASSPHRASE") ||
    runtime.getSetting("CLOB_PASS_PHRASE");

  logger.info(
    `[initializeClobClientWithCreds] Checking credentials and URLs:`,
    {
      hasApiKey: !!apiKey,
      hasApiSecret: !!apiSecret,
      hasApiPassphrase: !!apiPassphrase,
      httpUrl: clobApiUrl,
      wsUrl: clobWsUrl || "not provided",
      apiKeyPreview: apiKey ? `${apiKey.substring(0, 8)}...` : "missing",
    },
  );

  if (!apiKey || !apiSecret || !apiPassphrase) {
    const missing = [];
    if (!apiKey) missing.push("CLOB_API_KEY");
    if (!apiSecret) missing.push("CLOB_API_SECRET or CLOB_SECRET");
    if (!apiPassphrase) missing.push("CLOB_API_PASSPHRASE or CLOB_PASS_PHRASE");
    throw new Error(
      `Missing required API credentials: ${missing.join(", ")}. Please set these environment variables first.`,
    );
  }

  logger.info(
    `[initializeClobClientWithCreds] Initializing CLOB client with API credentials.`,
  );

  try {
    // Ensure private key has 0x prefix for ethers.js
    const formattedPrivateKey = privateKey.startsWith("0x")
      ? privateKey
      : `0x${privateKey}`;

    const wallet = new ethers.Wallet(formattedPrivateKey);
    const enhancedWallet = {
      ...wallet,
      _signTypedData: async (domain: any, types: any, value: any) =>
        wallet.signTypedData(domain, types, value),
      getAddress: async () => wallet.address,
    };

    const creds: ApiKeyCreds = {
      key: apiKey,
      secret: apiSecret,
      passphrase: apiPassphrase,
    };

    logger.info(
      `[initializeClobClientWithCreds] Wallet address: ${wallet.address}`,
    );
    logger.info(`[initializeClobClientWithCreds] Chain ID: 137`);

    const client = new ClobClient(
      clobApiUrl,
      137, // Polygon chain ID
      enhancedWallet as any,
      creds, // API credentials for L2 authentication
      SignatureType.EOA, // Use EOA signature type for regular private key wallets
    );

    logger.info(
      `[initializeClobClientWithCreds] CLOB client initialized successfully with API credentials.`,
    );
    return client;
  } catch (error) {
    logger.error(
      `[initializeClobClientWithCreds] Failed to initialize CLOB client:`,
      error,
    );
    throw new Error(
      `Failed to initialize CLOB client with credentials: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
