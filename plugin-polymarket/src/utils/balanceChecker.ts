import { type IAgentRuntime, logger } from '@elizaos/core';
import { ethers } from 'ethers';

// USDC contract address on Polygon
const USDC_CONTRACT_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

// ERC20 ABI for balance checking
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
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
 * Check USDC balance on Polygon for a given wallet address
 * @param runtime - Agent runtime for configuration
 * @param requiredAmount - Required amount in USDC (human readable, e.g., "10.5")
 * @returns Balance information including sufficiency check
 */
export async function checkUSDCBalance(
  runtime: IAgentRuntime,
  requiredAmount: string
): Promise<BalanceInfo> {
  logger.info(`[balanceChecker] Checking USDC balance for required amount: ${requiredAmount}`);

  try {
    // Get wallet private key and create wallet instance
    const privateKey =
      runtime.getSetting('WALLET_PRIVATE_KEY') ||
      runtime.getSetting('PRIVATE_KEY') ||
      runtime.getSetting('POLYMARKET_PRIVATE_KEY') ||
      runtime.getSetting('EVM_PRIVATE_KEY');

    if (!privateKey) {
      throw new Error('No private key found for balance checking');
    }

    // Ensure private key has 0x prefix for ethers.js
    const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

    // Create provider for Polygon mainnet
    const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
    const wallet = new ethers.Wallet(formattedPrivateKey, provider);
    const walletAddress = wallet.address;

    logger.info(`[balanceChecker] Checking balance for wallet: ${walletAddress}`);

    // Create USDC contract instance
    const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, ERC20_ABI, provider);

    // Get USDC balance
    const balanceRaw = await usdcContract.balanceOf(walletAddress);
    const decimals = await usdcContract.decimals();
    
    // Convert to human readable format
    const balanceFormatted = ethers.formatUnits(balanceRaw, decimals);
    
    // Check if balance is sufficient
    const requiredAmountBN = ethers.parseUnits(requiredAmount, decimals);
    const hasEnoughBalance = balanceRaw >= requiredAmountBN;

    const balanceInfo: BalanceInfo = {
      address: walletAddress,
      usdcBalance: balanceFormatted,
      usdcBalanceRaw: balanceRaw.toString(),
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
      `Failed to check USDC balance: ${error instanceof Error ? error.message : 'Unknown error'}`
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
export async function getMaxPositionSize(runtime: IAgentRuntime): Promise<number> {
  try {
    // Check current balance
    const balanceInfo = await checkUSDCBalance(runtime, '0');
    const currentBalance = parseFloat(balanceInfo.usdcBalance);

    // Get configured limits
    const maxPositionSize = parseFloat(runtime.getSetting('MAX_POSITION_SIZE') || '100');
    const minConfidenceThreshold = parseFloat(runtime.getSetting('MIN_CONFIDENCE_THRESHOLD') || '0.7');

    // Return the smaller of current balance or configured limit
    // Apply confidence threshold as safety buffer
    const effectiveLimit = Math.min(currentBalance * minConfidenceThreshold, maxPositionSize);

    logger.info(`[balanceChecker] Max position size calculated:`, {
      currentBalance,
      configuredLimit: maxPositionSize,
      confidenceThreshold: minConfidenceThreshold,
      effectiveLimit,
    });

    return effectiveLimit;
  } catch (error) {
    logger.error(`[balanceChecker] Error calculating max position size:`, error);
    // Return conservative default if balance check fails
    return 10;
  }
}