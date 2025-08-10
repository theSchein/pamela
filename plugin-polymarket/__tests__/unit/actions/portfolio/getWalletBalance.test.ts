import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getWalletBalanceAction } from '../../../../src/actions/getWalletBalance';
import { IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import * as balanceChecker from '../../../../src/utils/balanceChecker';
import * as actionHelpers from '../../../../src/utils/actionHelpers';

// Mock the balance checker utilities
vi.mock('../../../../src/utils/balanceChecker', () => ({
    checkPolymarketBalance: vi.fn(),
    checkUSDCBalance: vi.fn(),
    formatBalanceInfo: vi.fn(),
    getMaxPositionSize: vi.fn(),
}));

// Mock action helpers
vi.mock('../../../../src/utils/actionHelpers', () => ({
    contentToActionResult: vi.fn((content) => ({
        success: true,
        content,
    })),
    createErrorResult: vi.fn((error) => ({
        success: false,
        error,
    })),
}));

describe('getWalletBalance Action', () => {
    let mockRuntime: IAgentRuntime;
    let mockCallback: HandlerCallback;
    let mockMemory: Memory;
    let mockState: State;

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Setup mock runtime with settings
        mockRuntime = {
            getSetting: vi.fn((key: string) => {
                const settings: Record<string, string> = {
                    WALLET_PRIVATE_KEY: '0x' + '0'.repeat(64),
                    MAX_POSITION_SIZE: '100',
                    MIN_CONFIDENCE_THRESHOLD: '0.7',
                    TRADING_ENABLED: 'true',
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

        mockCallback = vi.fn();
        
        mockMemory = {
            userId: 'user-123',
            agentId: 'agent-123',
            roomId: 'room-123',
            content: { text: 'check my balance' },
        } as Memory;

        mockState = {} as State;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('validate', () => {
        it('should pass validation when wallet private key is configured', async () => {
            const result = await getWalletBalanceAction.validate(mockRuntime, mockMemory, mockState);
            expect(result).toBe(true);
        });

        it('should fail validation when no wallet key is configured', async () => {
            mockRuntime.getSetting = vi.fn(() => undefined);
            
            const result = await getWalletBalanceAction.validate(mockRuntime, mockMemory, mockState);
            expect(result).toBe(false);
        });

        it('should check multiple wallet key settings in order', async () => {
            const getSetting = vi.fn()
                .mockReturnValueOnce(undefined) // WALLET_PRIVATE_KEY
                .mockReturnValueOnce(undefined) // PRIVATE_KEY
                .mockReturnValueOnce('0xkey')   // POLYMARKET_PRIVATE_KEY
                .mockReturnValueOnce(undefined); // EVM_PRIVATE_KEY
            
            mockRuntime.getSetting = getSetting;
            
            const result = await getWalletBalanceAction.validate(mockRuntime, mockMemory, mockState);
            expect(result).toBe(true);
            expect(getSetting).toHaveBeenCalledWith('WALLET_PRIVATE_KEY');
            expect(getSetting).toHaveBeenCalledWith('PRIVATE_KEY');
            expect(getSetting).toHaveBeenCalledWith('POLYMARKET_PRIVATE_KEY');
        });
    });

    describe('handler', () => {
        describe('successful balance check', () => {
            it('should return formatted balance with trading limits', async () => {
                const mockBalanceInfo = {
                    address: '0x1234567890123456789012345678901234567890',
                    usdcBalance: '500.50',
                    usdcBalanceRaw: '500500000',
                    hasEnoughBalance: true,
                    requiredAmount: '0',
                };

                vi.mocked(balanceChecker.checkPolymarketBalance).mockResolvedValue(mockBalanceInfo);

                const result = await getWalletBalanceAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(true);
                expect(mockCallback).toHaveBeenCalled();
                
                const callbackContent = mockCallback.mock.calls[0][0];
                expect(callbackContent.text).toContain('500.50');
                expect(callbackContent.text).toContain('Trading Balance');
                expect(callbackContent.text).toContain('Ready for Trading');
                expect(callbackContent.data).toHaveProperty('balanceInfo');
                expect(callbackContent.data).toHaveProperty('tradingLimits');
            });

            it('should handle zero balance correctly', async () => {
                const mockBalanceInfo = {
                    address: '0x1234567890123456789012345678901234567890',
                    usdcBalance: '0.00',
                    usdcBalanceRaw: '0',
                    hasEnoughBalance: false,
                    requiredAmount: '0',
                };

                vi.mocked(balanceChecker.checkPolymarketBalance).mockResolvedValue(mockBalanceInfo);

                const result = await getWalletBalanceAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(true);
                const callbackContent = mockCallback.mock.calls[0][0];
                expect(callbackContent.text).toContain('No Trading Balance');
                expect(callbackContent.text).toContain('need to deposit USDC');
            });

            it('should calculate max position size based on balance and confidence', async () => {
                const mockBalanceInfo = {
                    address: '0x123',
                    usdcBalance: '1000.00',
                    usdcBalanceRaw: '1000000000',
                    hasEnoughBalance: true,
                    requiredAmount: '0',
                };

                vi.mocked(balanceChecker.checkPolymarketBalance).mockResolvedValue(mockBalanceInfo);

                await getWalletBalanceAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                const callbackContent = mockCallback.mock.calls[0][0];
                // With 1000 balance, 0.7 confidence, and 100 max config
                // Effective limit should be min(1000 * 0.7, 100) = 100
                expect(callbackContent.text).toContain('Effective Limit');
                expect(callbackContent.text).toContain('$100.00');
                expect(callbackContent.data.tradingLimits.maxPositionSize).toBe(100);
            });

            it('should respect configured max position size', async () => {
                const mockBalanceInfo = {
                    address: '0x123',
                    usdcBalance: '50.00',
                    usdcBalanceRaw: '50000000',
                    hasEnoughBalance: true,
                    requiredAmount: '0',
                };

                vi.mocked(balanceChecker.checkPolymarketBalance).mockResolvedValue(mockBalanceInfo);

                await getWalletBalanceAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                const callbackContent = mockCallback.mock.calls[0][0];
                // With 50 balance, 0.7 confidence, and 100 max config
                // Effective limit should be min(50 * 0.7, 100) = 35
                expect(callbackContent.text).toContain('Effective Limit');
                expect(callbackContent.text).toContain('$35.00');
                expect(callbackContent.data.tradingLimits.maxPositionSize).toBe(35);
            });

            it('should handle trading disabled status', async () => {
                mockRuntime.getSetting = vi.fn((key: string) => {
                    if (key === 'TRADING_ENABLED') return 'false';
                    if (key === 'WALLET_PRIVATE_KEY') return '0xkey';
                    if (key === 'MAX_POSITION_SIZE') return '100';
                    if (key === 'MIN_CONFIDENCE_THRESHOLD') return '0.7';
                    return undefined;
                });

                const mockBalanceInfo = {
                    address: '0x123',
                    usdcBalance: '100.00',
                    usdcBalanceRaw: '100000000',
                    hasEnoughBalance: true,
                    requiredAmount: '0',
                };

                vi.mocked(balanceChecker.checkPolymarketBalance).mockResolvedValue(mockBalanceInfo);

                await getWalletBalanceAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                const callbackContent = mockCallback.mock.calls[0][0];
                expect(callbackContent.text).toContain('❌ Disabled');
                expect(callbackContent.data.tradingLimits.tradingEnabled).toBe(false);
            });
        });

        describe('error handling', () => {
            it('should handle network errors gracefully', async () => {
                const networkError = new Error('Network request failed');
                vi.mocked(balanceChecker.checkPolymarketBalance).mockRejectedValue(networkError);

                const result = await getWalletBalanceAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(false);
                expect(result.error).toBe('Network request failed');
                
                const callbackContent = mockCallback.mock.calls[0][0];
                expect(callbackContent.text).toContain('Balance Check Failed');
                expect(callbackContent.text).toContain('Network request failed');
                expect(callbackContent.text).toContain('Network connectivity issues');
            });

            it('should handle RPC errors', async () => {
                const rpcError = new Error('RPC Error: rate limit exceeded');
                vi.mocked(balanceChecker.checkPolymarketBalance).mockRejectedValue(rpcError);

                const result = await getWalletBalanceAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(false);
                const callbackContent = mockCallback.mock.calls[0][0];
                expect(callbackContent.text).toContain('RPC Error');
                expect(callbackContent.text).toContain('RPC provider problems');
            });

            it('should handle invalid wallet configuration', async () => {
                const configError = new Error('Invalid private key format');
                vi.mocked(balanceChecker.checkPolymarketBalance).mockRejectedValue(configError);

                const result = await getWalletBalanceAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(false);
                const callbackContent = mockCallback.mock.calls[0][0];
                expect(callbackContent.text).toContain('Invalid private key');
                expect(callbackContent.text).toContain('Invalid wallet configuration');
            });

            it('should handle unknown errors', async () => {
                vi.mocked(balanceChecker.checkPolymarketBalance).mockRejectedValue('Something went wrong');

                const result = await getWalletBalanceAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(false);
                expect(result.error).toBe('Unknown error occurred');
                
                const callbackContent = mockCallback.mock.calls[0][0];
                expect(callbackContent.text).toContain('Unknown error occurred');
            });
        });

        describe('edge cases', () => {
            it('should handle very large balances', async () => {
                const mockBalanceInfo = {
                    address: '0x123',
                    usdcBalance: '1000000.00',
                    usdcBalanceRaw: '1000000000000',
                    hasEnoughBalance: true,
                    requiredAmount: '0',
                };

                vi.mocked(balanceChecker.checkPolymarketBalance).mockResolvedValue(mockBalanceInfo);

                const result = await getWalletBalanceAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(true);
                const callbackContent = mockCallback.mock.calls[0][0];
                expect(callbackContent.text).toContain('1000000.00');
            });

            it('should handle fractional balances', async () => {
                const mockBalanceInfo = {
                    address: '0x123',
                    usdcBalance: '0.123456',
                    usdcBalanceRaw: '123456',
                    hasEnoughBalance: false,
                    requiredAmount: '0',
                };

                vi.mocked(balanceChecker.checkPolymarketBalance).mockResolvedValue(mockBalanceInfo);

                const result = await getWalletBalanceAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(true);
                const callbackContent = mockCallback.mock.calls[0][0];
                expect(callbackContent.text).toContain('0.12'); // Should be formatted to 2 decimals
            });

            it('should handle missing optional settings with defaults', async () => {
                mockRuntime.getSetting = vi.fn((key: string) => {
                    if (key === 'WALLET_PRIVATE_KEY') return '0xkey';
                    return undefined; // All other settings missing
                });

                const mockBalanceInfo = {
                    address: '0x123',
                    usdcBalance: '100.00',
                    usdcBalanceRaw: '100000000',
                    hasEnoughBalance: true,
                    requiredAmount: '0',
                };

                vi.mocked(balanceChecker.checkPolymarketBalance).mockResolvedValue(mockBalanceInfo);

                const result = await getWalletBalanceAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(true);
                const callbackContent = mockCallback.mock.calls[0][0];
                // Should use defaults: MAX_POSITION_SIZE=100, MIN_CONFIDENCE_THRESHOLD=0.7
                expect(callbackContent.data.tradingLimits.configuredMaxPosition).toBe(100);
                expect(callbackContent.data.tradingLimits.minConfidenceThreshold).toBe(0.7);
            });
        });
    });

    describe('examples', () => {
        it('should have valid example messages', () => {
            expect(getWalletBalanceAction.examples).toBeDefined();
            expect(Array.isArray(getWalletBalanceAction.examples)).toBe(true);
            expect(getWalletBalanceAction.examples.length).toBeGreaterThan(0);
            
            getWalletBalanceAction.examples.forEach(example => {
                expect(Array.isArray(example)).toBe(true);
                expect(example.length).toBe(2); // User and assistant messages
                
                const [userMsg, assistantMsg] = example;
                expect(userMsg).toHaveProperty('name');
                expect(userMsg).toHaveProperty('content');
                expect(userMsg.content).toHaveProperty('text');
                
                expect(assistantMsg).toHaveProperty('name');
                expect(assistantMsg).toHaveProperty('content');
                expect(assistantMsg.content).toHaveProperty('text');
                expect(assistantMsg.content).toHaveProperty('action');
                expect(assistantMsg.content.action).toBe('POLYMARKET_GET_WALLET_BALANCE');
            });
        });
    });

    describe('metadata', () => {
        it('should have correct action metadata', () => {
            expect(getWalletBalanceAction.name).toBe('GET_WALLET_BALANCE');
            expect(getWalletBalanceAction.description).toBeDefined();
            expect(getWalletBalanceAction.description).toContain('USDC balance');
            expect(getWalletBalanceAction.similes).toBeDefined();
            expect(Array.isArray(getWalletBalanceAction.similes)).toBe(true);
            expect(getWalletBalanceAction.similes).toContain('CHECK_BALANCE');
            expect(getWalletBalanceAction.similes).toContain('WALLET_BALANCE');
            expect(getWalletBalanceAction.similes).toContain('USDC_BALANCE');
        });
    });
});