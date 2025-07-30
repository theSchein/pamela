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

// Contract addresses on Polygon (Chain ID: 137)
const USDC_NATIVE_ADDRESS = "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359"; // Native USDC (preferred)
const USDC_BRIDGED_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // USDC.e (bridged)
const CTF_ADDRESS = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045"; // Conditional Tokens Framework
const EXCHANGE_ADDRESS = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E"; // CTF Exchange
const NEG_RISK_EXCHANGE_ADDRESS = "0xC5d563A36AE78145C45a50134d48A1215220f80a"; // Neg Risk Exchange
const NEG_RISK_ADAPTER_ADDRESS = "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296"; // Neg Risk Adapter

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

interface ApprovalStatus {
  usdcForCTF: boolean;
  usdcForExchange: boolean;
  ctfForExchange: boolean;
  usdcForNegRisk?: boolean;
  ctfForNegRisk?: boolean;
}

/**
 * Approve USDC for Polymarket trading
 * Sets up all necessary approvals for CTF Exchange and Conditional Tokens
 */
export const approveUSDCAction: Action = {
  name: "APPROVE_USDC",
  similes: [
    "APPROVE_USDC",
    "SET_USDC_APPROVAL",
    "ENABLE_TRADING",
    "SETUP_APPROVALS",
    "APPROVE_TOKENS",
    "ALLOW_SPENDING",
    "SET_ALLOWANCE",
    "ENABLE_USDC",
    "APPROVE_POLYMARKET",
    "SETUP_TRADING",
  ],
  description:
    "Approve USDC spending for Polymarket trading contracts (CTF, Exchange)",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    logger.info(
      `[approveUSDCAction] Validate called for message: "${message.content?.text}"`,
    );

    const privateKey =
      runtime.getSetting("WALLET_PRIVATE_KEY") ||
      runtime.getSetting("POLYMARKET_PRIVATE_KEY") ||
      runtime.getSetting("PRIVATE_KEY");

    if (!privateKey) {
      logger.warn("[approveUSDCAction] No private key found");
      return false;
    }

    logger.info("[approveUSDCAction] Validation passed");
    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    logger.info("[approveUSDCAction] Handler called!");

    try {
      // Get wallet configuration
      const privateKey =
        runtime.getSetting("WALLET_PRIVATE_KEY") ||
        runtime.getSetting("POLYMARKET_PRIVATE_KEY") ||
        runtime.getSetting("PRIVATE_KEY");

      if (!privateKey) {
        const errorMessage = "Private key is required for USDC approval";
        logger.error(`[approveUSDCAction] ${errorMessage}`);
        return createErrorResult(errorMessage);
      }

      // Setup provider and wallet
      const rpcUrl =
        runtime.getSetting("POLYGON_RPC_URL") || "https://polygon-rpc.com";
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const formattedPrivateKey = privateKey.startsWith("0x")
        ? privateKey
        : `0x${privateKey}`;
      const wallet = new ethers.Wallet(formattedPrivateKey, provider);

      logger.info(`[approveUSDCAction] Using wallet: ${wallet.address}`);

      if (callback) {
        const startContent: Content = {
          text: `🔧 **Setting up USDC Approvals**

**Wallet Address**: ${wallet.address}
**Network**: Polygon (Chain ID: 137)

**Approval Process:**
1. Check current allowances
2. Approve USDC for Conditional Tokens Framework
3. Approve USDC for CTF Exchange
4. Approve USDC for Neg Risk Exchange
5. Set CTF approval for both Exchanges

Checking current approvals...`,
          actions: ["APPROVE_USDC"],
          data: { walletAddress: wallet.address, step: "starting" },
        };
        await callback(startContent);
      }

      // Contract instances for both USDC types
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
      const nativeBalance = await usdcNativeContract.balanceOf(wallet.address);
      const bridgedBalance = await usdcBridgedContract.balanceOf(
        wallet.address,
      );

      const useNativeUSDC = nativeBalance > bridgedBalance;
      const usdcContract = useNativeUSDC
        ? usdcNativeContract
        : usdcBridgedContract;
      const usdcAddress = useNativeUSDC
        ? USDC_NATIVE_ADDRESS
        : USDC_BRIDGED_ADDRESS;
      const usdcType = useNativeUSDC ? "Native USDC" : "USDC.e (Bridged)";

      logger.info(
        `[approveUSDCAction] Using ${usdcType} (${ethers.formatUnits(useNativeUSDC ? nativeBalance : bridgedBalance, 6)} USDC)`,
      );

      // Check current approval status for both exchanges
      const [
        usdcForCTFAllowance,
        usdcForExchangeAllowance,
        usdcForNegRiskAllowance,
        ctfForExchangeApproval,
        ctfForNegRiskApproval,
      ] = await Promise.all([
        usdcContract.allowance(wallet.address, CTF_ADDRESS),
        usdcContract.allowance(wallet.address, EXCHANGE_ADDRESS),
        usdcContract.allowance(wallet.address, NEG_RISK_EXCHANGE_ADDRESS),
        ctfContract.isApprovedForAll(wallet.address, EXCHANGE_ADDRESS),
        ctfContract.isApprovedForAll(wallet.address, NEG_RISK_EXCHANGE_ADDRESS),
      ]);

      const currentStatus: ApprovalStatus = {
        usdcForCTF: usdcForCTFAllowance > 0,
        usdcForExchange: usdcForExchangeAllowance > 0,
        ctfForExchange: ctfForExchangeApproval,
        usdcForNegRisk: usdcForNegRiskAllowance > 0,
        ctfForNegRisk: ctfForNegRiskApproval,
      };

      if (callback) {
        const statusContent: Content = {
          text: `📊 **Current Approval Status**

**USDC Contract**: ${usdcType}
**Balance**: ${ethers.formatUnits(useNativeUSDC ? nativeBalance : bridgedBalance, 6)} USDC

**Current Allowances:**
• USDC → CTF: ${currentStatus.usdcForCTF ? "✅ Approved" : "❌ Not Approved"}
• USDC → CTF Exchange: ${currentStatus.usdcForExchange ? "✅ Approved" : "❌ Not Approved"}
• USDC → Neg Risk Exchange: ${currentStatus.usdcForNegRisk ? "✅ Approved" : "❌ Not Approved"}
• CTF → CTF Exchange: ${currentStatus.ctfForExchange ? "✅ Approved" : "❌ Not Approved"}
• CTF → Neg Risk Exchange: ${currentStatus.ctfForNegRisk ? "✅ Approved" : "❌ Not Approved"}

${
  currentStatus.usdcForCTF &&
  currentStatus.usdcForExchange &&
  currentStatus.ctfForExchange &&
  currentStatus.usdcForNegRisk &&
  currentStatus.ctfForNegRisk
    ? "✅ All approvals already set - ready for trading!"
    : "Setting missing approvals..."
}`,
          actions: ["APPROVE_USDC"],
          data: {
            currentStatus,
            usdcType,
            balance: ethers.formatUnits(
              useNativeUSDC ? nativeBalance : bridgedBalance,
              6,
            ),
          },
        };
        await callback(statusContent);
      }

      // If all approvals are already set, return success
      if (
        currentStatus.usdcForCTF &&
        currentStatus.usdcForExchange &&
        currentStatus.ctfForExchange &&
        currentStatus.usdcForNegRisk &&
        currentStatus.ctfForNegRisk
      ) {
        const successContent: Content = {
          text: `✅ **All Approvals Already Set**

**USDC Contract**: ${usdcType}
**Wallet Address**: ${wallet.address}

**✅ Ready for Trading:**
• USDC → CTF: Approved
• USDC → CTF Exchange: Approved  
• USDC → Neg Risk Exchange: Approved
• CTF → CTF Exchange: Approved
• CTF → Neg Risk Exchange: Approved

You can now place orders on Polymarket!`,
          actions: ["APPROVE_USDC"],
          data: {
            success: true,
            allApprovalsSet: true,
            walletAddress: wallet.address,
            usdcType,
            approvalStatus: currentStatus,
          },
        };

        if (callback) {
          await callback(successContent);
        }
        return contentToActionResult(successContent);
      }

      // Set missing approvals
      const transactions = [];
      const gasLimit = 100000; // Conservative gas limit for approvals

      // Step 1: Approve USDC for CTF if needed
      if (!currentStatus.usdcForCTF) {
        logger.info("[approveUSDCAction] Setting USDC allowance for CTF...");

        if (callback) {
          const step1Content: Content = {
            text: `🔧 **Step 1/5: Approving USDC for CTF**

Setting unlimited allowance for Conditional Tokens Framework...
**Contract**: ${CTF_ADDRESS}`,
            actions: ["APPROVE_USDC"],
            data: { step: 1, contract: "CTF" },
          };
          await callback(step1Content);
        }

        const tx1 = await usdcContract.approve(CTF_ADDRESS, ethers.MaxUint256, {
          gasLimit,
        });
        const receipt1 = await tx1.wait();
        transactions.push({ step: 1, contract: "CTF", txHash: receipt1.hash });

        logger.info(`[approveUSDCAction] CTF approval tx: ${receipt1.hash}`);
      }

      // Step 2: Approve USDC for Exchange if needed
      if (!currentStatus.usdcForExchange) {
        logger.info(
          "[approveUSDCAction] Setting USDC allowance for Exchange...",
        );

        if (callback) {
          const step2Content: Content = {
            text: `🔧 **Step 2/5: Approving USDC for CTF Exchange**

Setting unlimited allowance for CTF Exchange...
**Contract**: ${EXCHANGE_ADDRESS}`,
            actions: ["APPROVE_USDC"],
            data: { step: 2, contract: "Exchange" },
          };
          await callback(step2Content);
        }

        const tx2 = await usdcContract.approve(
          EXCHANGE_ADDRESS,
          ethers.MaxUint256,
          { gasLimit },
        );
        const receipt2 = await tx2.wait();
        transactions.push({
          step: 2,
          contract: "Exchange",
          txHash: receipt2.hash,
        });

        logger.info(
          `[approveUSDCAction] Exchange approval tx: ${receipt2.hash}`,
        );
      }

      // Step 3: Set CTF approval for Exchange if needed
      if (!currentStatus.ctfForExchange) {
        logger.info("[approveUSDCAction] Setting CTF approval for Exchange...");

        if (callback) {
          const step3Content: Content = {
            text: `🔧 **Step 3/5: Approving CTF for CTF Exchange**

Setting approval for all CTF tokens on Exchange...
**Contract**: ${EXCHANGE_ADDRESS}`,
            actions: ["APPROVE_USDC"],
            data: { step: 3, contract: "CTF for Exchange" },
          };
          await callback(step3Content);
        }

        const tx3 = await ctfContract.setApprovalForAll(
          EXCHANGE_ADDRESS,
          true,
          { gasLimit },
        );
        const receipt3 = await tx3.wait();
        transactions.push({
          step: 3,
          contract: "CTF for Exchange",
          txHash: receipt3.hash,
        });

        logger.info(`[approveUSDCAction] CTF approval tx: ${receipt3.hash}`);
      }

      // Step 4: Approve USDC for Neg Risk Exchange if needed
      if (!currentStatus.usdcForNegRisk) {
        logger.info(
          "[approveUSDCAction] Setting USDC allowance for Neg Risk Exchange...",
        );

        if (callback) {
          const step4Content: Content = {
            text: `🔧 **Step 4/5: Approving USDC for Neg Risk Exchange**

Setting unlimited allowance for Neg Risk Exchange...
**Contract**: ${NEG_RISK_EXCHANGE_ADDRESS}`,
            actions: ["APPROVE_USDC"],
            data: { step: 4, contract: "Neg Risk Exchange" },
          };
          await callback(step4Content);
        }

        const tx4 = await usdcContract.approve(
          NEG_RISK_EXCHANGE_ADDRESS,
          ethers.MaxUint256,
          { gasLimit },
        );
        const receipt4 = await tx4.wait();
        transactions.push({
          step: 4,
          contract: "Neg Risk Exchange",
          txHash: receipt4.hash,
        });

        logger.info(
          `[approveUSDCAction] Neg Risk Exchange approval tx: ${receipt4.hash}`,
        );
      }

      // Step 5: Set CTF approval for Neg Risk Exchange if needed
      if (!currentStatus.ctfForNegRisk) {
        logger.info(
          "[approveUSDCAction] Setting CTF approval for Neg Risk Exchange...",
        );

        if (callback) {
          const step5Content: Content = {
            text: `🔧 **Step 5/5: Approving CTF for Neg Risk Exchange**

Setting approval for all CTF tokens on Neg Risk Exchange...
**Contract**: ${NEG_RISK_EXCHANGE_ADDRESS}`,
            actions: ["APPROVE_USDC"],
            data: { step: 5, contract: "CTF for Neg Risk Exchange" },
          };
          await callback(step5Content);
        }

        const tx5 = await ctfContract.setApprovalForAll(
          NEG_RISK_EXCHANGE_ADDRESS,
          true,
          { gasLimit },
        );
        const receipt5 = await tx5.wait();
        transactions.push({
          step: 5,
          contract: "CTF for Neg Risk Exchange",
          txHash: receipt5.hash,
        });

        logger.info(
          `[approveUSDCAction] CTF approval for Neg Risk Exchange tx: ${receipt5.hash}`,
        );
      }

      // Success response
      const successContent: Content = {
        text: `🎉 **USDC Approvals Successfully Set!**

**Wallet Address**: ${wallet.address}
**USDC Contract**: ${usdcType}
**Network**: Polygon

**✅ Completed Approvals:**
${transactions.map((tx) => `• Step ${tx.step} - ${tx.contract}: [${tx.txHash.slice(0, 10)}...](https://polygonscan.com/tx/${tx.txHash})`).join("\n")}

**✅ Trading Ready:**
• USDC → CTF: ✅ Approved
• USDC → CTF Exchange: ✅ Approved
• USDC → Neg Risk Exchange: ✅ Approved
• CTF → CTF Exchange: ✅ Approved
• CTF → Neg Risk Exchange: ✅ Approved

🚀 **You can now place orders on Polymarket!**`,
        actions: ["APPROVE_USDC"],
        data: {
          success: true,
          walletAddress: wallet.address,
          usdcType,
          transactions,
          finalStatus: {
            usdcForCTF: true,
            usdcForExchange: true,
            ctfForExchange: true,
            usdcForNegRisk: true,
            ctfForNegRisk: true,
          },
        },
      };

      if (callback) {
        await callback(successContent);
      }

      return contentToActionResult(successContent);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      logger.error(`[approveUSDCAction] Error:`, error);

      const errorContent: Content = {
        text: `❌ **USDC Approval Failed**

**Error**: ${errorMessage}

This could be due to:
• Insufficient ETH for gas fees
• Network connectivity issues
• Invalid private key configuration
• RPC provider problems

**Please check:**
1. You have enough MATIC for gas fees
2. Your private key is correctly configured
3. Network connection is stable
4. Try again in a few moments

**Configuration:**
- WALLET_PRIVATE_KEY or POLYMARKET_PRIVATE_KEY must be set
- Sufficient MATIC balance for gas fees required`,
        actions: ["APPROVE_USDC"],
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
          text: "I need to approve USDC for Polymarket trading",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll set up the necessary USDC approvals for Polymarket trading. This will approve USDC spending for the CTF and Exchange contracts...",
          action: "APPROVE_USDC",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "Set up trading approvals for my wallet",
        },
      },
      {
        name: "{{user2}}",
        content: {
          text: "I'll configure the required approvals for Polymarket trading. Setting up USDC allowances...",
          action: "APPROVE_USDC",
        },
      },
    ],
  ],
};
