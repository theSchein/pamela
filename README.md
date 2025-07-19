# Pamela - Autonomous Prediction Market Trading Agent

An AI-powered prediction market trading agent built on ElizaOS that can autonomously execute trades on Polymarket with her own Polygon wallet.

## 🚀 Features

- **Autonomous Trading**: Executes buy, sell, and redemption orders on Polymarket
- **Market Analysis**: Retrieves and analyzes prediction market data in real-time
- **Risk Management**: Implements position sizing and risk controls
- **CLOB Integration**: Direct connection to Polymarket's Central Limit Order Book
- **Natural Language Trading**: Accepts trading commands in plain English
- **Portfolio Management**: Tracks positions and performance
- **Real-time Data**: WebSocket connections for live market updates

## 📊 Available Actions

### Market Data
- `retrieveAllMarkets` - Get all available prediction markets
- `getMarketDetails` - Detailed information about specific markets  
- `getBestPrice` - Best available prices for market tokens
- `getSpread` - Price spread calculations
- `getMidpointPrice` - Midpoint price calculations
- `getSimplifiedMarkets` - Simplified market data view

### Trading
- `placeOrder` - Execute buy/sell orders on Polymarket
  - Supports limit orders (GTC, GTD, FAK)
  - Supports market orders (FOK)
  - Natural language parameter extraction

## 🔧 Configuration

### Environment Variables

```env
# Polymarket Configuration
POLYMARKET_PRIVATE_KEY=your_polygon_private_key
CLOB_API_URL=https://clob.polymarket.com/

# Trading Configuration  
TRADING_ENABLED=true
MAX_POSITION_SIZE=100
MIN_CONFIDENCE_THRESHOLD=0.7

# ElizaOS Configuration
OPENAI_API_KEY=your_openai_api_key
PGLITE_DATA_DIR=./.eliza/.elizadb

# Future: Web Search & News (Coming Soon)
TAVILY_API_KEY=your_tavily_api_key
NEWS_API_KEY=your_news_api_key
```

### Required Setup

1. **Polygon Wallet**: Create a new Polygon wallet for the agent
2. **Fund Wallet**: Add USDC to the wallet for trading
3. **API Keys**: Set up OpenAI API key for language model
4. **Polymarket Access**: Ensure wallet can access Polymarket

## Getting Started

1. Install dependencies:
   ```bash
   bun install
   ```

2. Build the project:
   ```bash
   bun run build
   ```

3. Start the development server:
   ```bash
   bun run dev
   ```

4. Start the production agent:
   ```bash
   bun run start
   ```

## Plugin Architecture

Pamela is built using a custom prediction market plugin that integrates with the core ElizaOS framework. The plugin includes:

- **Actions**: Market analysis, price checking, and trading operations
- **Providers**: Real-time data feeds and market information
- **Services**: Background services for monitoring and analysis
- **Types**: TypeScript definitions for market data and trading operations

## Development Status

**Current Status**: Initial setup complete with basic framework integration.

**Working Features**:
- ✅ Project structure and build system
- ✅ Character configuration for prediction market focus
- ✅ Plugin architecture foundation
- ✅ Environment configuration
- ✅ TypeScript compilation

**Next Steps**:
1. Integrate working polymarket actions
2. Add real-time market data feeds
3. Implement trading strategies
4. Add comprehensive testing
5. Deploy and monitor

## Plugin Compatibility

The polymarket plugin from the ElizaOS addpolygon branch required several compatibility fixes:
- Action handler return type updates (Content → ActionResult)
- WebSocket type definitions
- State management improvements
- Plugin initialization compatibility

See `PLUGIN_COMPATIBILITY_NOTES.md` for detailed information about the fixes applied.

## Contributing

This is an active development project. The plugin integration is functional but the full trading capabilities are still being developed.

## License

MIT License - See LICENSE file for details.