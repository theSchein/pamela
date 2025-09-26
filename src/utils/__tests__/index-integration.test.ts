import { describe, it, expect } from 'bun:test';
import { SPMCClient } from '../spmcClient';
import { IndexAllocationCalculator } from '../indexAllocation';

describe('Index Trading Integration', () => {
    it('should fetch LIB OUT index and calculate allocations', async () => {
        // Initialize SPMC client with the LIB OUT index
        const client = new SPMCClient(
            'https://api.spmc.dev',
            '5eee3d9c-6a2a-496a-88b1-591144510c94'
        );
        
        // Fetch index composition
        const index = await client.getIndexComposition();
        expect(index).toBeTruthy();
        expect(index?.name).toContain('LIB');
        expect(index?.markets.length).toBeGreaterThan(0);
        
        console.log(`\nFetched index: ${index?.name}`);
        console.log(`Markets in index: ${index?.markets.length}`);
        
        // Initialize allocation calculator
        const calculator = new IndexAllocationCalculator(client, 10);
        
        // Test with a $1000 portfolio
        const portfolioValue = 1000;
        const currentPositions = []; // Empty portfolio
        
        const allocations = await calculator.calculateTargetAllocations(
            portfolioValue,
            currentPositions
        );
        
        expect(allocations).toBeTruthy();
        expect(allocations.length).toBeGreaterThan(0);
        
        // Check allocations sum to portfolio value (minus min position filtering)
        const totalAllocated = allocations.reduce((sum, a) => sum + a.targetAmount, 0);
        console.log(`\nTotal allocated: $${totalAllocated.toFixed(2)} of $${portfolioValue}`);
        
        // Display top 5 allocations
        console.log('\nTop 5 target allocations:');
        allocations.slice(0, 5).forEach(allocation => {
            const percent = (allocation.targetAmount / portfolioValue * 100).toFixed(2);
            console.log(`  ${allocation.marketId.substring(0, 8)}... : $${allocation.targetAmount.toFixed(2)} (${percent}%)`);
        });
        
        // Test rebalancing decision
        const needsRebalance = calculator.isRebalanceNeeded(allocations);
        console.log(`\nNeeds rebalance: ${needsRebalance}`);
        
        // Generate rebalance orders
        const orders = calculator.generateRebalanceOrders(allocations, portfolioValue);
        console.log(`\nRebalance orders: ${orders.length}`);
        
        const buyOrders = orders.filter(o => o.side === 'BUY');
        const sellOrders = orders.filter(o => o.side === 'SELL');
        console.log(`  Buy orders: ${buyOrders.length}`);
        console.log(`  Sell orders: ${sellOrders.length}`);
        
        // With empty portfolio, all should be buys
        expect(buyOrders.length).toBeGreaterThan(0);
        expect(sellOrders.length).toBe(0);
    });
    
    it('should handle rebalancing with existing positions', async () => {
        const client = new SPMCClient(
            'https://api.spmc.dev',
            '5eee3d9c-6a2a-496a-88b1-591144510c94'
        );
        
        const calculator = new IndexAllocationCalculator(client, 10);
        
        // Simulate existing positions (overweight in first market)
        const index = await client.getIndexComposition();
        const firstMarket = index?.markets[0];
        
        if (!firstMarket) {
            console.log('No markets in index, skipping test');
            return;
        }
        
        const portfolioValue = 1000;
        const currentPositions = [
            {
                marketId: firstMarket.id,
                outcomeId: 'YES',
                amount: 500, // 50% of portfolio in one market (overweight)
                avgPrice: 0.5
            }
        ];
        
        const allocations = await calculator.calculateTargetAllocations(
            portfolioValue,
            currentPositions
        );
        
        // First market should need selling (overweight)
        const firstAllocation = allocations.find(a => a.marketId === firstMarket.id);
        expect(firstAllocation).toBeTruthy();
        expect(firstAllocation?.action).toBe('SELL');
        
        console.log('\nRebalancing scenario:');
        console.log(`First market current: $${firstAllocation?.currentAmount.toFixed(2)}`);
        console.log(`First market target: $${firstAllocation?.targetAmount.toFixed(2)}`);
        console.log(`Action: ${firstAllocation?.action}`);
        
        // Generate orders
        const orders = calculator.generateRebalanceOrders(allocations, 500); // $500 USDC available
        const sellOrders = orders.filter(o => o.side === 'SELL');
        const buyOrders = orders.filter(o => o.side === 'BUY');
        
        expect(sellOrders.length).toBeGreaterThan(0);
        expect(sellOrders[0].marketId).toBe(firstMarket.id);
        
        console.log(`\nSell orders: ${sellOrders.length}`);
        console.log(`Buy orders: ${buyOrders.length}`);
    });
});