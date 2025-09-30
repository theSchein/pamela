import { Service, IAgentRuntime, logger, Memory, State, HandlerCallback } from "@elizaos/core";
import { SPMCClient, initSPMCClient } from "../utils/spmcClient";
import { IndexAllocationCalculator, Position } from "../utils/indexAllocation";

interface IndexTradingConfig {
    enabled: boolean;
    spmcApiUrl: string;
    spmcIndexId: string;
    minPositionSize: number;
    rebalanceDay: string; // e.g., "MONDAY"
    rebalanceHour: number; // 0-23
    maxSlippage: number; // e.g., 0.05 for 5%
}

export class IndexTradingService extends Service {
    static serviceType = "index-trading";
    capabilityDescription = "Manages index-following portfolio rebalancing";
    
    private static instance: IndexTradingService | null = null;
    private indexConfig: IndexTradingConfig;
    private spmcClient: SPMCClient | null = null;
    private allocCalculator: IndexAllocationCalculator | null = null;
    private rebalanceTimer: NodeJS.Timeout | null = null;
    private isRebalancing: boolean = false;
    private isPaused: boolean = false;

    constructor(runtime?: IAgentRuntime) {
        super(runtime);
        this.indexConfig = this.loadConfig();
    }

    static getInstance(): IndexTradingService {
        if (!IndexTradingService.instance) {
            IndexTradingService.instance = new IndexTradingService();
        }
        return IndexTradingService.instance;
    }

    async initialize(runtime: IAgentRuntime): Promise<void> {
        this.runtime = runtime;
        
        if (!this.indexConfig.enabled) {
            logger.info("IndexTradingService: Index trading is disabled");
            return;
        }

        try {
            // Initialize SPMC client
            this.spmcClient = initSPMCClient(
                this.indexConfig.spmcApiUrl,
                this.indexConfig.spmcIndexId
            );

            // Initialize allocation calculator
            this.allocCalculator = new IndexAllocationCalculator(
                this.spmcClient,
                this.indexConfig.minPositionSize
            );

            logger.info(`IndexTradingService: Initialized with index ${this.indexConfig.spmcIndexId}`);

            // Schedule weekly rebalancing
            this.scheduleRebalancing();

        } catch (error) {
            logger.error(`IndexTradingService: Failed to initialize: ${error}`);
            throw error;
        }
    }

    private loadConfig(): IndexTradingConfig {
        return {
            enabled: process.env.INDEX_TRADING_ENABLED === 'true',
            spmcApiUrl: process.env.SPMC_API_URL || 'https://api.spmc.dev',
            spmcIndexId: process.env.SPMC_INDEX_ID || '',
            minPositionSize: parseFloat(process.env.MIN_INDEX_POSITION || '10'),
            rebalanceDay: process.env.INDEX_REBALANCE_DAY || 'MONDAY',
            rebalanceHour: parseInt(process.env.INDEX_REBALANCE_HOUR || '9'),
            maxSlippage: parseFloat(process.env.INDEX_MAX_SLIPPAGE || '0.05')
        };
    }

    private scheduleRebalancing(): void {
        // Clear any existing timer
        if (this.rebalanceTimer) {
            clearInterval(this.rebalanceTimer);
        }

        // Check every hour if it's time to rebalance
        this.rebalanceTimer = setInterval(async () => {
            if (this.shouldRebalance() && !this.isPaused) {
                await this.executeRebalance();
            }
        }, 60 * 60 * 1000); // Check hourly

        logger.info(`IndexTradingService: Scheduled rebalancing for ${this.indexConfig.rebalanceDay} at ${this.indexConfig.rebalanceHour}:00`);
    }

    private shouldRebalance(): boolean {
        const now = new Date();
        const dayMap: { [key: string]: number } = {
            'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3,
            'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6
        };

        const targetDay = dayMap[this.indexConfig.rebalanceDay.toUpperCase()];
        const currentDay = now.getDay();
        const currentHour = now.getHours();

        return currentDay === targetDay && 
               currentHour === this.indexConfig.rebalanceHour &&
               !this.isRebalancing;
    }

