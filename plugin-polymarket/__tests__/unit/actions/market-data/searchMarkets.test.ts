import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchMarketsAction } from '../../../../src/actions/searchMarkets';
import { IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import * as llmHelpers from '../../../../src/utils/llmHelpers';

// Mock the LLM helpers
vi.mock('../../../../src/utils/llmHelpers', () => ({
    callLLMWithTimeout: vi.fn(),
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
    sql: vi.fn((strings, ...values) => ({ sql: strings.join(''), values })),
    like: vi.fn((field, value) => ({ field, value, op: 'like' })),
    ilike: vi.fn((field, value) => ({ field, value, op: 'ilike' })),
    or: vi.fn((...conditions) => ({ type: 'or', conditions })),
    and: vi.fn((...conditions) => ({ type: 'and', conditions })),
    desc: vi.fn((field) => ({ field, order: 'desc' })),
}));

describe('searchMarkets Action', () => {
    let mockRuntime: IAgentRuntime;
    let mockCallback: HandlerCallback;
    let mockMemory: Memory;
    let mockState: State;
    let mockDb: any;

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Setup mock database
        mockDb = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
        };

        // Setup mock runtime with database
        mockRuntime = {
            db: mockDb,
            getSetting: vi.fn(),
        } as any;

        mockCallback = vi.fn();
        
        mockMemory = {
            userId: 'user-123',
            agentId: 'agent-123',
            roomId: 'room-123',
            content: { text: 'show me Bitcoin markets' },
        } as Memory;

        mockState = {} as State;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('validate', () => {
        it('should pass validation for market-related queries', async () => {
            const testCases = [
                'show me some markets',
                'what Bitcoin markets are there?',
                'find prediction markets',
                'show popular trading options',
                'tell me about interesting bets',
                'what are the top election markets?',
                'F1 markets',
                'bitcoin markets'
            ];

            for (const text of testCases) {
                mockMemory.content.text = text;
                const result = await searchMarketsAction.validate(mockRuntime, mockMemory, mockState);
                expect(result).toBe(true);
            }
        });

        it('should fail validation for non-market queries', async () => {
            const testCases = [
                'hello',
                'calculate 2+2',
                'send an email',
                ''
            ];

            for (const text of testCases) {
                mockMemory.content.text = text;
                const result = await searchMarketsAction.validate(mockRuntime, mockMemory, mockState);
                expect(result).toBe(false);
            }
        });

        it('should handle topic-specific market queries', async () => {
            mockMemory.content.text = 'AI markets';
            const result = await searchMarketsAction.validate(mockRuntime, mockMemory, mockState);
            expect(result).toBe(true);
        });
    });

    describe('handler', () => {
        describe('successful searches', () => {
            const mockMarkets = [
                {
                    question: 'Will Bitcoin reach $100k in 2025?',
                    marketSlug: 'bitcoin-100k-2025',
                    conditionId: '0x123abc',
                    category: 'Crypto',
                    endDateIso: '2025-12-31T00:00:00Z',
                    active: true,
                    closed: false,
                },
                {
                    question: 'Will Bitcoin ETF be approved?',
                    marketSlug: 'bitcoin-etf-approval',
                    conditionId: '0x456def',
                    category: 'Crypto',
                    endDateIso: '2025-06-30T00:00:00Z',
                    active: true,
                    closed: false,
                },
            ];

            beforeEach(() => {
                // Setup successful database query
                mockDb.limit = vi.fn().mockResolvedValue(mockMarkets);
            });

            it('should search for specific topic markets using LLM extraction', async () => {
                mockMemory.content.text = 'show me Bitcoin markets';
                
                vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
                    searchType: 'specific',
                    searchTerm: 'bitcoin',
                    confidence: 0.9,
                });

                const result = await searchMarketsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(true);
                expect(vi.mocked(llmHelpers.callLLMWithTimeout)).toHaveBeenCalled();
                expect(mockDb.where).toHaveBeenCalled();
                expect(mockDb.orderBy).toHaveBeenCalled();
                expect(mockDb.limit).toHaveBeenCalledWith(10);
                
                const callbackContent = mockCallback.mock.calls[0][0];
                expect(callbackContent.text).toContain('Bitcoin');
                expect(callbackContent.text).toContain('Will Bitcoin reach $100k');
                expect(callbackContent.data.markets).toHaveLength(2);
                expect(callbackContent.data.searchTerm).toBe('bitcoin');
            });

            it('should fallback to regex extraction when LLM fails', async () => {
                mockMemory.content.text = 'what about bitcoin markets';
                
                vi.mocked(llmHelpers.callLLMWithTimeout).mockRejectedValue(new Error('LLM timeout'));

                const result = await searchMarketsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(true);
                expect(mockCallback).toHaveBeenCalled();
                const callbackContent = mockCallback.mock.calls[0][0];
                expect(callbackContent.data.markets).toHaveLength(2);
            });

            it('should return popular markets for general queries', async () => {
                mockMemory.content.text = 'show me some popular markets';
                
                vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
                    searchType: 'general',
                    searchTerm: '',
                    confidence: 0.8,
                });

                const result = await searchMarketsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(true);
                const callbackContent = mockCallback.mock.calls[0][0];
                expect(callbackContent.text).toContain('hot markets');
                expect(callbackContent.data.searchTerm).toBe('popular/recent');
            });

            it('should format market results correctly', async () => {
                mockMemory.content.text = 'bitcoin markets';
                
                vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
                    searchType: 'specific',
                    searchTerm: 'bitcoin',
                    confidence: 0.9,
                });

                await searchMarketsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                const callbackContent = mockCallback.mock.calls[0][0];
                const firstMarket = callbackContent.data.markets[0];
                
                expect(firstMarket).toHaveProperty('rank', 1);
                expect(firstMarket).toHaveProperty('question');
                expect(firstMarket).toHaveProperty('slug');
                expect(firstMarket).toHaveProperty('conditionId');
                expect(firstMarket).toHaveProperty('category');
                expect(firstMarket).toHaveProperty('endDate');
                expect(firstMarket).toHaveProperty('daysUntilEnd');
                expect(firstMarket).toHaveProperty('active');
            });

            it('should limit display to 5 markets in response text', async () => {
                const manyMarkets = Array(10).fill(null).map((_, i) => ({
                    question: `Market ${i + 1}?`,
                    marketSlug: `market-${i + 1}`,
                    conditionId: `0x${i}`,
                    category: 'Test',
                    endDateIso: '2025-12-31T00:00:00Z',
                    active: true,
                    closed: false,
                }));
                
                mockDb.limit = vi.fn().mockResolvedValue(manyMarkets);
                
                await searchMarketsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                const callbackContent = mockCallback.mock.calls[0][0];
                // Should display only 5 in text but return all in data
                expect((callbackContent.text.match(/^\d\./gm) || []).length).toBe(5);
                expect(callbackContent.data.markets).toHaveLength(10);
                expect(callbackContent.data.totalResults).toBe(10);
            });
        });

        describe('no results handling', () => {
            it('should handle no results for specific search', async () => {
                mockDb.limit = vi.fn().mockResolvedValue([]);
                mockMemory.content.text = 'unicorn markets';
                
                vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
                    searchType: 'specific',
                    searchTerm: 'unicorn',
                    confidence: 0.9,
                });

                const result = await searchMarketsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(true);
                const callbackContent = mockCallback.mock.calls[0][0];
                expect(callbackContent.text).toContain('No active markets found for "unicorn"');
                expect(callbackContent.data?.markets || []).toHaveLength(0);
                expect(callbackContent.data?.totalResults || 0).toBe(0);
            });

            it('should handle no results for general search', async () => {
                mockDb.limit = vi.fn().mockResolvedValue([]);
                mockMemory.content.text = 'show me markets';
                
                vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
                    searchType: 'general',
                    searchTerm: '',
                    confidence: 0.8,
                });

                const result = await searchMarketsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(true);
                const callbackContent = mockCallback.mock.calls[0][0];
                expect(callbackContent.text).toContain('No active markets found at the moment');
            });

            it('should attempt broader search when specific search fails', async () => {
                // First query returns empty, broader query returns results
                const mockBroaderResults = [{
                    question: 'Related market',
                    marketSlug: 'related',
                    conditionId: '0x789',
                    category: 'General',
                    endDateIso: '2025-12-31T00:00:00Z',
                    active: true,
                    closed: false,
                }];

                let callCount = 0;
                mockDb.limit = vi.fn().mockImplementation(() => {
                    callCount++;
                    return Promise.resolve(callCount === 1 ? [] : mockBroaderResults);
                });

                mockMemory.content.text = 'specific term markets';
                
                vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
                    searchType: 'specific',
                    searchTerm: 'specific term',
                    confidence: 0.9,
                });

                const result = await searchMarketsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(true);
                expect(mockDb.select).toHaveBeenCalledTimes(2); // Initial + broader search
            });
        });

        describe('error handling', () => {
            it('should handle database not available', async () => {
                mockRuntime.db = undefined;

                const result = await searchMarketsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(false);
                expect(result.error).toBe('Database not available');
            });

            it('should handle database query errors', async () => {
                mockDb.limit = vi.fn().mockRejectedValue(new Error('Database connection failed'));

                const result = await searchMarketsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(false);
                expect(result.error).toBe('Database connection failed');
            });

            it('should handle LLM extraction with low confidence', async () => {
                vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
                    searchType: 'specific',
                    searchTerm: 'maybe bitcoin',
                    confidence: 0.3, // Low confidence
                });

                mockDb.limit = vi.fn().mockResolvedValue([]);
                mockMemory.content.text = 'something about markets';

                await searchMarketsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                // Should fall back to general search due to low confidence
                expect(mockDb.where).toHaveBeenCalled();
            });

            it('should handle malformed LLM response', async () => {
                vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue(null);

                mockDb.limit = vi.fn().mockResolvedValue([{
                    question: 'Test market',
                    marketSlug: 'test',
                    conditionId: '0x123',
                    category: 'Test',
                    endDateIso: '2025-12-31T00:00:00Z',
                    active: true,
                    closed: false,
                }]);

                const result = await searchMarketsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                expect(result.success).toBe(true); // Should still work with fallback
            });
        });

        describe('edge cases', () => {
            it('should handle markets with missing fields', async () => {
                const incompleteMarkets = [{
                    question: 'Incomplete market?',
                    marketSlug: 'incomplete',
                    conditionId: '0x999',
                    category: null, // Missing category
                    endDateIso: null, // Missing end date
                    active: true,
                    closed: false,
                }];

                mockDb.limit = vi.fn().mockResolvedValue(incompleteMarkets);

                await searchMarketsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                const callbackContent = mockCallback.mock.calls[0][0];
                const market = callbackContent.data.markets[0];
                
                expect(market.category).toBe('General'); // Should default
                expect(market.endDate).toBeUndefined();
                expect(market.daysUntilEnd).toBeNull();
            });

            it('should handle empty message content', async () => {
                mockMemory.content.text = '';
                mockDb.limit = vi.fn().mockResolvedValue([]);
                
                const result = await searchMarketsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                // Empty text should still process but might return no results or error
                expect(result).toBeDefined();
                expect(result.success).toBeDefined();
            });

            it('should calculate days until end correctly', async () => {
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + 10);
                
                const marketWithFutureEnd = [{
                    question: 'Future market?',
                    marketSlug: 'future',
                    conditionId: '0x111',
                    category: 'Test',
                    endDateIso: futureDate.toISOString(),
                    active: true,
                    closed: false,
                }];

                mockDb.limit = vi.fn().mockResolvedValue(marketWithFutureEnd);

                await searchMarketsAction.handler(
                    mockRuntime,
                    mockMemory,
                    mockState,
                    {},
                    mockCallback
                );

                const callbackContent = mockCallback.mock.calls[0][0];
                const market = callbackContent.data.markets[0];
                
                // Should be approximately 10 days (might be 9 or 10 depending on time)
                expect(market.daysUntilEnd).toBeGreaterThanOrEqual(9);
                expect(market.daysUntilEnd).toBeLessThanOrEqual(10);
            });
        });
    });

    describe('examples', () => {
        it('should have valid example messages', () => {
            expect(searchMarketsAction.examples).toBeDefined();
            expect(Array.isArray(searchMarketsAction.examples)).toBe(true);
            expect(searchMarketsAction.examples.length).toBeGreaterThan(0);
            
            searchMarketsAction.examples.forEach(example => {
                expect(Array.isArray(example)).toBe(true);
                expect(example.length).toBe(2); // User and assistant messages
                
                const [userMsg, assistantMsg] = example;
                expect(userMsg).toHaveProperty('name');
                expect(userMsg).toHaveProperty('content');
                expect(userMsg.content).toHaveProperty('text');
                
                expect(assistantMsg).toHaveProperty('name');
                expect(assistantMsg).toHaveProperty('content');
                expect(assistantMsg.content).toHaveProperty('text');
            });
        });
    });

    describe('metadata', () => {
        it('should have correct action metadata', () => {
            expect(searchMarketsAction.name).toBe('SEARCH_POLYMARKET_MARKETS');
            expect(searchMarketsAction.description).toBeDefined();
            expect(searchMarketsAction.description).toContain('Search for prediction markets');
        });
    });
});