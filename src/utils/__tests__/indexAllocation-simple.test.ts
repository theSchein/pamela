import { describe, expect, it } from 'bun:test';
import { IndexAllocationCalculator, Position } from '../indexAllocation';
import type { SPMCIndex } from '../../types/spmc';

describe('IndexAllocationCalculator', () => {
    const calculator = new IndexAllocationCalculator();

    it('should calculate allocations for balanced portfolio', async () => {
        const index: SPMCIndex = {
            id: 'test-index',
            name: 'Test Index',
            members: [
                { marketId: 'market1', weight: 0.5 },
                { marketId: 'market2', weight: 0.5 }
            ]
        };

        const positions: Position[] = [
            { marketId: 'market1', amount: 50, price: 0.5 },
            { marketId: 'market2', amount: 50, price: 0.5 }
        ];

        const result = await calculator.calculateAllocations(
            index,
            100,
            0,
            positions,
            10
        );

        expect(result.needsRebalance).toBe(false);
        expect(result.totalValue).toBe(100);
    });

    it('should identify rebalancing needs', async () => {
        const index: SPMCIndex = {
            id: 'test-index',
            name: 'Test Index',
            members: [
                { marketId: 'market1', weight: 0.6 },
                { marketId: 'market2', weight: 0.4 }
            ]
        };

        const positions: Position[] = [
            { marketId: 'market1', amount: 30, price: 0.5 },
            { marketId: 'market2', amount: 70, price: 0.5 }
        ];

        const result = await calculator.calculateAllocations(
            index,
            100,
            0,
            positions,
            10
        );

        expect(result.needsRebalance).toBe(true);
        
        const market1Alloc = result.allocations.find(a => a.marketId === 'market1');
        expect(market1Alloc?.action).toBe('BUY');
        expect(market1Alloc?.delta).toBeGreaterThan(0);
    });

    it('should handle new markets not in positions', async () => {
        const index: SPMCIndex = {
            id: 'test-index',
            name: 'Test Index',
            members: [
                { marketId: 'market1', weight: 0.5 },
                { marketId: 'market2', weight: 0.3 },
                { marketId: 'market3', weight: 0.2 }
            ]
        };

        const positions: Position[] = [
            { marketId: 'market1', amount: 50, price: 0.5 },
            { marketId: 'market2', amount: 30, price: 0.5 }
        ];

        const result = await calculator.calculateAllocations(
            index,
            100,
            20,
            positions,
            10
        );

        const market3Alloc = result.allocations.find(a => a.marketId === 'market3');
        expect(market3Alloc).toBeDefined();
        expect(market3Alloc?.action).toBe('BUY');
    });

    it('should respect minimum position size', async () => {
        const index: SPMCIndex = {
            id: 'test-index',
            name: 'Test Index',
            members: [
                { marketId: 'market1', weight: 0.95 },
                { marketId: 'market2', weight: 0.05 }
            ]
        };

        const result = await calculator.calculateAllocations(
            index,
            100,
            100,
            [],
            10
        );

        const market2Alloc = result.allocations.find(a => a.marketId === 'market2');
        if (market2Alloc && market2Alloc.action === 'BUY') {
            expect(market2Alloc.targetAmount).toBeGreaterThanOrEqual(10);
        }
    });

    it('should handle markets to exit', async () => {
        const index: SPMCIndex = {
            id: 'test-index',
            name: 'Test Index',
            members: [
                { marketId: 'market1', weight: 1.0 }
            ]
        };

        const positions: Position[] = [
            { marketId: 'market1', amount: 50, price: 0.5 },
            { marketId: 'market2', amount: 50, price: 0.5 }
        ];

        const result = await calculator.calculateAllocations(
            index,
            100,
            0,
            positions,
            10
        );

        const market2Alloc = result.allocations.find(a => a.marketId === 'market2');
        expect(market2Alloc?.action).toBe('SELL');
        expect(market2Alloc?.targetAmount).toBe(0);
    });
});