    /**
     * Execute an action through the runtime
     */
    private async executeAction(actionName: string, text: string): Promise<any> {
        if (!this.runtime) throw new Error("Runtime not initialized");

        // Create a message for the action
        // Generate a proper UUID format
        const messageId = crypto.randomUUID ? crypto.randomUUID() : 
            `${Date.now().toString(16).padStart(8, '0')}-${Math.random().toString(16).substr(2, 4)}-${Math.random().toString(16).substr(2, 4)}-${Math.random().toString(16).substr(2, 4)}-${Date.now().toString(16).padStart(12, '0')}` as `${string}-${string}-${string}-${string}-${string}`;
        
        const message: Memory = {
            id: messageId,
            entityId: messageId, // Use message ID as entity ID for system messages
            agentId: this.runtime.agentId,
            roomId: messageId,
            content: { text },
            createdAt: Date.now()
        };

        const state: State = {
            values: {},
            data: {},
            text: ""
        };
        
        // Get all registered actions
        const actions = this.runtime.actions || [];
        const action = actions.find((a: any) => 
            a.name === actionName || 
            a.name === `POLYMARKET_${actionName.toUpperCase()}` ||
            a.name === actionName.toUpperCase()
        );

        if (!action) {
            logger.error(`IndexTradingService: Action ${actionName} not found`);
            return null;
        }

        // Validate action can run
        const canRun = await action.validate(this.runtime, message);
        if (!canRun) {
            logger.error(`IndexTradingService: Cannot run action ${actionName}`);
            return null;
        }

        // Execute action and capture result
        let result: any = null;
        const callback: HandlerCallback = async (response) => {
            result = response;
            return [];
        };

        await action.handler(this.runtime, message, state, {}, callback);
        return result;
    }

    /**
     * Get wallet balance using the plugin action
     */
    private async getWalletBalance(): Promise<number> {
        try {
            const result = await this.executeAction('GET_WALLET_BALANCE', 'check wallet balance');
            
            if (result && result.text) {
                // Parse balance from response
                const match = result.text.match(/(\d+\.?\d*)\s*USDC/);
                if (match) {
                    return parseFloat(match[1]);
                }
            }
            
            return 0;
        } catch (error) {
            logger.error(`IndexTradingService: Error getting wallet balance: ${error}`);
            return 0;
        }
    }

    /**
     * Get portfolio positions using the plugin action
     */
    private async getPortfolioPositions(): Promise<Position[]> {
        try {
            const result = await this.executeAction('GET_PORTFOLIO_POSITIONS', 'get portfolio positions');
            
            if (!result || !result.text) return [];
            
            const positions: Position[] = [];
            const lines = result.text.split('\n');
            
            for (const line of lines) {
                const marketMatch = line.match(/Market:\s*([a-f0-9-]+)/i);
                const sizeMatch = line.match(/Size:\s*(\d+\.?\d*)/);
                const priceMatch = line.match(/Price:\s*\$?(\d+\.?\d*)/);
                
                if (marketMatch && sizeMatch && priceMatch) {
                    positions.push({
                        marketId: marketMatch[1],
                        outcomeId: 'YES',
                        amount: parseFloat(sizeMatch[1]) * parseFloat(priceMatch[1]),
                        avgPrice: parseFloat(priceMatch[1])
                    });
                }
            }
            
            return positions;
        } catch (error) {
            logger.error(`IndexTradingService: Error getting positions: ${error}`);
            return [];
        }
    }

    /**
     * Execute a buy or sell order using plugin actions
     */
    private async executeOrder(
        marketId: string,
        side: 'BUY' | 'SELL',
        amount: number
    ): Promise<boolean> {
        try {
            const actionName = side === 'BUY' ? 'PLACE_ORDER' : 'SELL_ORDER';
            const orderText = side === 'BUY' ? 
                `buy $${amount} of market ${marketId} YES` :
                `sell $${amount} of market ${marketId} YES`;

            const result = await this.executeAction(actionName, orderText);
            return result && !result.error && result.text?.includes('success');
        } catch (error) {
            logger.error(`IndexTradingService: Error executing ${side} order: ${error}`);
            return false;
        }
    }

    /**
     * Redeem winnings using plugin action
     */
    private async redeemWinnings(): Promise<void> {
        try {
            const result = await this.executeAction('REDEEM_WINNINGS', 'redeem all winnings');
            
            if (result && result.text?.includes('redeemed')) {
                logger.info("IndexTradingService: Successfully redeemed winnings");
            }
        } catch (error) {
            logger.error(`IndexTradingService: Error redeeming winnings: ${error}`);
        }
    }

