import { describe, expect, it, beforeEach } from 'bun:test';
import { IndexAllocationCalculator, Position } from '../indexAllocation';
import type { SPMCIndex, SPMCAllocation } from '../../types/spmc';

describe('IndexAllocationCalculator', () => {
    let calculator: IndexAllocationCalculator;
    
    beforeEach(() => {
        calculator = new IndexAllocationCalculator();
    });

    describe('calculateAllocations', () => {
        it('should calculate correct allocations for balanced portfolio', async () => {
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
                100,  // totalBalance
                0,    // availableBalance
                positions,
                10    // minPositionSize
            );

            expect(result.needsRebalance).toBe(false);
            expect(result.trackingError).toBeLessThan(1);
            expect(result.totalValue).toBe(100);
        });

        it('should identify rebalancing needs for unbalanced portfolio', async () => {
            const index: SPMCIndex = {
                id: 'test-index',
                name: 'Test Index',
                members: [
                    { marketId: 'market1', weight: 0.6 },
                    { marketId: 'market2', weight: 0.4 }
                ]
            };

            const positions: Position[] = [
                { marketId: 'market1', amount: 30, price: 0.5 },  // Should be 60
                { marketId: 'market2', amount: 70, price: 0.5 }   // Should be 40
            ];

            const result = await calculator.calculateAllocations(
                index,
                100,
                0,
                positions,
                10
            );

            expect(result.needsRebalance).toBe(true);
            expect(result.allocations.length).toBeGreaterThan(0);
            
            const market1Alloc = result.allocations.find(a => a.marketId === 'market1');
            const market2Alloc = result.allocations.find(a => a.marketId === 'market2');
            
            expect(market1Alloc?.action).toBe('BUY');
            expect(market1Alloc?.delta).toBeGreaterThan(0);
            expect(market2Alloc?.action).toBe('SELL');
            expect(market2Alloc?.delta).toBeLessThan(0);
        });

        it('should handle new markets not in current positions', async () => {
            const index: SPMCIndex = {
                id: 'test-index',
                name: 'Test Index',
                members: [
                    { marketId: 'market1', weight: 0.5 },
                    { marketId: 'market2', weight: 0.3 },
                    { marketId: 'market3', weight: 0.2 }  // New market
                ]
            };

            const positions: Position[] = [
                { marketId: 'market1', amount: 50, price: 0.5 },
                { marketId: 'market2', amount: 30, price: 0.5 }
            ];

            const result = await calculator.calculateAllocations(
                index,
                100,
                20,  // availableBalance for new position
                positions,
                10
            );

            const market3Alloc = result.allocations.find(a => a.marketId === 'market3');
            expect(market3Alloc).toBeDefined();
            expect(market3Alloc?.action).toBe('BUY');
            expect(market3Alloc?.targetAmount).toBe(20);
        });

        it('should respect minimum position size', async () => {
            const index: SPMCIndex = {
                id: 'test-index',
                name: 'Test Index',
                members: [
                    { marketId: 'market1', weight: 0.95 },
                    { marketId: 'market2', weight: 0.05 }  // Would be $5, below minimum
                ]
            };

            const positions: Position[] = [];

            const result = await calculator.calculateAllocations(
                index,
                100,
                100,
                positions,
                10  // minPositionSize
            );

            const market2Alloc = result.allocations.find(a => a.marketId === 'market2');
            
            // Should skip market2 or adjust to minimum
            if (market2Alloc && market2Alloc.action === 'BUY') {
                expect(market2Alloc.targetAmount).toBeGreaterThanOrEqual(10);
            }
        });

        it('should handle markets to exit (not in index anymore)', async () => {
            const index: SPMCIndex = {
                id: 'test-index',
                name: 'Test Index',
                members: [
                    { marketId: 'market1', weight: 1.0 }
                ]
            };

            const positions: Position[] = [
                { marketId: 'market1', amount: 50, price: 0.5 },
                { marketId: 'market2', amount: 50, price: 0.5 }  // Not in index
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
            expect(market2Alloc?.delta).toBe(-50);
        });

        it('should calculate tracking error correctly', async () => {
            const index: SPMCIndex = {
                id: 'test-index',
                name: 'Test Index',
                members: [
                    { marketId: 'market1', weight: 0.7 },
                    { marketId: 'market2', weight: 0.3 }
                ]
            };

            const positions: Position[] = [
                { marketId: 'market1', amount: 60, price: 0.5 },  // 60% instead of 70%
                { marketId: 'market2', amount: 40, price: 0.5 }   // 40% instead of 30%
            ];

            const result = await calculator.calculateAllocations(
                index,
                100,
                0,
                positions,
                10
            );

            // Tracking error should be sqrt(0.1^2 + 0.1^2) * 100 ≈ 14.14%
            expect(result.trackingError).toBeCloseTo(14.14, 1);
        });

        it('should handle empty index', async () => {
            const index: SPMCIndex = {
                id: 'test-index',
                name: 'Empty Index',
                members: []
            };

            const positions: Position[] = [
                { marketId: 'market1', amount: 100, price: 0.5 }
            ];

            const result = await calculator.calculateAllocations(
                index,
                100,
                0,
                positions,
                10
            );

            // Should sell all positions
            expect(result.allocations[0]?.action).toBe('SELL');
            expect(result.allocations[0]?.targetAmount).toBe(0);
        });

        it('should handle zero total balance', async () => {
            const index: SPMCIndex = {
                id: 'test-index',
                name: 'Test Index',
                members: [
                    { marketId: 'market1', weight: 0.5 },
                    { marketId: 'market2', weight: 0.5 }
                ]
            };

            const result = await calculator.calculateAllocations(
                index,
                0,  // Zero balance
                0,
                [],
                10
            );

            expect(result.allocations).toHaveLength(0);
            expect(result.needsRebalance).toBe(false);
        });

        it('should normalize weights if they dont sum to 1', async () => {
            const index: SPMCIndex = {
                id: 'test-index',
                name: 'Test Index',
                members: [
                    { marketId: 'market1', weight: 0.3 },
                    { marketId: 'market2', weight: 0.2 }  // Sum = 0.5
                ]
            };

            const result = await calculator.calculateAllocations(
                index,
                100,
                100,
                [],
                10
            );

            const totalTargetAmount = result.allocations
                .filter(a => a.action === 'BUY')
                .reduce((sum, a) => sum + a.targetAmount, 0);
            
            // Should allocate the full balance
            expect(totalTargetAmount).toBeCloseTo(100, 1);
            
            // Check normalized weights
            const market1Alloc = result.allocations.find(a => a.marketId === 'market1');
            const market2Alloc = result.allocations.find(a => a.marketId === 'market2');
            
            expect(market1Alloc?.targetWeight).toBeCloseTo(0.6, 2);  // 0.3/0.5
            expect(market2Alloc?.targetWeight).toBeCloseTo(0.4, 2);  // 0.2/0.5
        });
    });

    describe('edge cases', () => {
        it('should handle very small allocations', async () => {
            const index: SPMCIndex = {
                id: 'test-index',
                name: 'Test Index',
                members: [
                    { marketId: 'market1', weight: 0.99 },
                    { marketId: 'market2', weight: 0.01 }  // 1% allocation
                ]
            };

            const result = await calculator.calculateAllocations(
                index,
                1000,  // $1000 total
                1000,
                [],
                10  // $10 minimum
            );

            const market2Alloc = result.allocations.find(a => a.marketId === 'market2');
            
            // Should either skip or set to minimum
            if (market2Alloc?.action === 'BUY') {
                expect(market2Alloc.targetAmount).toBeGreaterThanOrEqual(10);
            }
        });

        it('should handle rounding errors gracefully', async () => {
            const index: SPMCIndex = {
                id: 'test-index',
                name: 'Test Index',
                members: [
                    { marketId: 'market1', weight: 0.333333 },
                    { marketId: 'market2', weight: 0.333333 },
                    { marketId: 'market3', weight: 0.333334 }
                ]
            };

            const result = await calculator.calculateAllocations(
                index,
                100,
                100,
                [],
                10
            );

            const totalAllocated = result.allocations
                .filter(a => a.action === 'BUY')
                .reduce((sum, a) => sum + a.targetAmount, 0);
            
            // Should be very close to total balance
            expect(Math.abs(totalAllocated - 100)).toBeLessThan(1);
        });

        it('should handle positions with zero amount', async () => {
            const index: SPMCIndex = {
                id: 'test-index',
                name: 'Test Index',
                members: [
                    { marketId: 'market1', weight: 1.0 }
                ]
            };

            const positions: Position[] = [
                { marketId: 'market1', amount: 0, price: 0.5 }  // Zero amount
            ];

            const result = await calculator.calculateAllocations(
                index,
                100,
                100,
                positions,
                10
            );

            const market1Alloc = result.allocations.find(a => a.marketId === 'market1');
            expect(market1Alloc?.action).toBe('BUY');
            expect(market1Alloc?.targetAmount).toBe(100);
        });
    });

    describe('formatAllocationReport', () => {
        it('should format allocation report correctly', () => {
            const allocations: SPMCAllocation[] = [
                {
                    marketId: 'market1',
                    targetWeight: 0.6,
                    currentWeight: 0.5,
                    targetAmount: 60,
                    currentAmount: 50,
                    delta: 10,
                    action: 'BUY'
                },
                {
                    marketId: 'market2',
                    targetWeight: 0.4,
                    currentWeight: 0.5,
                    targetAmount: 40,
                    currentAmount: 50,
                    delta: -10,
                    action: 'SELL'
                }
            ];

            const report = calculator.formatAllocationReport(allocations, 100, 5.5);
            
            expect(report).toContain('Index Allocation Report');
            expect(report).toContain('Total Value: $100.00');
            expect(report).toContain('Tracking Error: 5.50%');
            expect(report).toContain('BUY');
            expect(report).toContain('SELL');
            expect(report).toContain('market1');
            expect(report).toContain('market2');
        });

        it('should handle empty allocations', () => {
            const report = calculator.formatAllocationReport([], 0, 0);
            
            expect(report).toContain('No allocations');
        });
    });
});