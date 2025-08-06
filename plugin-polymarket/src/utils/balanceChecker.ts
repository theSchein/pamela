import { type IAgentRuntime, logger } from "@elizaos/core";
import { ethers } from "ethers";
import { initializeClobClient } from "./clobClient";

// USDC contract addresses on Polygon - check both for compatibility
const USDC_NATIVE_ADDRESS = "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359"; // Native USDC (2024 standard)
const USDC_BRIDGED_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // USDC.e (bridged, being phased out)

// Polymarket supports both, but native USDC is preferred

// ERC20 ABI for balance checking
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

/**
 * Interface for balance information
 */
export interface BalanceInfo {
  address: string;
  usdcBalance: string; // Human readable balance (e.g., "100.50")
  usdcBalanceRaw: string; // Raw balance in wei
  hasEnoughBalance: boolean;
  requiredAmount: string;
}

/**
 * Check Polymarket trading balance using CLOB client
 * This checks the actual USDC available for trading (proxy wallet balance)
 * @param runtime - Agent runtime for configuration
 * @param requiredAmount - Required amount in USDC (human readable, e.g., "10.5")
 * @returns Balance information including sufficiency check
 */
export async function checkPolymarketBalance(
  runtime: IAgentRuntime,
  requiredAmount: string,
): Promise<BalanceInfo> {
  logger.info(
    `[balanceChecker] Checking Polymarket trading balance for required amount: ${requiredAmount}`,
  );

  try {
    // Initialize CLOB client
    const client = await initializeClobClient(runtime);

    // Get USDC balance from Polymarket L2 (collateral balance)
    // This checks the actual trading balance deposited to Polymarket
    const balanceResponse = await client.getBalanceAllowance({
      asset_type: "COLLATERAL" as any, // USDC is the collateral asset
    });

    const usdcBalanceRaw = balanceResponse.balance || "0";
    // Convert from microunits (6 decimals) to USDC decimal format
    const usdcBalance = ethers.formatUnits(usdcBalanceRaw, 6);
    logger.info(
      `[balanceChecker] Found Polymarket L2 USDC balance: ${usdcBalance} USDC (raw: ${usdcBalanceRaw})`,
    );

    // Check if balance is sufficient
    const requiredAmountNum = parseFloat(requiredAmount);
    const balanceNum = parseFloat(usdcBalance);
    const hasEnoughBalance = balanceNum >= requiredAmountNum;

    // Get wallet address for display
    const privateKey =
      runtime.getSetting("WALLET_PRIVATE_KEY") ||
      runtime.getSetting("PRIVATE_KEY") ||
      runtime.getSetting("POLYMARKET_PRIVATE_KEY");

    if (!privateKey) {
      throw new Error("No private key found for address resolution");
    }

    const formattedPrivateKey = privateKey.startsWith("0x")
      ? privateKey
      : `0x${privateKey}`;
    const wallet = new ethers.Wallet(formattedPrivateKey);

    const balanceInfo: BalanceInfo = {
      address: wallet.address,
      usdcBalance: usdcBalance,
      usdcBalanceRaw: usdcBalanceRaw,
      hasEnoughBalance,
      requiredAmount,
    };

    logger.info(`[balanceChecker] Polymarket balance check complete:`, {
      address: wallet.address,
      balance: usdcBalance,
      required: requiredAmount,
      sufficient: hasEnoughBalance,
    });

    return balanceInfo;
  } catch (error) {
    logger.error(`[balanceChecker] Error checking Polymarket balance:`, error);

    // Fallback to wallet balance checking if CLOB balance fails
    logger.warn(`[balanceChecker] Falling back to wallet balance check`);
    return await checkUSDCBalance(runtime, requiredAmount);
  }
}

/**
 * Check USDC balance on Polygon for a given wallet address
 * @param runtime - Agent runtime for configuration
 * @param requiredAmount - Required amount in USDC (human readable, e.g., "10.5")
 * @returns Balance information including sufficiency check
 */
