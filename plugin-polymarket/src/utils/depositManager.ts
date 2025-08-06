import { type IAgentRuntime, logger } from "@elizaos/core";
import { ethers } from "ethers";
import { getProxyWalletAddress } from "@polymarket/sdk";

// Polymarket proxy wallet factory addresses on Polygon
const PROXY_WALLET_FACTORIES = {
  // For MetaMask users (Gnosis Safe factory)
  GNOSIS_SAFE_FACTORY: "0xaacfeea03eb1561c4e67d661e40682bd20e3541b",
  // For MagicLink users (Polymarket proxy factory)
  POLYMARKET_PROXY_FACTORY: "0xaB45c5A4B0c941a2F231C04C3f49182e1A254052",
};

// USDC contract address on Polygon
const USDC_CONTRACT_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

// ERC20 ABI for USDC transfer
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

/**
 * Interface for deposit information
 */
export interface DepositInfo {
  userAddress: string;
  proxyWalletAddress: string;
  depositAmount: string;
  userBalance: string;
  transactionHash?: string;
  success: boolean;
}

/**
 * Get the user's Polymarket proxy wallet address (deposit address)
 * @param runtime - Agent runtime for configuration
 * @returns The proxy wallet address where USDC should be deposited
 */
export async function getDepositAddress(
  runtime: IAgentRuntime,
): Promise<string> {
  logger.info("[depositManager] Getting Polymarket deposit address");

  try {
    // Get wallet private key and derive EOA address
    const privateKey =
      runtime.getSetting("WALLET_PRIVATE_KEY") ||
      runtime.getSetting("PRIVATE_KEY") ||
      runtime.getSetting("POLYMARKET_PRIVATE_KEY");

    if (!privateKey) {
      throw new Error("No private key found for deposit address calculation");
    }

    const formattedPrivateKey = privateKey.startsWith("0x")
      ? privateKey
      : `0x${privateKey}`;
    const wallet = new ethers.Wallet(formattedPrivateKey);
    const userAddress = wallet.address;

    // For now, we'll use the Gnosis Safe factory (MetaMask users)
    // TODO: Determine which factory to use based on user preference or detection
    const proxyAddress = getProxyWalletAddress(
      PROXY_WALLET_FACTORIES.GNOSIS_SAFE_FACTORY,
      userAddress,
    );

    logger.info(`[depositManager] Calculated proxy wallet address:`, {
      userAddress,
      proxyAddress,
      factory: "GNOSIS_SAFE_FACTORY",
    });

    return proxyAddress;
  } catch (error) {
    logger.error(`[depositManager] Error calculating deposit address:`, error);
    throw new Error(
      `Failed to calculate deposit address: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Deposit USDC to user's Polymarket account
 * @param runtime - Agent runtime for configuration
 * @param amount - Amount of USDC to deposit (human readable, e.g., "10.5")
 * @returns Deposit information including transaction hash
 */
export async function depositUSDC(
  runtime: IAgentRuntime,
  amount: string,
): Promise<DepositInfo> {
  logger.info(`[depositManager] Initiating USDC deposit of $${amount}`);

  try {
    // Get wallet and provider setup
    const privateKey =
      runtime.getSetting("WALLET_PRIVATE_KEY") ||
      runtime.getSetting("PRIVATE_KEY") ||
      runtime.getSetting("POLYMARKET_PRIVATE_KEY");

    if (!privateKey) {
      throw new Error("No private key found for deposit transaction");
    }

    const formattedPrivateKey = privateKey.startsWith("0x")
      ? privateKey
      : `0x${privateKey}`;

    // Create provider with fallbacks
    const rpcProviders = [
      "https://polygon-rpc.com",
      "https://rpc-mainnet.matic.network",
      "https://rpc-mainnet.maticvigil.com",
    ];

    let provider: ethers.JsonRpcProvider | null = null;
    for (const rpcUrl of rpcProviders) {
      try {
        const testProvider = new ethers.JsonRpcProvider(rpcUrl);
        await testProvider.getBlockNumber();
        provider = testProvider;
        logger.info(`[depositManager] Connected to RPC: ${rpcUrl}`);
        break;
      } catch (error) {
        logger.warn(`[depositManager] RPC provider ${rpcUrl} failed`);
        continue;
      }
    }

    if (!provider) {
      throw new Error("All RPC providers failed");
    }

    const wallet = new ethers.Wallet(formattedPrivateKey, provider);
    const userAddress = wallet.address;

    // Get proxy wallet address (deposit destination)
    const proxyWalletAddress = await getDepositAddress(runtime);

    // Create USDC contract instance
    const usdcContract = new ethers.Contract(
      USDC_CONTRACT_ADDRESS,
      ERC20_ABI,
      wallet,
    );

    // Get current USDC balance
    const balanceRaw = await usdcContract.balanceOf(userAddress);
    const decimals = await usdcContract.decimals();
    const currentBalance = ethers.formatUnits(balanceRaw, decimals);

    // Convert deposit amount to wei
    const depositAmountWei = ethers.parseUnits(amount, decimals);

    // Check if user has enough USDC
    if (balanceRaw < depositAmountWei) {
      throw new Error(
        `Insufficient USDC balance. Have: $${currentBalance}, Need: $${amount}`,
      );
    }

    logger.info(`[depositManager] Executing USDC transfer:`, {
      from: userAddress,
      to: proxyWalletAddress,
      amount: `$${amount}`,
      balance: `$${currentBalance}`,
    });

    // Execute the USDC transfer to proxy wallet
    const transferTx = await usdcContract.transfer(
      proxyWalletAddress,
      depositAmountWei,
    );

    logger.info(
      `[depositManager] Transfer transaction submitted: ${transferTx.hash}`,
    );

    // Wait for transaction confirmation
    const receipt = await transferTx.wait();

    if (receipt?.status === 1) {
      logger.info(
        `[depositManager] Deposit successful! Block: ${receipt.blockNumber}`,
      );

      return {
        userAddress,
        proxyWalletAddress,
        depositAmount: amount,
        userBalance: currentBalance,
        transactionHash: transferTx.hash,
        success: true,
      };
    } else {
      throw new Error("Transaction failed");
    }
  } catch (error) {
    logger.error(`[depositManager] Deposit failed:`, error);

    return {
      userAddress: "",
      proxyWalletAddress: "",
      depositAmount: amount,
      userBalance: "0",
      success: false,
    };
  }
}

/**
 * Format deposit information for user display
 * @param depositInfo - Deposit information from depositUSDC
 * @returns Formatted string for user display
 */
export function formatDepositInfo(depositInfo: DepositInfo): string {
  if (depositInfo.success) {
    return `✅ **USDC Deposit Successful**

**Transaction Details:**
• **Amount Deposited**: $${depositInfo.depositAmount}
• **From**: ${depositInfo.userAddress}
• **To**: ${depositInfo.proxyWalletAddress}
• **Transaction**: ${depositInfo.transactionHash}
• **Remaining Wallet Balance**: $${(parseFloat(depositInfo.userBalance) - parseFloat(depositInfo.depositAmount)).toFixed(2)}

🎉 **Funds Available for Trading**
Your USDC has been deposited to your Polymarket account and is now available for trading!

*You can now place orders on prediction markets.*`;
  } else {
    return `❌ **USDC Deposit Failed**

**Attempted Deposit:**
• **Amount**: $${depositInfo.depositAmount}

**Common Issues:**
• Insufficient USDC balance in wallet
• Network connectivity problems
• Transaction rejected or failed

Please check your wallet balance and try again.`;
  }
}
