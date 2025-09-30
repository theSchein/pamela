import { logger } from "@elizaos/core";

interface SPMCMarket {
    id: string;
    weight: number;
    title?: string;
}

interface SPMCIndex {
    id: string;
    name: string;
    markets: SPMCMarket[];
    lastUpdated: string;
}

export class SPMCClient {
    private apiUrl: string;
    private indexId: string;
    private cache: { data: SPMCIndex | null; timestamp: number } = {
        data: null,
        timestamp: 0
    };
    private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour cache

    constructor(apiUrl: string, indexId: string) {
        this.apiUrl = apiUrl.replace(/\/$/, ''); // Remove trailing slash
        this.indexId = indexId;
    }

    /**
     * Fetch the index composition from SPMC API
     * @returns The index composition with market IDs and weights
     */
    async getIndexComposition(): Promise<SPMCIndex | null> {
        try {
            // Check cache first
            if (this.cache.data && 
                Date.now() - this.cache.timestamp < this.CACHE_DURATION) {
                logger.debug("SPMCClient", "Returning cached index data");
                return this.cache.data;
            }

            logger.info("SPMCClient", `Fetching index ${this.indexId} from SPMC API`);
            
            const response = await fetch(`${this.apiUrl}/api/v1/groups/${this.indexId}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'PamelaAgent/1.0'
                }
            });

            if (!response.ok) {
                logger.error("SPMCClient", `Failed to fetch index: ${response.status} ${response.statusText}`);
                return null;
            }

            const data: any = await response.json();
            
            // Parse the response into our format
            const index: SPMCIndex = {
                id: this.indexId,
                name: data.title || data.name || `Index ${this.indexId}`,
                markets: [],
                lastUpdated: new Date().toISOString()
            };

            // Extract markets and weights from the response
            if (data.markets && Array.isArray(data.markets)) {
                index.markets = data.markets.map((market: any) => ({
                    id: market.market_id || market.id,
                    weight: parseFloat(market.weight || market.allocation || 0),
                    title: market.market_title || market.title || market.name || undefined
                })).filter((m: SPMCMarket) => m.weight > 0);
            }

            // Normalize weights to sum to 1.0
            const totalWeight = index.markets.reduce((sum, m) => sum + m.weight, 0);
            if (totalWeight > 0) {
                index.markets = index.markets.map(m => ({
                    ...m,
                    weight: m.weight / totalWeight
                }));
            }

            logger.info("SPMCClient", 
                `Fetched index ${this.indexId} with ${index.markets.length} markets`);

            // Update cache
            this.cache = {
                data: index,
                timestamp: Date.now()
            };

            return index;

        } catch (error) {
            logger.error("SPMCClient", `Error fetching index composition: ${error}`);
            return null;
        }
    }

    /**
     * Clear the cache to force a fresh fetch
     */
    clearCache(): void {
        this.cache = { data: null, timestamp: 0 };
        logger.debug("SPMCClient", "Cache cleared");
    }

    /**
     * Get a specific market's weight in the index
     * @param marketId The Polymarket market ID
     * @returns The weight (0-1) or 0 if not in index
     */
    async getMarketWeight(marketId: string): Promise<number> {
        const index = await this.getIndexComposition();
        if (!index) return 0;

        const market = index.markets.find(m => m.id === marketId);
        return market?.weight || 0;
    }

    /**
     * Check if a market is in the index
     * @param marketId The Polymarket market ID
     * @returns true if the market is in the index
     */
    async isMarketInIndex(marketId: string): Promise<boolean> {
        const weight = await this.getMarketWeight(marketId);
        return weight > 0;
    }

    /**
     * Get the total number of markets in the index
     * @returns The number of markets
     */
    async getMarketCount(): Promise<number> {
        const index = await this.getIndexComposition();
        return index?.markets.length || 0;
    }
}

// Singleton instance for convenience
let spmcClient: SPMCClient | null = null;

export function initSPMCClient(apiUrl: string, indexId: string): SPMCClient {
    if (!spmcClient) {
        spmcClient = new SPMCClient(apiUrl, indexId);
    }
    return spmcClient;
}

export function getSPMCClient(): SPMCClient | null {
    return spmcClient;
}