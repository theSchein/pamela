/**
 * Configuration utility for consolidating environment variables
 * This ensures we have a single source of truth for critical config values
 */

export class Config {
    /**
     * Get the private key for wallet operations
     * Consolidates multiple possible environment variable names into one
     * Priority order: POLYMARKET_PRIVATE_KEY > WALLET_PRIVATE_KEY > PRIVATE_KEY > EVM_PRIVATE_KEY
     */
    static getPrivateKey(): string | undefined {
        const privateKey = 
            process.env.POLYMARKET_PRIVATE_KEY ||
            process.env.WALLET_PRIVATE_KEY ||
            process.env.PRIVATE_KEY ||
            process.env.EVM_PRIVATE_KEY;
        
        if (privateKey && !privateKey.startsWith('0x')) {
            throw new Error('Private key must start with 0x');
        }
        
        return privateKey;
    }

    /**
     * Validate that all required configuration is present
     * @throws Error if required configuration is missing
     */
    static validateRequired(): void {
        const privateKey = this.getPrivateKey();
        if (!privateKey) {
            throw new Error(
                'Private key not found. Please set one of: POLYMARKET_PRIVATE_KEY, WALLET_PRIVATE_KEY, PRIVATE_KEY, or EVM_PRIVATE_KEY'
            );
        }

        // Validate private key format
        if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
            throw new Error('Invalid private key format. Must be 66 characters starting with 0x');
        }
    }

    /**
     * Get index trading configuration
     */
    static getIndexConfig() {
        return {
            enabled: process.env.INDEX_TRADING_ENABLED === 'true',
            apiUrl: process.env.SPMC_API_URL || 'https://api.spmc.dev',
            indexId: process.env.SPMC_INDEX_ID,
            minPosition: parseFloat(process.env.MIN_INDEX_POSITION || '10'),
            rebalanceDay: process.env.INDEX_REBALANCE_DAY || 'MONDAY',
            rebalanceHour: parseInt(process.env.INDEX_REBALANCE_HOUR || '9'),
            maxSlippage: parseFloat(process.env.MAX_SLIPPAGE || '0.05')
        };
    }

    /**
     * Get trading configuration
     */
    static getTradingConfig() {
        return {
            enabled: process.env.TRADING_ENABLED === 'true',
            maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '100'),
            minConfidenceThreshold: parseFloat(process.env.MIN_CONFIDENCE_THRESHOLD || '0.7'),
            unsupervisedMode: process.env.UNSUPERVISED_MODE === 'true',
            maxDailyTrades: parseInt(process.env.MAX_DAILY_TRADES || '10'),
            maxOpenPositions: parseInt(process.env.MAX_OPEN_POSITIONS || '20'),
            riskLimitPerTrade: parseFloat(process.env.RISK_LIMIT_PER_TRADE || '50'),
            minBalanceThreshold: parseFloat(process.env.MIN_BALANCE_THRESHOLD || '10'),
            autoRedemption: process.env.AUTO_REDEMPTION === 'true'
        };
    }
}