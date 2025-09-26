import { logger } from "@elizaos/core";
import { SPMCClient } from "./spmcClient";

export interface Position {
    marketId: string;
    outcomeId: string;
    amount: number; // Current position size in USDC
    avgPrice: number;
    title?: string;
}

export interface AllocationTarget {
    marketId: string;
    targetAmount: number; // Target position size in USDC
    currentAmount: number; // Current position size
    delta: number; // Amount to buy/sell (positive = buy, negative = sell)
    weight: number; // Index weight (0-1)
    action: 'BUY' | 'SELL' | 'HOLD';
}

export interface RebalanceOrder {
    marketId: string;
    outcomeId: string; // YES outcome for all index positions
    side: 'BUY' | 'SELL';
    amount: number; // USDC amount
    estimatedShares?: number;
    reason: string;
}

export class IndexAllocationCalculator {
    private spmcClient: SPMCClient;
    private minPositionSize: number;

    constructor(spmcClient: SPMCClient, minPositionSize: number = 10) {
        this.spmcClient = spmcClient;
        this.minPositionSize = minPositionSize;
    }

    /**
     * Calculate target allocations based on index weights and available balance
     * @param totalBalance Total USDC available (including current positions)
     * @param currentPositions Current positions in the portfolio
     * @returns Array of allocation targets
     */
    async calculateTargetAllocations(
        totalBalance: number,
        currentPositions: Position[]
    ): Promise<AllocationTarget[]> {
        const index = await this.spmcClient.getIndexComposition();
        if (!index || index.markets.length === 0) {
            logger.error("IndexAllocation", "No index composition available");
            return [];
        }

        const allocations: AllocationTarget[] = [];

        // Create a map of current positions for quick lookup
        const positionMap = new Map<string, number>();
        currentPositions.forEach(pos => {
            positionMap.set(pos.marketId, pos.amount);
        });

        // Calculate target allocation for each market in the index
        for (const market of index.markets) {
            const targetAmount = totalBalance * market.weight;
            const currentAmount = positionMap.get(market.id) || 0;
            const delta = targetAmount - currentAmount;

            // Determine action based on delta and minimum position size
            let action: 'BUY' | 'SELL' | 'HOLD';
            if (Math.abs(delta) < this.minPositionSize) {
                action = 'HOLD'; // Too small to trade
            } else if (delta > 0) {
                action = 'BUY';
            } else {
                action = 'SELL';
            }

            allocations.push({
                marketId: market.id,
                targetAmount,
                currentAmount,
                delta,
                weight: market.weight,
                action
            });
        }

        // Handle positions not in the index (should be sold)
        for (const position of currentPositions) {
            if (!index.markets.find(m => m.id === position.marketId)) {
                allocations.push({
                    marketId: position.marketId,
                    targetAmount: 0,
                    currentAmount: position.amount,
                    delta: -position.amount,
                    weight: 0,
                    action: 'SELL'
                });
            }
        }

        // Sort by absolute delta (largest trades first)
        allocations.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

        logger.info("IndexAllocation", 
            `Calculated ${allocations.length} allocation targets, ` +
            `${allocations.filter(a => a.action !== 'HOLD').length} require action`);

        return allocations;
    }