    /**
     * Execute index rebalancing
     * @returns true if successful
     */
    async executeRebalance(): Promise<boolean> {
        if (!this.runtime || !this.allocCalculator) {
            logger.error("IndexTradingService: Service not properly initialized");
            return false;
        }

        if (this.isRebalancing) {
            logger.warn("IndexTradingService: Already rebalancing");
            return false;
        }

        this.isRebalancing = true;
        logger.info("IndexTradingService: Starting index rebalancing");

        try {
            // Step 1: Redeem any resolved positions
            await this.redeemWinnings();

            // Step 2: Get current positions and balance
            const [positions, usdcBalance] = await Promise.all([
                this.getPortfolioPositions(),
                this.getWalletBalance()
            ]);
            
            // Calculate total portfolio value
            const positionValue = positions.reduce((sum, p) => sum + p.amount, 0);
            const totalValue = usdcBalance + positionValue;

            logger.info(`IndexTradingService: Portfolio value: $${totalValue.toFixed(2)} (USDC: $${usdcBalance.toFixed(2)}, Positions: $${positionValue.toFixed(2)})`);

            // Step 3: Calculate target allocations
            const allocations = await this.allocCalculator.calculateTargetAllocations(
                totalValue,
                positions
            );

            // Step 4: Check if rebalancing is needed
            if (!this.allocCalculator.isRebalanceNeeded(allocations)) {
                logger.info("IndexTradingService: Portfolio is balanced, no trades needed");
                this.isRebalancing = false;
                return true;
            }

            // Step 5: Generate and execute rebalance orders
            const orders = this.allocCalculator.generateRebalanceOrders(
                allocations,
                usdcBalance
            );

            logger.info(`IndexTradingService: Executing ${orders.length} rebalance orders`);

            // Execute sells first to free up capital
            const sellOrders = orders.filter(o => o.side === 'SELL');
            for (const order of sellOrders) {
                await this.executeOrder(order.marketId, 'SELL', order.amount);
            }

            // Wait a moment for sells to settle
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Execute buys with freed capital
            const buyOrders = orders.filter(o => o.side === 'BUY');
            for (const order of buyOrders) {
                await this.executeOrder(order.marketId, 'BUY', order.amount);
            }

            logger.info("IndexTradingService: Rebalancing completed successfully");

            // Log final summary
            const summary = this.allocCalculator.getAllocationSummary(allocations);
            logger.info(`IndexTradingService: ${summary}`);

            this.isRebalancing = false;
            return true;

        } catch (error) {
            logger.error(`IndexTradingService: Rebalancing failed: ${error}`);
            this.isRebalancing = false;
            return false;
        }
    }

    /**
     * Manually trigger a rebalance
     */
    async manualRebalance(): Promise<boolean> {
        if (this.isPaused) {
            logger.warn("IndexTradingService: Service is paused");
            return false;
        }
        return await this.executeRebalance();
    }

    /**
     * Get current index status
     */
    async getIndexStatus(): Promise<any> {
        if (!this.runtime || !this.allocCalculator) {
            return { error: "Service not initialized" };
        }

        try {
            const [positions, usdcBalance] = await Promise.all([
                this.getPortfolioPositions(),
                this.getWalletBalance()
            ]);
            
            const positionValue = positions.reduce((sum, p) => sum + p.amount, 0);
            const totalValue = usdcBalance + positionValue;

            const allocations = await this.allocCalculator.calculateTargetAllocations(
                totalValue,
                positions
            );

            const trackingError = this.allocCalculator.calculateTrackingError(allocations);
            const needsRebalance = this.allocCalculator.isRebalanceNeeded(allocations);

            return {
                enabled: this.indexConfig.enabled,
                paused: this.isPaused,
                indexId: this.indexConfig.spmcIndexId,
                portfolioValue: totalValue,
                usdcBalance: usdcBalance,
                positionCount: positions.length,
                trackingError: trackingError,
                needsRebalance: needsRebalance,
                nextRebalance: `${this.indexConfig.rebalanceDay} ${this.indexConfig.rebalanceHour}:00`,
                allocations: allocations.map(a => ({
                    marketId: a.marketId,
                    current: a.currentAmount,
                    target: a.targetAmount,
                    delta: a.delta,
                    action: a.action
                }))
            };
        } catch (error) {
            return { error: `Failed to get status: ${error}` };
        }
    }

    /**
     * Pause automatic rebalancing
     */
    pause(): void {
        this.isPaused = true;
        logger.info("IndexTradingService: Paused automatic rebalancing");
    }

    /**
     * Resume automatic rebalancing
     */
    resume(): void {
        this.isPaused = false;
        logger.info("IndexTradingService: Resumed automatic rebalancing");
    }

    async start(): Promise<void> {
        if (!this.indexConfig.enabled) {
            logger.info("IndexTradingService: Index trading is disabled");
            return;
        }
        logger.info("IndexTradingService: Service started");
    }

    async stop(): Promise<void> {
        if (this.rebalanceTimer) {
            clearInterval(this.rebalanceTimer);
            this.rebalanceTimer = null;
        }
        logger.info("IndexTradingService: Service stopped");
    }
}