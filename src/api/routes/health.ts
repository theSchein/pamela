import type { Request, Response } from "express";
import type { HealthResponse } from "../types";
import { getWalletManager } from "../../wallet/wallet-manager";
import { character } from "../../character";

/**
 * Health Check Endpoint Handler
 *
 * GET /health
 *
 * Returns agent health status including:
 * - Agent identification
 * - Wallet generation status
 * - Uptime
 * - Connection status
 */
export async function healthHandler(req: Request, res: Response): Promise<void> {
  try {
    const walletManager = getWalletManager();

    // Check if wallet is generated (critical for SPMC)
    const walletGenerated = walletManager.isGenerated();
    const walletAddress = walletManager.getAddress();

    // Check if Telegram is connected (optional)
    const telegramConnected = !!process.env.TELEGRAM_BOT_TOKEN;

    // Build health response
    const health: HealthResponse = {
      status: walletGenerated ? "healthy" : "unhealthy",
      agent_id: character.id,
      agent_name: character.name,
      version: process.env.npm_package_version || "0.1.0",
      uptime_seconds: walletManager.getUptimeSeconds(),
      wallet_generated: walletGenerated,
      wallet_address: walletAddress || undefined,
      telegram_connected: telegramConnected,
      git_tag: process.env.GIT_TAG,
      git_commit: process.env.GIT_COMMIT_SHA,
    };

    // Return 503 if not healthy, 200 if healthy
    const statusCode = health.status === "healthy" ? 200 : 503;

    res.status(statusCode).json(health);
  } catch (error) {
    // Health check failed
    const errorResponse: HealthResponse = {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    };

    res.status(503).json(errorResponse);
  }
}
