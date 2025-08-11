import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';

// Import after mocks
import { getPortfolioPositionsAction } from '../../../../src/actions/getPortfolioPositions';
import * as clobClient from '../../../../src/utils/clobClient';

// Mock the CLOB client
mock.module('../../../../src/utils/clobClient', () => ({
    initializeClobClient: mock(),
}));

describe('getPortfolioPositions Action', () => {
    let mockRuntime: IAgentRuntime;
    let mockCallback: HandlerCallback;
    let mockMemory: Memory;
    let mockState: State;
    let mockClient: any;

    beforeEach(() => {
        // Setup mock runtime with settings
        mockRuntime = {
            getSetting: mock((key: string) => {
                const settings: Record<string, string> = {
                    WALLET_PRIVATE_KEY: '0x' + '0'.repeat(64),
                    CLOB_API_URL: 'https://clob.polymarket.com',
                };
                return settings[key];
            }),
            character: {
                settings: {
                    secrets: {
                        WALLET_PRIVATE_KEY: '0x' + '0'.repeat(64),
                    },
                },
            },
        } as any;

        mockCallback = mock();
        
        mockMemory = {
            userId: 'user-123',
            agentId: 'agent-123',
            roomId: 'room-123',
            content: { text: 'show my portfolio' },
        } as Memory;

        mockState = {} as State;

        // Setup mock CLOB client
        mockClient = {
            getOpenPositions: mock(),
            getMappedMetadata: mock(),
            wallet: {
                address: '0x1234567890123456789012345678901234567890'
            }
        };

        (clobClient.initializeClobClient as any).mockResolvedValue(mockClient);
    });

    afterEach(() => {
        // Reset individual mocks
        (mockRuntime.getSetting as any)?.mockReset?.();
        (clobClient.initializeClobClient as any)?.mockReset?.();
        (mockClient.getOpenPositions as any)?.mockReset?.();
        (mockClient.getMappedMetadata as any)?.mockReset?.();
        (mockCallback as any)?.mockReset?.();
    });

    describe('validate', () => {
        it('should pass validation when wallet is configured', async () => {
            const result = await getPortfolioPositionsAction.validate(mockRuntime, mockMemory, mockState);
            expect(result).toBe(true);
        });

        it('should fail validation when no wallet key is configured', async () => {
            mockRuntime.getSetting = mock(() => undefined);
            
            const result = await getPortfolioPositionsAction.validate(mockRuntime, mockMemory, mockState);
            expect(result).toBe(false);
        });
    });

    describe('handler', () => {
        describe('successful portfolio retrieval', () => {
            it('should return portfolio with positions', async () => {
                const mockPositions = [
                    {
                        conditionId: '0x123abc',
                        outcomeId: 0,
                        shares: '100',
                        avgPrice: '0.5',
                        realized: '0',
                        unrealized: '10.5',
                    },
                    {
                        conditionId: '0x456def',
                        outcomeId: 1,
                        shares: '50',
                        avgPrice: '0.75',
                        realized: '5.25',
                        unrealized: '-2.5',
                    },
                ];

                const mockMetadata = {
                    '0x123abc': {
                        question: 'Will Bitcoin reach $100k?',
                        outcomes: ['YES', 'NO'],
                        endDate: '2025-12-31',
                    },
                    '0x456def': {
                        question: 'Will AI replace developers?',
                        outcomes: ['YES', 'NO'],
                        endDate: '2025-06-30',
                    },
                };

                mockClient.getOpenPositions.mockResolvedValue(mockPositions);
                mockClient.getMappedMetadata.mockResolvedValue(mockMetadata);

                const result = await getPortfolioPositionsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(true);
                expect(mockCallback).toHaveBeenCalled();
                
                const callbackContent = mockCallback.mock.calls[0][0];
                expect(callbackContent.text).toContain('Portfolio Positions');
                expect(callbackContent.text).toContain('Will Bitcoin reach $100k?');
                expect(callbackContent.text).toContain('100 shares');
                expect(callbackContent.data).toHaveProperty('positions');
                expect(callbackContent.data.positions).toHaveLength(2);
            });

            it('should handle empty portfolio', async () => {
                mockClient.getOpenPositions.mockResolvedValue([]);
                mockClient.getMappedMetadata.mockResolvedValue({});

                const result = await getPortfolioPositionsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(true);
                const callbackContent = mockCallback.mock.calls[0][0];
                expect(callbackContent.text).toContain('No open positions');
                expect(callbackContent.data.positions).toHaveLength(0);
            });

            it('should calculate P&L correctly', async () => {
                const mockPositions = [
                    {
                        conditionId: '0x123abc',
                        outcomeId: 0,
                        shares: '100',
                        avgPrice: '0.5',
                        realized: '10', // Realized profit
                        unrealized: '20', // Unrealized profit
                    },
                ];

                const mockMetadata = {
                    '0x123abc': {
                        question: 'Test Market',
                        outcomes: ['YES', 'NO'],
                        endDate: '2025-12-31',
                        currentPrice: '0.7', // Current price higher than avg
                    },
                };

                mockClient.getOpenPositions.mockResolvedValue(mockPositions);
                mockClient.getMappedMetadata.mockResolvedValue(mockMetadata);

                const result = await getPortfolioPositionsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                const callbackContent = mockCallback.mock.calls[0][0];
                const position = callbackContent.data.positions[0];
                
                expect(position.realizedPnL).toBe('10');
                expect(position.unrealizedPnL).toBe('20');
                expect(position.totalPnL).toBe('30'); // Total should be realized + unrealized
            });

            it('should format large numbers correctly', async () => {
                const mockPositions = [
                    {
                        conditionId: '0x123abc',
                        outcomeId: 0,
                        shares: '1000000', // 1 million shares
                        avgPrice: '0.999',
                        realized: '1234.56',
                        unrealized: '-5678.90',
                    },
                ];

                const mockMetadata = {
                    '0x123abc': {
                        question: 'Large Position Market',
                        outcomes: ['YES', 'NO'],
                    },
                };

                mockClient.getOpenPositions.mockResolvedValue(mockPositions);
                mockClient.getMappedMetadata.mockResolvedValue(mockMetadata);

                const result = await getPortfolioPositionsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                const callbackContent = mockCallback.mock.calls[0][0];
                expect(callbackContent.text).toContain('1000000 shares'); // Should format large numbers
                expect(callbackContent.text).toContain('$0.999'); // Price formatting
            });
        });

        describe('error handling', () => {
            it('should handle API errors gracefully', async () => {
                mockClient.getOpenPositions.mockRejectedValue(new Error('API request failed'));

                const result = await getPortfolioPositionsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(false);
                const callbackContent = mockCallback.mock.calls[0][0];
                expect(callbackContent.text).toContain('Failed to retrieve portfolio');
                expect(callbackContent.text).toContain('API request failed');
            });

            it('should handle client initialization errors', async () => {
                (clobClient.initializeClobClient as any).mockRejectedValue(
                    new Error('Failed to initialize client')
                );

                const result = await getPortfolioPositionsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(false);
                const callbackContent = mockCallback.mock.calls[0][0];
                expect(callbackContent.text).toContain('Failed to initialize');
            });

            it('should handle missing metadata gracefully', async () => {
                const mockPositions = [
                    {
                        conditionId: '0x123abc',
                        outcomeId: 0,
                        shares: '100',
                        avgPrice: '0.5',
                    },
                ];

                mockClient.getOpenPositions.mockResolvedValue(mockPositions);
                mockClient.getMappedMetadata.mockResolvedValue({}); // No metadata

                const result = await getPortfolioPositionsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(true);
                const callbackContent = mockCallback.mock.calls[0][0];
                const position = callbackContent.data.positions[0];
                
                expect(position.marketQuestion).toBe('Unknown Market'); // Should have default
                expect(position.outcome).toBe('Outcome 0'); // Default outcome name
            });

            it('should handle network timeout', async () => {
                mockClient.getOpenPositions.mockImplementation(() => 
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Request timeout')), 100)
                    )
                );

                const result = await getPortfolioPositionsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(false);
                const callbackContent = mockCallback.mock.calls[0][0];
                expect(callbackContent.text).toContain('timeout');
            });
        });

        describe('edge cases', () => {
            it('should handle positions with zero shares', async () => {
                const mockPositions = [
                    {
                        conditionId: '0x123abc',
                        outcomeId: 0,
                        shares: '0',
                        avgPrice: '0.5',
                        realized: '10',
                        unrealized: '0',
                    },
                ];

                mockClient.getOpenPositions.mockResolvedValue(mockPositions);
                mockClient.getMappedMetadata.mockResolvedValue({});

                const result = await getPortfolioPositionsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                const callbackContent = mockCallback.mock.calls[0][0];
                // Should filter out or handle zero-share positions
                expect(callbackContent.data.positions).toHaveLength(1);
                expect(callbackContent.data.positions[0].shares).toBe('0');
            });

            it('should handle negative P&L values', async () => {
                const mockPositions = [
                    {
                        conditionId: '0x123abc',
                        outcomeId: 0,
                        shares: '100',
                        avgPrice: '0.8',
                        realized: '-50',
                        unrealized: '-20',
                    },
                ];

                mockClient.getOpenPositions.mockResolvedValue(mockPositions);
                mockClient.getMappedMetadata.mockResolvedValue({
                    '0x123abc': {
                        question: 'Losing Position',
                        outcomes: ['YES', 'NO'],
                    },
                });

                const result = await getPortfolioPositionsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                const callbackContent = mockCallback.mock.calls[0][0];
                expect(callbackContent.text).toContain('-$50'); // Should show negative values
                expect(callbackContent.text).toContain('-$20');
                expect(callbackContent.data.positions[0].totalPnL).toBe('-70');
            });

            it('should handle very small decimal values', async () => {
                const mockPositions = [
                    {
                        conditionId: '0x123abc',
                        outcomeId: 0,
                        shares: '1',
                        avgPrice: '0.00001',
                        realized: '0.000001',
                        unrealized: '0.000002',
                    },
                ];

                mockClient.getOpenPositions.mockResolvedValue(mockPositions);
                mockClient.getMappedMetadata.mockResolvedValue({});

                const result = await getPortfolioPositionsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(true);
                const callbackContent = mockCallback.mock.calls[0][0];
                const position = callbackContent.data.positions[0];
                // Should handle very small numbers without scientific notation
                expect(position.avgPrice).toContain('0.00001');
            });
        });
    });

    describe('examples', () => {
        it('should have valid example messages', () => {
            expect(getPortfolioPositionsAction.examples).toBeDefined();
            expect(Array.isArray(getPortfolioPositionsAction.examples)).toBe(true);
            expect(getPortfolioPositionsAction.examples.length).toBeGreaterThan(0);
            
            getPortfolioPositionsAction.examples.forEach(example => {
                expect(Array.isArray(example)).toBe(true);
                expect(example.length).toBeGreaterThanOrEqual(2);
                
                const [userMsg] = example;
                expect(userMsg).toHaveProperty('user');
                expect(userMsg).toHaveProperty('content');
                expect(userMsg.content).toHaveProperty('text');
            });
        });
    });

    describe('metadata', () => {
        it('should have correct action metadata', () => {
            expect(getPortfolioPositionsAction.name).toBe('GET_PORTFOLIO_POSITIONS');
            expect(getPortfolioPositionsAction.description).toBeDefined();
            expect(getPortfolioPositionsAction.similes).toBeDefined();
            expect(Array.isArray(getPortfolioPositionsAction.similes)).toBe(true);
        });
    });
});