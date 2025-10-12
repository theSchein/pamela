import type { Request, Response } from "express";
import type { WalletResponse, WalletErrorResponse } from "../types";
import { getWalletManager } from "../../wallet/wallet-manager";

/**
 * Wallet Address Endpoint Handler
 *
 * GET /wallet
 *
 * Returns wallet address after generation.
 * SPMC calls this endpoint repeatedly (up to 60s) until wallet is ready.
 *
 * Returns:
 * - 200: Wallet address available
 * - 404: Wallet not yet generated
 */
export async function walletHandler(req: Request, res: Response): Promise<void> {
  try {
    const walletManager = getWalletManager();

    const address = walletManager.getAddress();
    const generatedAt = walletManager.getGeneratedAt();

    if (!address || !generatedAt) {
      // Wallet not yet generated
      const errorResponse: WalletErrorResponse = {
        error: "Wallet not yet generated",
        status: "initializing",
      };

      res.status(404).json(errorResponse);
      return;
    }

    // Get balance (optional - may not be implemented yet)
    let balance;
    try {
      balance = await walletManager.getBalance();
    } catch (error) {
      // Balance fetching not critical - continue without it
      balance = undefined;
    }

    // Return wallet information
    const response: WalletResponse = {
      wallet_address: address,
      generated_at: generatedAt.toISOString(),
      balance,
    };

    res.status(200).json(response);
  } catch (error) {
    // Wallet retrieval failed
    const errorResponse: WalletErrorResponse = {
      error: error instanceof Error ? error.message : "Unknown error",
      status: "error",
    };

    res.status(500).json(errorResponse);
  }
}
