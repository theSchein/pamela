import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test';
import { IndexTradingService } from '../IndexTradingService';
import type { IAgentRuntime } from '@elizaos/core';
import type { SPMCIndex, SPMCAllocation } from '../../types/spmc';

describe('IndexTradingService', () => {
    let service: IndexTradingService;
    let mockRuntime: IAgentRuntime;
    let mockSpmcClient: SPMCClient;
    let mockAllocCalculator: IndexAllocationCalculator;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Create mock runtime
        mockRuntime = {
            getSetting: vi.fn((key: string) => {
                const settings: Record<string, string> = {
                    'INDEX_TRADING_ENABLED': 'true',
                    'SPMC_API_URL': 'https://api.spmc.dev',
                    'SPMC_INDEX_ID': 'test-index-id',
                    'MIN_INDEX_POSITION': '10',
                    'INDEX_REBALANCE_DAY': 'MONDAY',
                    'INDEX_REBALANCE_HOUR': '9',
                    'MAX_SLIPPAGE': '0.05',
                    'POLYMARKET_PRIVATE_KEY': '0x' + '0'.repeat(64)
                };
                return settings[key];
            }),
            messageManager: {
                createMemory: vi.fn()
            }
        } as any;

        // Create mock SPMC client
        mockSpmcClient = {
            getIndex: vi.fn(),
            close: vi.fn()
        } as any;

        // Create mock allocation calculator
        mockAllocCalculator = {
            calculateAllocations: vi.fn()
        } as any;

        // Setup module mocks to return our instances
        (SPMCClient as any).mockImplementation(() => mockSpmcClient);
        (IndexAllocationCalculator as any).mockImplementation(() => mockAllocCalculator);

        service = new IndexTradingService(mockRuntime);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('initialization', () => {
        it('should initialize when index trading is enabled', async () => {
            await service.initialize(mockRuntime);
            expect(mockRuntime.getSetting).toHaveBeenCalledWith('INDEX_TRADING_ENABLED');
        });

        it('should skip initialization when index trading is disabled', async () => {
            mockRuntime.getSetting = vi.fn(() => 'false');
            await service.initialize(mockRuntime);
            expect(mockSpmcClient.getIndex).not.toHaveBeenCalled();
        });

        it('should handle missing index ID gracefully', async () => {
            mockRuntime.getSetting = vi.fn((key) => {
                if (key === 'SPMC_INDEX_ID') return undefined;
                if (key === 'INDEX_TRADING_ENABLED') return 'true';
                return 'default';
            });
            
            await expect(service.initialize(mockRuntime)).rejects.toThrow();
        });
    });

    describe('getIndexStatus', () => {
        beforeEach(async () => {
            await service.initialize(mockRuntime);
        });

        it('should return index status when properly configured', async () => {
            const mockIndex: SPMCIndex = {
                id: 'test-index-id',
                name: 'Test Index',
                members: [
                    { marketId: 'market1', weight: 0.5 },
                    { marketId: 'market2', weight: 0.5 }
                ]
            };

            mockSpmcClient.getIndex = vi.fn().mockResolvedValue(mockIndex);
            
            const mockAllocations: SPMCAllocation[] = [
                {
                    marketId: 'market1',
                    targetWeight: 0.5,
                    currentWeight: 0.45,
                    targetAmount: 50,
                    currentAmount: 45,
                    delta: 5,
                    action: 'BUY'
                },
                {
                    marketId: 'market2',
                    targetWeight: 0.5,
                    currentWeight: 0.55,
                    targetAmount: 50,
                    currentAmount: 55,
                    delta: -5,
                    action: 'SELL'
                }
            ];

            mockAllocCalculator.calculateAllocations = vi.fn().mockResolvedValue({
                allocations: mockAllocations,
                totalValue: 100,
                needsRebalance: true,
                trackingError: 5.2
            });

            const status = await service.getIndexStatus();

            expect(status.enabled).toBe(true);
            expect(status.indexId).toBe('test-index-id');
            expect(status.allocations).toHaveLength(2);
            expect(status.needsRebalance).toBe(true);
            expect(status.trackingError).toBe(5.2);
        });

        it('should handle errors gracefully', async () => {
            mockSpmcClient.getIndex = vi.fn().mockRejectedValue(new Error('API error'));
            
            const status = await service.getIndexStatus();
            
            expect(status.error).toBe('API error');
            expect(status.enabled).toBe(true);
        });

        it('should return paused status when service is paused', async () => {
            service.pause();
            const status = await service.getIndexStatus();
            
            expect(status.paused).toBe(true);
        });
    });

    describe('syncIndex', () => {
        beforeEach(async () => {
            await service.initialize(mockRuntime);
        });

        it('should successfully sync index when rebalancing is needed', async () => {
            const mockIndex: SPMCIndex = {
                id: 'test-index-id',
                name: 'Test Index',
                members: [
                    { marketId: 'market1', weight: 0.6 },
                    { marketId: 'market2', weight: 0.4 }
                ]
            };

            const mockAllocations: SPMCAllocation[] = [
                {
                    marketId: 'market1',
                    targetWeight: 0.6,
                    currentWeight: 0.5,
                    targetAmount: 60,
                    currentAmount: 50,
                    delta: 10,
                    action: 'BUY'
                }
            ];

            mockSpmcClient.getIndex = vi.fn().mockResolvedValue(mockIndex);
            mockAllocCalculator.calculateAllocations = vi.fn().mockResolvedValue({
                allocations: mockAllocations,
                totalValue: 100,
                needsRebalance: true,
                trackingError: 8.5
            });

            // Mock the trade execution (would normally call Polymarket plugin)
            const result = await service.syncIndex(false);
            
            expect(result.success).toBeDefined();
            expect(mockSpmcClient.getIndex).toHaveBeenCalledWith('test-index-id');
        });

        it('should skip sync when no rebalancing is needed', async () => {
            mockAllocCalculator.calculateAllocations = vi.fn().mockResolvedValue({
                allocations: [],
                totalValue: 100,
                needsRebalance: false,
                trackingError: 1.2
            });

            const result = await service.syncIndex(false);
            
            expect(result.message).toContain('well-balanced');
        });

        it('should prevent concurrent rebalancing', async () => {
            // Start first rebalancing
            const firstRebalance = service.syncIndex(false);
            
            // Try to start second rebalancing
            const secondRebalance = service.syncIndex(false);
            
            const result = await secondRebalance;
            expect(result.error).toContain('already in progress');
        });

        it('should respect pause state', async () => {
            service.pause();
            const result = await service.syncIndex(false);
            
            expect(result.error).toContain('paused');
        });
    });

    describe('scheduling', () => {
        it('should calculate next rebalance time correctly', () => {
            const nextRebalance = service.getNextRebalanceTime();
            const now = new Date();
            
            expect(nextRebalance).toBeInstanceOf(Date);
            expect(nextRebalance.getTime()).toBeGreaterThanOrEqual(now.getTime());
        });

        it('should schedule rebalancing on specified day and hour', async () => {
            const spy = vi.spyOn(global, 'setTimeout');
            await service.initialize(mockRuntime);
            await service.start();
            
            expect(spy).toHaveBeenCalled();
            const delay = spy.mock.calls[0][1];
            expect(typeof delay).toBe('number');
            expect(delay).toBeGreaterThan(0);
        });
    });

    describe('pause and resume', () => {
        beforeEach(async () => {
            await service.initialize(mockRuntime);
        });

        it('should pause service', () => {
            service.pause();
            expect(service.isPaused).toBe(true);
        });

        it('should resume service', () => {
            service.pause();
            service.resume();
            expect(service.isPaused).toBe(false);
        });

        it('should not execute rebalancing when paused', async () => {
            service.pause();
            const result = await service.syncIndex(false);
            expect(result.error).toContain('paused');
        });
    });

    describe('error handling', () => {
        beforeEach(async () => {
            await service.initialize(mockRuntime);
        });

        it('should handle SPMC API errors', async () => {
            mockSpmcClient.getIndex = vi.fn().mockRejectedValue(new Error('Network error'));
            
            const result = await service.syncIndex(false);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Network error');
        });

        it('should handle invalid allocations', async () => {
            mockAllocCalculator.calculateAllocations = vi.fn().mockResolvedValue({
                allocations: null,
                error: 'Invalid portfolio data'
            });

            const result = await service.syncIndex(false);
            expect(result.success).toBeFalsy();
        });

        it('should handle missing configuration gracefully', async () => {
            mockRuntime.getSetting = vi.fn(() => undefined);
            const newService = new IndexTradingService(mockRuntime);
            
            await expect(newService.initialize(mockRuntime)).rejects.toThrow();
        });
    });

    describe('cleanup', () => {
        it('should clean up resources on stop', async () => {
            await service.initialize(mockRuntime);
            await service.start();
            await service.stop();
            
            expect(mockSpmcClient.close).toHaveBeenCalled();
        });

        it('should clear timers on stop', async () => {
            const spy = vi.spyOn(global, 'clearInterval');
            await service.initialize(mockRuntime);
            await service.start();
            await service.stop();
            
            expect(spy).toHaveBeenCalled();
        });
    });
});