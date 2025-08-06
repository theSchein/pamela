import { type IAgentRuntime, logger } from "@elizaos/core";
import { initializeClobClient } from "./clobClient";

/**
 * Interface for API credentials
 */
export interface ApiCredentials {
  apiKey: string;
  secret: string;
  passphrase: string;
}

/**
 * Create API credentials for L2 authentication
 * This allows posting orders and other authenticated operations
 * @param runtime - Agent runtime for configuration
 * @returns API credentials including key, secret, and passphrase
 */
export async function createApiCredentials(
  runtime: IAgentRuntime,
): Promise<ApiCredentials> {
  logger.info(
    "[apiCredentials] Creating new API credentials for L2 authentication",
  );

  try {
    // Initialize CLOB client (this uses L1 authentication with private key)
    const client = await initializeClobClient(runtime);

    // Create API credentials using the client
    // This will make a POST request to /auth/api-key with wallet signature
    const credentialsResponse = await client.createApiKey();

    logger.info("[apiCredentials] API credentials created successfully");

    const credentials: ApiCredentials = {
      apiKey: credentialsResponse.key,
      secret: credentialsResponse.secret,
      passphrase: credentialsResponse.passphrase,
    };

    // Log success (without revealing secrets)
    logger.info("[apiCredentials] New credentials ready:", {
      apiKey: credentials.apiKey,
      hasSecret: !!credentials.secret,
      hasPassphrase: !!credentials.passphrase,
    });

    return credentials;
  } catch (error) {
    logger.error("[apiCredentials] Failed to create API credentials:", error);
    throw new Error(
      `Failed to create API credentials: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Check if API credentials are configured in environment
 * @param runtime - Agent runtime for configuration
 * @returns True if all required credentials are present
 */
export function hasApiCredentials(runtime: IAgentRuntime): boolean {
  const apiKey = runtime.getSetting("CLOB_API_KEY");
  const apiSecret =
    runtime.getSetting("CLOB_API_SECRET") || runtime.getSetting("CLOB_SECRET");
  const apiPassphrase =
    runtime.getSetting("CLOB_API_PASSPHRASE") ||
    runtime.getSetting("CLOB_PASS_PHRASE");

  const hasAll = !!(apiKey && apiSecret && apiPassphrase);

  logger.info("[apiCredentials] Credential check:", {
    hasApiKey: !!apiKey,
    hasSecret: !!apiSecret,
    hasPassphrase: !!apiPassphrase,
    hasAll,
  });

  return hasAll;
}

/**
 * Get API credentials from environment or create new ones
 * @param runtime - Agent runtime for configuration
 * @returns API credentials ready for use
 */
export async function ensureApiCredentials(
  runtime: IAgentRuntime,
): Promise<ApiCredentials> {
  logger.info("[apiCredentials] Ensuring API credentials are available");

  // Check if credentials already exist in environment
  if (hasApiCredentials(runtime)) {
    logger.info("[apiCredentials] Using existing credentials from environment");

    return {
      apiKey: runtime.getSetting("CLOB_API_KEY")!,
      secret:
        runtime.getSetting("CLOB_API_SECRET") ||
        runtime.getSetting("CLOB_SECRET")!,
      passphrase:
        runtime.getSetting("CLOB_API_PASSPHRASE") ||
        runtime.getSetting("CLOB_PASS_PHRASE")!,
    };
  }

  // Create new credentials if none exist
  logger.info(
    "[apiCredentials] No existing credentials found, creating new ones",
  );
  const credentials = await createApiCredentials(runtime);

  // Note: In a production environment, these should be saved to secure storage
  logger.warn(
    "[apiCredentials] New credentials created but not persisted to environment",
  );
  logger.warn(
    "[apiCredentials] Consider adding these to your .env file for persistence:",
  );
  logger.warn(`CLOB_API_KEY=${credentials.apiKey}`);
  logger.warn(`CLOB_API_SECRET=${credentials.secret}`);
  logger.warn(`CLOB_API_PASSPHRASE=${credentials.passphrase}`);

  return credentials;
}

/**
 * Format API credentials for user display (without revealing secrets)
 * @param credentials - API credentials
 * @returns Formatted string for user display
 */
export function formatApiCredentials(credentials: ApiCredentials): string {
  return `🔐 **API Credentials Ready**

**Credential Details:**
• **API Key**: ${credentials.apiKey}
• **Secret**: ${credentials.secret.slice(0, 8)}...
• **Passphrase**: ${credentials.passphrase.slice(0, 8)}...

**Status**: ✅ **Ready for Trading**
Your API credentials are configured and ready for order placement.

**Important:**
• These credentials are required for placing orders
• Keep them secure and don't share them
• They're tied to your wallet address

*You can now place orders on Polymarket!*`;
}