export async function checkUSDCBalance(
  runtime: IAgentRuntime,
  requiredAmount: string,
): Promise<BalanceInfo> {
  logger.info(
    `[balanceChecker] Checking USDC balance for required amount: ${requiredAmount}`,
  );

  try {
    // Get wallet private key and create wallet instance
    const privateKey =
      runtime.getSetting("WALLET_PRIVATE_KEY") ||
      runtime.getSetting("PRIVATE_KEY") ||
      runtime.getSetting("POLYMARKET_PRIVATE_KEY") ||
      runtime.getSetting("EVM_PRIVATE_KEY");

    if (!privateKey) {
      throw new Error("No private key found for balance checking");
    }

    // Ensure private key has 0x prefix for ethers.js
    const formattedPrivateKey = privateKey.startsWith("0x")
      ? privateKey
      : `0x${privateKey}`;

    // Create provider for Polygon mainnet with fallbacks
    const rpcProviders = [
      "https://polygon-rpc.com",
      "https://rpc-mainnet.matic.network",
      "https://rpc-mainnet.maticvigil.com",
      "https://matic-mainnet.chainstacklabs.com",
    ];

    let provider: ethers.JsonRpcProvider | null = null;
    let lastError: Error | null = null;

    // Try each RPC provider until one works
    for (const rpcUrl of rpcProviders) {
      try {
        const testProvider = new ethers.JsonRpcProvider(rpcUrl);
        // Test the connection
        await testProvider.getBlockNumber();
        provider = testProvider;
        logger.info(
          `[balanceChecker] Successfully connected to RPC: ${rpcUrl}`,
        );
        break;
      } catch (error) {
        logger.warn(`[balanceChecker] RPC provider ${rpcUrl} failed:`, error);
        lastError =
          error instanceof Error ? error : new Error("Unknown RPC error");
        continue;
      }
    }

    if (!provider) {
      throw new Error(
        `All RPC providers failed. Last error: ${lastError?.message}`,
      );
    }
    const wallet = new ethers.Wallet(formattedPrivateKey, provider);
    const walletAddress = wallet.address;

    logger.info(
      `[balanceChecker] Checking balance for wallet: ${walletAddress}`,
    );

    // Check both USDC contracts (native + bridged) and sum balances
    const usdcNativeContract = new ethers.Contract(
      USDC_NATIVE_ADDRESS,
      ERC20_ABI,
      provider,
    );
    const usdcBridgedContract = new ethers.Contract(
      USDC_BRIDGED_ADDRESS,
      ERC20_ABI,
      provider,
    );

    // Get USDC balance from both contracts with retry logic
    let totalBalanceRaw: bigint = 0n;
    let decimals: number = 6; // USDC always has 6 decimals
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(
          `[balanceChecker] Balance check attempt ${attempt}/${maxRetries}`,
        );

        // Check native USDC balance
        const nativeBalance = await usdcNativeContract.balanceOf(walletAddress);
        logger.info(
          `[balanceChecker] Native USDC balance: ${ethers.formatUnits(nativeBalance, 6)}`,
        );

        // Check bridged USDC.e balance
        const bridgedBalance =
          await usdcBridgedContract.balanceOf(walletAddress);
        logger.info(
          `[balanceChecker] Bridged USDC.e balance: ${ethers.formatUnits(bridgedBalance, 6)}`,
        );

        // Sum both balances
        totalBalanceRaw = nativeBalance + bridgedBalance;

        break;
      } catch (error) {
        logger.warn(`[balanceChecker] Attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) {
          throw new Error(
            `Balance check failed after ${maxRetries} attempts: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
        // Wait before retrying (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }

    if (totalBalanceRaw === undefined || decimals === undefined) {
      throw new Error("Failed to retrieve balance information");
    }

    // Convert to human readable format
    const balanceFormatted = ethers.formatUnits(totalBalanceRaw, decimals);

    // Check if balance is sufficient
    const requiredAmountBN = ethers.parseUnits(requiredAmount, decimals);
    const hasEnoughBalance = totalBalanceRaw >= requiredAmountBN;

    const balanceInfo: BalanceInfo = {
      address: walletAddress,
      usdcBalance: balanceFormatted,
      usdcBalanceRaw: totalBalanceRaw.toString(),
      hasEnoughBalance,
      requiredAmount,
    };

    logger.info(`[balanceChecker] Balance check complete:`, {
      address: walletAddress,
      balance: balanceFormatted,
      required: requiredAmount,
      sufficient: hasEnoughBalance,
    });

    return balanceInfo;
  } catch (error) {
    logger.error(`[balanceChecker] Error checking USDC balance:`, error);
    throw new Error(
      `Failed to check USDC balance: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Format balance information for user display
 * @param balanceInfo - Balance information from checkUSDCBalance
 * @returns Formatted string for user display
 */
export function formatBalanceInfo(balanceInfo: BalanceInfo): string {
  const balanceDisplay = parseFloat(balanceInfo.usdcBalance).toFixed(2);
  const requiredDisplay = parseFloat(balanceInfo.requiredAmount).toFixed(2);

  if (balanceInfo.hasEnoughBalance) {
    return `✅ **Balance Check Passed**
• **Wallet**: ${balanceInfo.address}
• **USDC Balance**: $${balanceDisplay}
• **Required**: $${requiredDisplay}
• **Available**: $${(parseFloat(balanceInfo.usdcBalance) - parseFloat(balanceInfo.requiredAmount)).toFixed(2)}`;
  } else {
    return `❌ **Insufficient Balance**
• **Wallet**: ${balanceInfo.address}
• **USDC Balance**: $${balanceDisplay}
• **Required**: $${requiredDisplay}
• **Shortfall**: $${(parseFloat(balanceInfo.requiredAmount) - parseFloat(balanceInfo.usdcBalance)).toFixed(2)}

Please add more USDC to your wallet before placing this order.`;
  }
}

/**
 * Get maximum position size based on current balance and configured limits
 * @param runtime - Agent runtime for configuration
 * @returns Maximum allowed position size in USDC
 */
export async function getMaxPositionSize(
  runtime: IAgentRuntime,
): Promise<number> {
  try {
    // Check current balance
    const balanceInfo = await checkUSDCBalance(runtime, "0");
    const currentBalance = parseFloat(balanceInfo.usdcBalance);

    // Get configured limits
    const maxPositionSize = parseFloat(
      runtime.getSetting("MAX_POSITION_SIZE") || "100",
    );
    const minConfidenceThreshold = parseFloat(
      runtime.getSetting("MIN_CONFIDENCE_THRESHOLD") || "0.7",
    );

    // Return the smaller of current balance or configured limit
    // Apply confidence threshold as safety buffer
    const effectiveLimit = Math.min(
      currentBalance * minConfidenceThreshold,
      maxPositionSize,
    );

    logger.info(`[balanceChecker] Max position size calculated:`, {
      currentBalance,
      configuredLimit: maxPositionSize,
      confidenceThreshold: minConfidenceThreshold,
      effectiveLimit,
    });

    return effectiveLimit;
  } catch (error) {
    logger.error(
      `[balanceChecker] Error calculating max position size:`,
      error,
    );
    // Return conservative default if balance check fails
    return 10;
  }
}
