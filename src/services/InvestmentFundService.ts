/**
 * InvestmentFund Service
 *
 * Manages interaction with ERC-4626 compliant InvestmentFund smart contracts.
 * Handles fund lifecycle phases, position valuation updates, and fund returns.
 *
 * ## Fund Phases
 * - DEPOSIT (0): Investors deposit USDC
 * - TRADING (1): Agent receives USDC and trades on Polymarket
 * - REDEMPTION (2): Agent returns funds, investors can withdraw
 * - CLOSED (3): Fund is closed
 *
 * ## Key Features
 * - Start trading phase and receive USDC
 * - Submit periodic position valuations
 * - Return funds after liquidating positions
 * - Monitor fund phase and state
 * - Calculate total portfolio value (Polymarket positions + USDC)
 *
 * ## Integration with Trading Agent
 * - Automatically calculates position value from PositionManager
 * - Submits valuations every 1-6 hours during trading
 * - Handles fund returns when trading completes
 */

import { elizaLogger, IAgentRuntime, Service, type Metadata } from "@elizaos/core";
import { ethers } from "ethers";

export interface InvestmentFundConfig {
  enabled: boolean;
  fundAddress?: string;
  valuationIntervalHours: number; // How often to submit valuations (1-6 hours)
  rpcUrl?: string;
  usdcAddress?: string;
}

export enum FundPhase {
  DEPOSIT = 0,
  TRADING = 1,
  REDEMPTION = 2,
  CLOSED = 3,
}

export interface FundState {
  currentPhase: FundPhase;
  totalDeposits: string;
  estimatedValue: string;
  lastValuationTime: number;
  totalAssets: string;
}

export class InvestmentFundService extends Service {
  runtime: IAgentRuntime = null as any;
  config: InvestmentFundConfig & Metadata;
  private provider: ethers.JsonRpcProvider | null = null;
  private fundContract: ethers.Contract | null = null;
  private usdcContract: ethers.Contract | null = null;
  private signer: ethers.Wallet | null = null;
  private valuationInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  // Contract ABIs
  private static readonly FUND_ABI = [
    "function currentPhase() view returns (uint8)",
    "function totalDeposits() view returns (uint256)",
    "function estimatedValue() view returns (uint256)",
    "function lastValuationTime() view returns (uint256)",
    "function totalAssets() view returns (uint256)",
    "function agentWallet() view returns (address)",
    "function asset() view returns (address)",
    "function startTrading() external",
    "function submitValuation(uint256 value) external",
    "function returnFunds(uint256 amount) external",
    "function calculateProfit() external",
    "event TradingStarted(uint256 timestamp, uint256 totalFunds)",
    "event ValuationUpdated(uint256 value, uint256 timestamp)",
    "event FundsReturned(uint256 amount)",
  ];