    /**
     * Generate rebalance orders from allocation targets
     * @param allocations Target allocations
     * @param availableUSDC Available USDC for buying
     * @param marketPrices Optional map of market prices for share estimation
     * @returns Array of rebalance orders
     */
    generateRebalanceOrders(
        allocations: AllocationTarget[],
        availableUSDC: number,
        marketPrices?: Map<string, number>
    ): RebalanceOrder[] {
        const orders: RebalanceOrder[] = [];
        let remainingUSDC = availableUSDC;

        // First, generate all SELL orders (to free up capital)
        const sellAllocations = allocations.filter(a => a.action === 'SELL');
        for (const alloc of sellAllocations) {
            const order: RebalanceOrder = {
                marketId: alloc.marketId,
                outcomeId: 'YES', // Always YES for index positions
                side: 'SELL',
                amount: Math.abs(alloc.delta),
                reason: alloc.weight === 0 ? 
                    'Market removed from index' : 
                    `Rebalancing to target weight ${(alloc.weight * 100).toFixed(1)}%`
            };

            if (marketPrices?.has(alloc.marketId)) {
                const price = marketPrices.get(alloc.marketId)!;
                order.estimatedShares = order.amount / price;
            }

            orders.push(order);
            remainingUSDC += Math.abs(alloc.delta); // Add freed capital
        }

        // Then, generate BUY orders (using available capital)
        const buyAllocations = allocations.filter(a => a.action === 'BUY');
        for (const alloc of buyAllocations) {
            const buyAmount = Math.min(Math.abs(alloc.delta), remainingUSDC);
            
            if (buyAmount < this.minPositionSize) {
                logger.debug("IndexAllocation", 
                    `Skipping buy for ${alloc.marketId}: amount ${buyAmount} below minimum`);
                continue;
            }

            const order: RebalanceOrder = {
                marketId: alloc.marketId,
                outcomeId: 'YES', // Always YES for index positions
                side: 'BUY',
                amount: buyAmount,
                reason: `Rebalancing to target weight ${(alloc.weight * 100).toFixed(1)}%`
            };

            if (marketPrices?.has(alloc.marketId)) {
                const price = marketPrices.get(alloc.marketId)!;
                order.estimatedShares = order.amount / price;
            }

            orders.push(order);
            remainingUSDC -= buyAmount;

            if (remainingUSDC < this.minPositionSize) {
                logger.debug("IndexAllocation", 
                    "Insufficient USDC remaining for more purchases");
                break;
            }
        }

        logger.info("IndexAllocation", 
            `Generated ${orders.length} rebalance orders: ` +
            `${orders.filter(o => o.side === 'SELL').length} sells, ` +
            `${orders.filter(o => o.side === 'BUY').length} buys`);

        return orders;
    }

    /**
     * Calculate the tracking error between current and target allocations
     * @param allocations Current allocation targets
     * @returns Tracking error as a percentage (0-100)
     */
    calculateTrackingError(allocations: AllocationTarget[]): number {
        if (allocations.length === 0) return 0;

        const totalValue = allocations.reduce((sum, a) => 
            sum + a.currentAmount + a.targetAmount, 0) / 2;

        if (totalValue === 0) return 0;

        const squaredErrors = allocations.map(a => {
            const currentWeight = a.currentAmount / totalValue;
            const targetWeight = a.weight;
            return Math.pow(currentWeight - targetWeight, 2);
        });

        const meanSquaredError = squaredErrors.reduce((sum, e) => sum + e, 0) / 
            allocations.length;

        const trackingError = Math.sqrt(meanSquaredError) * 100;

        return trackingError;
    }

    /**
     * Check if rebalancing is needed based on tracking error threshold
     * @param allocations Current allocation targets
     * @param threshold Tracking error threshold (default 5%)
     * @returns true if rebalancing is needed
     */
    isRebalanceNeeded(
        allocations: AllocationTarget[], 
        threshold: number = 5
    ): boolean {
        const trackingError = this.calculateTrackingError(allocations);
        const hasSignificantTrades = allocations.some(a => 
            a.action !== 'HOLD' && Math.abs(a.delta) >= this.minPositionSize * 2
        );

        return trackingError > threshold || hasSignificantTrades;
    }

    /**
     * Get a summary of the current vs target allocations
     * @param allocations Allocation targets
     * @returns Formatted summary string
     */
    getAllocationSummary(allocations: AllocationTarget[]): string {
        const totalCurrent = allocations.reduce((sum, a) => sum + a.currentAmount, 0);
        const totalTarget = allocations.reduce((sum, a) => sum + a.targetAmount, 0);
        const trackingError = this.calculateTrackingError(allocations);

        const lines = [
            `Index Allocation Summary`,
            `========================`,
            `Total Portfolio Value: $${totalCurrent.toFixed(2)}`,
            `Target Portfolio Value: $${totalTarget.toFixed(2)}`,
            `Tracking Error: ${trackingError.toFixed(2)}%`,
            ``,
            `Positions requiring action:`
        ];

        const actionableAllocations = allocations.filter(a => a.action !== 'HOLD');
        
        if (actionableAllocations.length === 0) {
            lines.push("  None - portfolio is balanced");
        } else {
            for (const alloc of actionableAllocations) {
                const deltaStr = alloc.delta > 0 ? 
                    `+$${alloc.delta.toFixed(2)}` : 
                    `-$${Math.abs(alloc.delta).toFixed(2)}`;
                lines.push(
                    `  ${alloc.marketId.substring(0, 8)}: ` +
                    `${alloc.action} ${deltaStr} ` +
                    `(${(alloc.weight * 100).toFixed(1)}% target)`
                );
            }
        }

        return lines.join('\n');
    }
}