# ElizaOS Polymarket Plugin

A comprehensive plugin for integrating Polymarket prediction markets with ElizaOS agents.

## Features

- **Market Discovery**: Search and browse Polymarket prediction markets
- **Trading Actions**: Place buy/sell orders with L1 authentication
- **Portfolio Management**: Track positions, balances, and P&L
- **Market Analysis**: Get order book data, price history, and market insights
- **Redemption**: Automatically claim winnings from resolved markets
- **USDC Management**: Deposit and approve USDC for trading

## Installation

```bash
npm install @elizaos/plugin-polymarket
```

## Configuration

Add the plugin to your ElizaOS agent configuration:

```typescript
import { polymarketPlugin } from "@elizaos/plugin-polymarket";

const agent = {
  name: "MyAgent",
  plugins: [polymarketPlugin],
  settings: {
    WALLET_PRIVATE_KEY: "your-private-key",
    CLOB_API_URL: "https://clob.polymarket.com", // optional
    CLOB_API_KEY: "your-api-key" // optional for L2 operations
  }
};
```

## Environment Variables

```bash
# Required for trading
WALLET_PRIVATE_KEY=your-private-key

# Optional
CLOB_API_URL=https://clob.polymarket.com
CLOB_API_KEY=your-api-key
```

## Available Actions

### Core Trading
- `PLACE_ORDER` - Buy shares in a market
- `SELL_ORDER` - Sell existing positions
- `REDEEM_WINNINGS` - Claim winnings from resolved markets

### Market Discovery
- `SEARCH_MARKETS` - Search for markets by keyword
- `EXPLAIN_MARKET` - Get detailed market information
- `GET_MARKET_PRICE` - Check current market prices
- `SHOW_FAVORITE_MARKETS` - Display trending markets

### Portfolio Management
- `GET_PORTFOLIO_POSITIONS` - View current holdings
- `GET_WALLET_BALANCE` - Check USDC balance
- `APPROVE_USDC` - Approve USDC for trading
- `SETUP_TRADING` - Complete trading setup

### Market Data
- `GET_ORDER_BOOK_SUMMARY` - View order book depth
- `GET_PRICE_HISTORY` - Historical price data
- `SYNC_MARKETS` - Update local market database

## Usage Examples

### Search for Markets
```
"Find markets about the presidential election"
"Search for markets on AI development"
```

### Place Orders
```
"Buy $50 of YES shares in market 0x123..."
"Place a $100 bet on NO for the climate market"
```

### Portfolio Management
```
"Show my portfolio positions"
"What's my wallet balance?"
"Redeem my winnings"
```

### Market Analysis
```
"Explain the Bitcoin price market"
"What's the current price for YES shares?"
"Show me the order book"
```

## Architecture

The plugin follows a modular architecture:

```
src/
├── actions/          # Individual action implementations
├── services/         # Background services (market sync, etc.)
├── providers/        # Data providers for agent context
├── utils/           # Helper utilities
├── types.ts         # TypeScript type definitions
├── plugin.ts        # Main plugin configuration
└── index.ts         # Public exports
```

## Development

### Building
```bash
npm run build
```

### Testing
```bash
npm run test
npm run test:coverage
```

### Linting
```bash
npm run lint
npm run format
```

## Services

### MarketSyncService
Automatically syncs market data from Polymarket API every 24 hours to maintain a local database for faster searching.

### MarketDetailService  
Provides detailed market information and analysis capabilities.

## Security Considerations

- Never commit private keys to version control
- Use environment variables for sensitive configuration
- The plugin uses L1 authentication for on-chain transactions
- L2 operations require additional API credentials they are not scoped for this plugin

## Contributing

Contributions are welcome! Please see our [contributing guidelines](CONTRIBUTING.md).

## License

MIT

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/yourusername/elizaos-plugin-polymarket/issues)
- Documentation: [ElizaOS Docs](https://docs.elizaos.com)

## Acknowledgments

Built with [ElizaOS](https://github.com/elizaos/elizaos) framework and [Polymarket CLOB Client](https://github.com/Polymarket/clob-client).