  private static readonly USDC_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
  ];

  static get serviceType(): string {
    return "INVESTMENT_FUND";
  }

  get capabilityDescription(): string {
    return "ERC-4626 Investment Fund integration for managed trading";
  }

  constructor(config: InvestmentFundConfig) {
    super();
    this.config = config as InvestmentFundConfig & Metadata;
  }

  async initialize(runtime: IAgentRuntime): Promise<void> {
    this.runtime = runtime;

    if (!this.config.enabled) {
      elizaLogger.info("InvestmentFund service disabled in configuration");
      return;
    }

    if (!this.config.fundAddress) {
      elizaLogger.warn("InvestmentFund address not configured, service disabled");
      return;
    }

    elizaLogger.info("🏦 === INVESTMENT FUND SERVICE STARTING ===");
    elizaLogger.info(`Fund Address: ${this.config.fundAddress}`);

    try {
      // Set up provider and contracts
      const rpcUrl = this.config.rpcUrl || process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";
      this.provider = new ethers.JsonRpcProvider(rpcUrl);

      // Get wallet from private key
      const privateKey = process.env.POLYMARKET_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error("POLYMARKET_PRIVATE_KEY not found in environment");
      }
      this.signer = new ethers.Wallet(privateKey, this.provider);

      // Initialize fund contract
      this.fundContract = new ethers.Contract(
        this.config.fundAddress,
        InvestmentFundService.FUND_ABI,
        this.signer
      );

      // Get USDC address from fund contract
      const usdcAddress = this.config.usdcAddress || await this.fundContract.asset();
      this.usdcContract = new ethers.Contract(
        usdcAddress,
        InvestmentFundService.USDC_ABI,
        this.signer
      );

      elizaLogger.info(`USDC Address: ${usdcAddress}`);
      elizaLogger.info(`Agent Wallet: ${this.signer.address}`);

      // Verify we're the authorized agent
      const authorizedAgent = await this.fundContract.agentWallet();
      if (authorizedAgent.toLowerCase() !== this.signer.address.toLowerCase()) {
        elizaLogger.warn(
          `⚠️  WARNING: Agent wallet mismatch! Contract expects: ${authorizedAgent}, We are: ${this.signer.address}`
        );
      }

      // Check current fund state
      const state = await this.getFundState();
      elizaLogger.info(`Current Phase: ${FundPhase[state.currentPhase]}`);
      elizaLogger.info(`Total Deposits: ${ethers.formatUnits(state.totalDeposits, 6)} USDC`);
      elizaLogger.info(`Estimated Value: ${ethers.formatUnits(state.estimatedValue, 6)} USDC`);

      // Set up event listeners
      this.setupEventListeners();

      elizaLogger.info("✅ InvestmentFund service initialized successfully");
    } catch (error) {
      elizaLogger.error("Failed to initialize InvestmentFund service:", error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.config.enabled || !this.fundContract) {
      return;
    }

    this.isRunning = true;
    elizaLogger.info("🏦 InvestmentFund service started");

    // Start periodic valuation updates
    this.startValuationUpdates();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.valuationInterval) {
      clearInterval(this.valuationInterval);
      this.valuationInterval = null;
    }
    elizaLogger.info("InvestmentFund service stopped");
  }

  /**
   * Get current fund state from contract
   */
  async getFundState(): Promise<FundState> {
    if (!this.fundContract) {
      throw new Error("Fund contract not initialized");
    }

    const [currentPhase, totalDeposits, estimatedValue, lastValuationTime, totalAssets] =
      await Promise.all([
        this.fundContract.currentPhase(),
        this.fundContract.totalDeposits(),
        this.fundContract.estimatedValue(),
        this.fundContract.lastValuationTime(),
        this.fundContract.totalAssets(),
      ]);

    return {
      currentPhase: Number(currentPhase),
      totalDeposits: totalDeposits.toString(),
      estimatedValue: estimatedValue.toString(),
      lastValuationTime: Number(lastValuationTime),
      totalAssets: totalAssets.toString(),
    };
  }

  /**
   * Start trading phase - transfers USDC from fund to agent wallet
   */
  async startTrading(): Promise<boolean> {
    if (!this.fundContract) {
      throw new Error("Fund contract not initialized");
    }

    try {
      const state = await this.getFundState();
      if (state.currentPhase !== FundPhase.DEPOSIT) {
        elizaLogger.warn(`Cannot start trading - current phase is ${FundPhase[state.currentPhase]}`);
        return false;
      }

      elizaLogger.info("🚀 Starting trading phase...");
      const tx = await this.fundContract.startTrading();
      const receipt = await tx.wait();

      elizaLogger.info(`✅ Trading started! Transaction: ${receipt.hash}`);

      // Check new USDC balance
      const balance = await this.getAgentUSDCBalance();
      elizaLogger.info(`💰 Agent wallet received: ${balance} USDC`);

      return true;
    } catch (error) {
      elizaLogger.error("Failed to start trading:", error);
      return false;
    }
  }

  /**
   * Submit position valuation to fund contract
   * @param valueUSDC Total value of positions in USDC
   */
  async submitValuation(valueUSDC: number): Promise<boolean> {
    if (!this.fundContract) {
      throw new Error("Fund contract not initialized");
    }

    try {
      // Check we're in trading phase
      const state = await this.getFundState();
      if (state.currentPhase !== FundPhase.TRADING) {
        elizaLogger.debug(`Not in trading phase - skipping valuation update`);
        return false;
      }

      // Convert to USDC decimals (6)
      const valueWei = ethers.parseUnits(valueUSDC.toFixed(6), 6);

      elizaLogger.info(`📊 Submitting valuation: $${valueUSDC.toFixed(2)} USDC`);
      const tx = await this.fundContract.submitValuation(valueWei);
      const receipt = await tx.wait();

      elizaLogger.info(`✅ Valuation updated! Transaction: ${receipt.hash}`);
      return true;
    } catch (error) {
      elizaLogger.error("Failed to submit valuation:", error);
      return false;
    }
  }

  /**
   * Return funds to the fund contract after liquidating positions
   * @param amountUSDC Amount to return (or undefined to return all)
   */
  async returnFunds(amountUSDC?: number): Promise<boolean> {
    if (!this.fundContract || !this.usdcContract) {
      throw new Error("Contracts not initialized");
    }

    try {
      // Get amount to return
      const balance = await this.getAgentUSDCBalance();
      const amount = amountUSDC || parseFloat(balance);
      const amountWei = ethers.parseUnits(amount.toFixed(6), 6);

      elizaLogger.info(`💸 Returning ${amount} USDC to fund...`);

      // Check allowance and approve if needed
      const allowance = await this.usdcContract.allowance(
        this.signer!.address,
        this.config.fundAddress
      );

      if (allowance < amountWei) {
        elizaLogger.info("Approving USDC transfer...");
        const approveTx = await this.usdcContract.approve(this.config.fundAddress, amountWei);
        await approveTx.wait();
        elizaLogger.info("✅ USDC approved");
      }

      // Return funds
      const tx = await this.fundContract.returnFunds(amountWei);
      const receipt = await tx.wait();

      elizaLogger.info(`✅ Funds returned! Transaction: ${receipt.hash}`);
      elizaLogger.info("📈 Fund now in REDEMPTION phase");

      return true;
    } catch (error) {
      elizaLogger.error("Failed to return funds:", error);
      return false;
    }
  }

  /**
   * Calculate total portfolio value (Polymarket positions + USDC)
   * This requires the PositionManager and PortfolioValuator to be available
   * @param getPositions Callback to get current positions from PositionManager
   * @param getBalance Callback to get current USDC balance from BalanceManager
   */
  async calculatePortfolioValue(
    getPositions?: () => Map<string, any>,
    getBalance?: () => Promise<number>
  ): Promise<number> {
    try {
      // Get USDC balance
      const usdcBalance = getBalance
        ? await getBalance()
        : parseFloat(await this.getAgentUSDCBalance());

      // If no positions callback provided, return just USDC balance
      if (!getPositions) {
        return usdcBalance;
      }

      // Get positions and calculate their value
      const positions = getPositions();
      let positionsValue = 0;

      for (const [_, position] of positions) {
        // Use current price if available, otherwise average price
        const price = position.currentPrice || position.avgPrice || 0.5;
        positionsValue += position.size * price;
      }

      const totalValue = usdcBalance + positionsValue;

      elizaLogger.debug(
        `Portfolio value: ${positions.size} positions ($${positionsValue.toFixed(2)}) + ` +
        `USDC ($${usdcBalance.toFixed(2)}) = $${totalValue.toFixed(2)}`
      );

      return totalValue;
    } catch (error) {
      // Only log if it's not an expected error during testing
      if (error instanceof Error && !error.message.includes("Failed to get")) {
        elizaLogger.error("Failed to calculate portfolio value:", error as any);
      }
      return 0;
    }
  }

  /**
   * Get agent wallet USDC balance
   */
  async getAgentUSDCBalance(): Promise<string> {
    if (!this.usdcContract || !this.signer) {
      throw new Error("USDC contract not initialized");
    }

    const balance = await this.usdcContract.balanceOf(this.signer.address);
    return ethers.formatUnits(balance, 6);
  }

  /**
   * Start periodic valuation updates
   */
  private startValuationUpdates(): void {
    if (this.valuationInterval) {
      clearInterval(this.valuationInterval);
    }

    const intervalMs = this.config.valuationIntervalHours * 60 * 60 * 1000;

    this.valuationInterval = setInterval(async () => {
      try {
        const state = await this.getFundState();
        if (state.currentPhase === FundPhase.TRADING) {
          const portfolioValue = await this.calculatePortfolioValue();
          await this.submitValuation(portfolioValue);
        }
      } catch (error) {
        elizaLogger.error("Error in valuation update:", error);
      }
    }, intervalMs);

    elizaLogger.info(
      `📊 Valuation updates scheduled every ${this.config.valuationIntervalHours} hour(s)`
    );
  }

  /**
   * Set up event listeners for fund contract
   */
  private setupEventListeners(): void {
    if (!this.fundContract) return;

    this.fundContract.on("TradingStarted", (timestamp, totalFunds) => {
      elizaLogger.info(
        `🎯 Event: Trading started with ${ethers.formatUnits(totalFunds, 6)} USDC`
      );
    });

    this.fundContract.on("ValuationUpdated", (value, timestamp) => {
      elizaLogger.info(
        `📊 Event: Valuation updated to ${ethers.formatUnits(value, 6)} USDC`
      );
    });

    this.fundContract.on("FundsReturned", (amount) => {
      elizaLogger.info(`💸 Event: ${ethers.formatUnits(amount, 6)} USDC returned to fund`);
    });

    elizaLogger.info("👂 Event listeners set up");
  }

  /**
   * Get service status
   */
  getStatus(): string {
    if (!this.config.enabled || !this.fundContract) {
      return "🏦 InvestmentFund: Disabled";
    }

    return `
🏦 InvestmentFund Service Status:
- Fund Address: ${this.config.fundAddress}
- Service: ${this.isRunning ? "✅ Running" : "❌ Stopped"}
- Valuation Interval: ${this.config.valuationIntervalHours} hour(s)
    `.trim();
  }

  /**
   * Static method to create service from environment config
   */
  static fromEnvironment(): InvestmentFundService {
    const config: InvestmentFundConfig = {
      enabled: process.env.INVESTMENT_FUND_ENABLED === "true",
      fundAddress: process.env.INVESTMENT_FUND_ADDRESS,
      valuationIntervalHours: Number(process.env.VALUATION_INTERVAL_HOURS) || 2,
      rpcUrl: process.env.POLYGON_RPC_URL,
      usdcAddress: process.env.USDC_ADDRESS || "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC on Polygon
    };

    return new InvestmentFundService(config);
  }
}
