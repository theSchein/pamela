import {
  type Action,
  type ActionResult,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
} from "@elizaos/core";
import { ethers } from "ethers";
import {
  contentToActionResult,
  createErrorResult,
} from "../utils/actionHelpers";
import { initializeClobClient } from "../utils/clobClient";

// Contract addresses on Polygon (Chain ID: 137)
const USDC_NATIVE_ADDRESS = "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359"; // Native USDC (preferred)
const USDC_BRIDGED_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // USDC.e (bridged)
const CTF_ADDRESS = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045"; // Conditional Tokens Framework
const EXCHANGE_ADDRESS = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E"; // CTF Exchange
const NEG_RISK_EXCHANGE_ADDRESS = "0xC5d563A36AE78145C45a50134d48A1215220f80a"; // Neg Risk Exchange

// ERC20 ABI for approve function
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

// CTF ABI for setApprovalForAll function
const CTF_ABI = [
  "function setApprovalForAll(address operator, bool approved)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
];

interface TradingSetupStatus {
  approvalsSet: boolean;
  credentialsReady: boolean;
  balanceAvailable: boolean;
  readyToTrade: boolean;
}

/**
 * Streamlined trading setup action
 * Handles approvals, credentials, and validation in one go
 */
export const setupTradingAction: Action = {
  name: "SETUP_TRADING",
  similes: [
    "SETUP_TRADING",
    "PREPARE_TRADING",
    "ENABLE_TRADING",
    "TRADING_SETUP",
    "INIT_TRADING",
    "CONFIGURE_TRADING",
    "READY_TO_TRADE",
    "SETUP_POLYMARKET",
    "PREPARE_WALLET",
    "TRADING_INIT",
  ],
  description: "Complete trading setup: approvals, credentials, and validation",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    logger.info(
      `[setupTradingAction] Validate called for message: "${message.content?.text}"`,
    );

    const privateKey =
      runtime.getSetting("WALLET_PRIVATE_KEY") ||
      runtime.getSetting("POLYMARKET_PRIVATE_KEY") ||
      runtime.getSetting("PRIVATE_KEY");

    if (!privateKey) {
      logger.warn("[setupTradingAction] No private key found");
      return false;
    }

    logger.info("[setupTradingAction] Validation passed");
    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    logger.info("[setupTradingAction] Handler called!");

    try {
      // Get wallet configuration
      const privateKey =
        runtime.getSetting("WALLET_PRIVATE_KEY") ||
        runtime.getSetting("POLYMARKET_PRIVATE_KEY") ||
        runtime.getSetting("PRIVATE_KEY");

      if (!privateKey) {
        return createErrorResult("Private key is required for trading setup");
      }

      // Setup provider and wallet
      const rpcUrl =
        runtime.getSetting("POLYGON_RPC_URL") || "https://polygon-rpc.com";
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const formattedPrivateKey = privateKey.startsWith("0x")
        ? privateKey
        : `0x${privateKey}`;
      const wallet = new ethers.Wallet(formattedPrivateKey, provider);

      if (callback) {
        const startContent: Content = {
          text: `🚀 **Complete Trading Setup**

**Wallet Address**: ${wallet.address}
**Network**: Polygon (Chain ID: 137)

**Setup Steps:**
1. ✅ Check current approvals
2. 🔧 Set missing approvals
3. 🔑 Derive API credentials
4. 💰 Verify balance
5. ✅ Final validation

Starting setup...`,
          actions: ["SETUP_TRADING"],
          data: { walletAddress: wallet.address, step: "starting" },
        };
        await callback(startContent);
      }

      // Step 1: Check current approvals quickly
      const setupStatus: TradingSetupStatus = {
        approvalsSet: false,
        credentialsReady: false,
        balanceAvailable: false,
        readyToTrade: false,
      };

      // Contract instances
      const usdcNativeContract = new ethers.Contract(
        USDC_NATIVE_ADDRESS,
        ERC20_ABI,
        wallet,
      );
      const usdcBridgedContract = new ethers.Contract(
        USDC_BRIDGED_ADDRESS,
        ERC20_ABI,
        wallet,
      );
      const ctfContract = new ethers.Contract(CTF_ADDRESS, CTF_ABI, wallet);

      // Check balances to determine which USDC to use
      const [nativeBalance, bridgedBalance] = await Promise.all([
        usdcNativeContract.balanceOf(wallet.address),
        usdcBridgedContract.balanceOf(wallet.address),
      ]);

      const useNativeUSDC = nativeBalance > bridgedBalance;
      const usdcContract = useNativeUSDC
        ? usdcNativeContract
        : usdcBridgedContract;
      const usdcType = useNativeUSDC ? "Native USDC" : "USDC.e (Bridged)";
      const totalBalance = parseFloat(
        ethers.formatUnits(useNativeUSDC ? nativeBalance : bridgedBalance, 6),
      );

      // Quick approval check
      const [
        usdcForCTF,
        usdcForExchange,
        usdcForNegRisk,
        ctfForExchange,
        ctfForNegRisk,
      ] = await Promise.all([
        usdcContract.allowance(wallet.address, CTF_ADDRESS),
        usdcContract.allowance(wallet.address, EXCHANGE_ADDRESS),
        usdcContract.allowance(wallet.address, NEG_RISK_EXCHANGE_ADDRESS),
        ctfContract.isApprovedForAll(wallet.address, EXCHANGE_ADDRESS),
        ctfContract.isApprovedForAll(wallet.address, NEG_RISK_EXCHANGE_ADDRESS),
      ]);

      const approvalsNeeded = [
        usdcForCTF == 0,
        usdcForExchange == 0,
        usdcForNegRisk == 0,
        !ctfForExchange,
        !ctfForNegRisk,
      ];
      const needsApprovals = approvalsNeeded.some((needed) => needed);

      if (callback) {
        const statusContent: Content = {
          text: `📊 **Current Status Check**

**USDC Balance**: ${totalBalance.toFixed(2)} ${usdcType}
**Approvals Needed**: ${needsApprovals ? approvalsNeeded.filter((n) => n).length : 0}/5

${needsApprovals ? "🔧 Setting missing approvals..." : "✅ All approvals already set"}`,
          actions: ["SETUP_TRADING"],
          data: { balance: totalBalance, needsApprovals, approvalsNeeded },
        };
        await callback(statusContent);
      }

      // Step 2: Set approvals efficiently (batch transactions)
      if (needsApprovals) {
        const transactions = [];
        const gasLimit = 100000;

        // Batch all needed approvals
        const approvalPromises = [];

        if (usdcForCTF == 0) {
          approvalPromises.push(
            usdcContract
              .approve(CTF_ADDRESS, ethers.MaxUint256, { gasLimit })
              .then((tx) => tx.wait())
              .then((receipt) => ({ step: "USDC→CTF", txHash: receipt.hash })),
          );
        }

        if (usdcForExchange == 0) {
          approvalPromises.push(
            usdcContract
              .approve(EXCHANGE_ADDRESS, ethers.MaxUint256, { gasLimit })
              .then((tx) => tx.wait())
              .then((receipt) => ({
                step: "USDC→Exchange",
                txHash: receipt.hash,
              })),
          );
        }

        if (usdcForNegRisk == 0) {
          approvalPromises.push(
            usdcContract
              .approve(NEG_RISK_EXCHANGE_ADDRESS, ethers.MaxUint256, {
                gasLimit,
              })
              .then((tx) => tx.wait())
              .then((receipt) => ({
                step: "USDC→NegRisk",
                txHash: receipt.hash,
              })),
          );
        }

        if (!ctfForExchange) {
          approvalPromises.push(
            ctfContract
              .setApprovalForAll(EXCHANGE_ADDRESS, true, { gasLimit })
              .then((tx) => tx.wait())
              .then((receipt) => ({
                step: "CTF→Exchange",
                txHash: receipt.hash,
              })),
          );
        }

        if (!ctfForNegRisk) {
          approvalPromises.push(
            ctfContract
              .setApprovalForAll(NEG_RISK_EXCHANGE_ADDRESS, true, { gasLimit })
              .then((tx) => tx.wait())
              .then((receipt) => ({
                step: "CTF→NegRisk",
                txHash: receipt.hash,
              })),
          );
        }

        // Execute all approvals in parallel
        const results = await Promise.all(approvalPromises);
        transactions.push(...results);

        logger.info(
          `[setupTradingAction] Completed ${transactions.length} approval transactions`,
        );
      }

      setupStatus.approvalsSet = true;

      // Step 3: Setup API credentials
      const hasApiKey = runtime.getSetting("CLOB_API_KEY");
      const hasApiSecret =
        runtime.getSetting("CLOB_API_SECRET") ||
        runtime.getSetting("CLOB_SECRET");
      const hasApiPassphrase =
        runtime.getSetting("CLOB_API_PASSPHRASE") ||
        runtime.getSetting("CLOB_PASS_PHRASE");

      if (!hasApiKey || !hasApiSecret || !hasApiPassphrase) {
        if (callback) {
          const credContent: Content = {
            text: `🔑 **Deriving API Credentials**

Generating L2 credentials from wallet signature...`,
            actions: ["SETUP_TRADING"],
            data: { step: "credentials" },
          };
          await callback(credContent);
        }

        try {
          const client = await initializeClobClient(runtime);
          const derivedCreds = await client.createOrDeriveApiKey();

          await runtime.setSetting("CLOB_API_KEY", derivedCreds.key);
          await runtime.setSetting("CLOB_API_SECRET", derivedCreds.secret);
          await runtime.setSetting(
            "CLOB_API_PASSPHRASE",
            derivedCreds.passphrase,
          );

          setupStatus.credentialsReady = true;
        } catch (credError) {
          logger.warn(
            "[setupTradingAction] API credential derivation failed, will continue with wallet-only mode",
          );
          setupStatus.credentialsReady = false; // Can still trade with wallet-only
        }
      } else {
        setupStatus.credentialsReady = true;
      }

      // Step 4: Final validation
      setupStatus.balanceAvailable = totalBalance > 0.01; // At least $0.01
      setupStatus.readyToTrade =
        setupStatus.approvalsSet && setupStatus.balanceAvailable;

      // Success response
      const successContent: Content = {
        text: `🎉 **Trading Setup Complete!**

**✅ Setup Status:**
• **Approvals**: ${setupStatus.approvalsSet ? "✅ All Set" : "❌ Failed"}
• **Credentials**: ${setupStatus.credentialsReady ? "✅ Ready" : "⚠️ Wallet-Only Mode"}
• **Balance**: ${setupStatus.balanceAvailable ? `✅ $${totalBalance.toFixed(2)} Available` : "❌ Insufficient"}

**🚀 Trading Status**: ${setupStatus.readyToTrade ? "✅ READY TO TRADE!" : "❌ Setup Required"}

**Wallet**: ${wallet.address}
**USDC Type**: ${usdcType}

${
  setupStatus.readyToTrade
    ? "You can now place buy and sell orders on Polymarket!"
    : "Please resolve the issues above before trading."
}`,
        actions: ["SETUP_TRADING"],
        data: {
          success: setupStatus.readyToTrade,
          setupStatus,
          walletAddress: wallet.address,
          usdcType,
          balance: totalBalance,
        },
      };

      if (callback) {
        await callback(successContent);
      }

      return contentToActionResult(successContent);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      logger.error(`[setupTradingAction] Setup error:`, error);

      const errorContent: Content = {
        text: `❌ **Trading Setup Failed**

**Error**: ${errorMessage}

Please check:
• Private key configuration
• Network connectivity
• Sufficient MATIC for gas fees
• Try again in a few moments`,
        actions: ["SETUP_TRADING"],
        data: {
          error: errorMessage,
          success: false,
        },
      };

      if (callback) {
        await callback(errorContent);
      }

      return createErrorResult(errorMessage);
    }
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: {
          text: "Setup trading for Polymarket",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll set up complete trading functionality for you. This includes approvals, credentials, and validation...",
          action: "SETUP_TRADING",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "Make sure I'm ready to trade",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll prepare your wallet for trading by setting up all necessary approvals and credentials...",
          action: "SETUP_TRADING",
        },
      },
    ],
  ],
};
