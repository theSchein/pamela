import { Wallet } from "ethers";
import { randomBytes } from "crypto";
import { logger } from "@elizaos/core";

/**
 * Wallet Manager
 *
 * Manages wallet generation, loading, and address exposure for SPMC integration.
 * Generates wallet on startup if POLYMARKET_PRIVATE_KEY is not provided.
 *
 * Security: Private keys are NEVER exposed via API - only public addresses.
 */
export class WalletManager {
  private wallet: Wallet | null = null;
  private generatedAt: Date | null = null;
  private startTime: Date = new Date();

  /**
   * Initialize wallet manager
   *
   * Loads wallet from POLYMARKET_PRIVATE_KEY env var or generates a new one.
   * Must complete within 60 seconds for SPMC deployment.
   */
  async initialize(): Promise<void> {
    const startInitTime = Date.now();

    try {
      const privateKey = process.env.POLYMARKET_PRIVATE_KEY;

      if (privateKey) {
        // Load existing wallet
        this.wallet = new Wallet(privateKey);
        this.generatedAt = new Date();
        logger.info(`✓ Loaded wallet from POLYMARKET_PRIVATE_KEY: ${this.wallet.address}`);
      } else {
        // Generate new wallet
        logger.warn("⚠ No POLYMARKET_PRIVATE_KEY found - generating new wallet");
        const randomKey = randomBytes(32);
        this.wallet = new Wallet("0x" + randomKey.toString("hex"));
        this.generatedAt = new Date();

        logger.info(`✓ Generated new wallet: ${this.wallet.address}`);
        logger.warn("⚠ IMPORTANT: Save this wallet address for fund whitelisting");
        logger.warn("⚠ Private key is NOT exposed via API for security");
      }

      const initTime = Date.now() - startInitTime;
      logger.info(`✓ Wallet initialization completed in ${initTime}ms`);
    } catch (error) {
      logger.error("✗ Wallet initialization failed:", error);
      throw new Error(`Wallet initialization failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Get wallet address (public)
   *
   * Safe to expose via API endpoint
   */
  getAddress(): string | null {
    return this.wallet?.address ?? null;
  }

  /**
   * Get wallet instance (internal use only)
   *
   * WARNING: Contains private key - use carefully
   */
  getWallet(): Wallet | null {
    return this.wallet;
  }

  /**
   * Check if wallet has been generated
   */
  isGenerated(): boolean {
    return this.wallet !== null;
  }

  /**
   * Get wallet generation timestamp
   */
  getGeneratedAt(): Date | null {
    return this.generatedAt;
  }

  /**
   * Get uptime in seconds since initialization
   */
  getUptimeSeconds(): number {
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  /**
   * Get wallet balance (placeholder - implement with actual provider)
   *
   * @returns Balance information
   */
  async getBalance(): Promise<{ matic: string; usdc: string }> {
    // TODO: Implement actual balance checking with Polygon provider
    // For now, return placeholder values
    return {
      matic: "0.0",
      usdc: "0.0",
    };
  }
}

// Singleton instance
let walletManagerInstance: WalletManager | null = null;

/**
 * Get or create wallet manager singleton
 */
export function getWalletManager(): WalletManager {
  if (!walletManagerInstance) {
    walletManagerInstance = new WalletManager();
  }
  return walletManagerInstance;
}

/**
 * Initialize wallet manager singleton
 */
export async function initializeWalletManager(): Promise<WalletManager> {
  const manager = getWalletManager();
  await manager.initialize();
  return manager;
}
