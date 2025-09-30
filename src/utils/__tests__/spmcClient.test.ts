import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test';
import { SPMCClient, initSPMCClient } from '../spmcClient';
import type { SPMCIndex, SPMCIndexResponse } from '../../types/spmc';

// Create mock functions
const mockFetch = mock(() => Promise.resolve({
    ok: true,
    json: async () => ({})
}));

describe('SPMCClient', () => {
    let client: SPMCClient;
    const baseUrl = 'https://api.spmc.dev';
    const indexId = 'test-index-id';

    beforeEach(() => {
        mockFetch.mockClear();
        global.fetch = mockFetch as any;
    });

    afterEach(() => {
        if (client) {
            client.close();
        }
    });

    describe('initialization', () => {
        it('should initialize client with correct base URL', () => {
            client = initSPMCClient(baseUrl, indexId);
            expect(client).toBeDefined();
            expect(client).toBeInstanceOf(SPMCClient);
        });

        it('should handle initialization with trailing slash in URL', () => {
            client = initSPMCClient('https://api.spmc.dev/', indexId);
            expect(client).toBeDefined();
        });

        it('should throw error for invalid URL', () => {
            expect(() => {
                initSPMCClient('not-a-url', indexId);
            }).toThrow();
        });
    });

    describe('getIndex', () => {
        beforeEach(() => {
            client = new SPMCClient(baseUrl, indexId);
        });

        it('should fetch index successfully', async () => {
            const mockIndex: SPMCIndex = {
                id: 'test-index-id',
                name: 'Test Index',
                description: 'A test index',
                members: [
                    { marketId: 'market1', weight: 0.5 },
                    { marketId: 'market2', weight: 0.5 }
                ],
                lastUpdated: '2024-01-01T00:00:00Z'
            };

            const mockResponse: SPMCIndexResponse = {
                success: true,
                index: mockIndex
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const result = await client.getIndex('test-index-id');
            
            expect(result).toEqual(mockIndex);
            expect(mockFetch).toHaveBeenCalledWith(
                `${baseUrl}/api/index/test-index-id`,
                expect.objectContaining({
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
            );
        });

        it('should handle API error responses', async () => {
            const mockResponse: SPMCIndexResponse = {
                success: false,
                error: 'Index not found'
            };

            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: async () => mockResponse
            });

            await expect(client.getIndex('non-existent')).rejects.toThrow('Index not found');
        });

        it('should handle network errors', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            await expect(client.getIndex('test-index-id')).rejects.toThrow('Network error');
        });

        it('should handle invalid JSON response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => {
                    throw new Error('Invalid JSON');
                }
            });

            await expect(client.getIndex('test-index-id')).rejects.toThrow();
        });

        it('should use default index ID if not provided', async () => {
            const mockIndex: SPMCIndex = {
                id: indexId,
                name: 'Default Index',
                members: []
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, index: mockIndex })
            });

            const result = await client.getIndex();
            
            expect(result).toEqual(mockIndex);
            expect(mockFetch).toHaveBeenCalledWith(
                `${baseUrl}/api/index/${indexId}`,
                expect.any(Object)
            );
        });

        it('should handle rate limiting', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
                json: async () => ({ error: 'Rate limited' })
            });

            await expect(client.getIndex('test-index-id')).rejects.toThrow();
        });
    });

    describe('getIndexMembers', () => {
        beforeEach(() => {
            client = new SPMCClient(baseUrl, indexId);
        });

        it('should fetch index members', async () => {
            const mockMembers = [
                { marketId: 'market1', weight: 0.6, market: { id: 'market1', title: 'Market 1' } },
                { marketId: 'market2', weight: 0.4, market: { id: 'market2', title: 'Market 2' } }
            ];

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, members: mockMembers })
            });

            const result = await client.getIndexMembers('test-index-id');
            
            expect(result).toEqual(mockMembers);
            expect(mockFetch).toHaveBeenCalledWith(
                `${baseUrl}/api/index/test-index-id/members`,
                expect.any(Object)
            );
        });

        it('should handle empty members list', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, members: [] })
            });

            const result = await client.getIndexMembers('test-index-id');
            
            expect(result).toEqual([]);
        });
    });

    describe('getMarketData', () => {
        beforeEach(() => {
            client = new SPMCClient(baseUrl, indexId);
        });

        it('should fetch market data for a specific market', async () => {
            const mockMarket = {
                id: 'market1',
                title: 'Test Market',
                probability: 0.65,
                volume: 10000,
                liquidity: 50000
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, market: mockMarket })
            });

            const result = await client.getMarketData('market1');
            
            expect(result).toEqual(mockMarket);
        });

        it('should cache market data', async () => {
            const mockMarket = {
                id: 'market1',
                title: 'Test Market',
                probability: 0.65
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, market: mockMarket })
            });

            // First call
            await client.getMarketData('market1');
            
            // Second call should use cache
            await client.getMarketData('market1');
            
            // Fetch should only be called once due to caching
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('error handling', () => {
        beforeEach(() => {
            client = new SPMCClient(baseUrl, indexId);
        });

        it('should retry on transient failures', async () => {
            // First call fails, second succeeds
            mockFetch
                .mockRejectedValueOnce(new Error('Temporary failure'))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ 
                        success: true, 
                        index: { id: 'test', name: 'Test', members: [] } 
                    })
                });

            const result = await client.getIndex('test-index-id');
            
            expect(result).toBeDefined();
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('should handle malformed response gracefully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ 
                    // Missing expected fields
                    randomField: 'value' 
                })
            });

            await expect(client.getIndex('test-index-id')).rejects.toThrow();
        });

        it('should handle timeout', async () => {
            // Simulate a timeout by never resolving
            mockFetch.mockImplementationOnce(() => new Promise((resolve) => {
                setTimeout(() => resolve({ ok: false }), 10000);
            }));

            const timeoutClient = new SPMCClient(baseUrl, indexId, { timeout: 100 });
            
            await expect(timeoutClient.getIndex('test-index-id')).rejects.toThrow();
        });
    });

    describe('close', () => {
        it('should clean up resources when closed', () => {
            client = new SPMCClient(baseUrl, indexId);
            
            expect(() => client.close()).not.toThrow();
            
            // Verify client can be closed multiple times safely
            expect(() => client.close()).not.toThrow();
        });
    });

    describe('headers and authentication', () => {
        it('should include custom headers if provided', async () => {
            const customHeaders = {
                'X-API-Key': 'test-api-key'
            };
            
            client = new SPMCClient(baseUrl, indexId, { headers: customHeaders });
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ 
                    success: true, 
                    index: { id: 'test', name: 'Test', members: [] } 
                })
            });

            await client.getIndex('test-index-id');
            
            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'X-API-Key': 'test-api-key',
                        'Content-Type': 'application/json'
                    })
                })
            );
        });
    });
});