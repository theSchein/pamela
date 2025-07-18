# Pamela - Prediction Market Trading Agent

A specialized ElizaOS agent for prediction market trading and analysis, with a focus on Polymarket integration.

## Overview

Pamela is a prediction market trading agent built on the ElizaOS framework. She specializes in:
- Analyzing prediction markets and forecasting
- Providing insights on market trends and probability assessments
- Risk management and trading strategies
- Real-time market data analysis

## Features

- **Polymarket Integration**: Connect to Polymarket prediction markets
- **Market Analysis**: Analyze market trends, pricing, and probability assessments
- **Risk Management**: Built-in trading limits and confidence thresholds
- **Real-time Data**: Access to live market data and price feeds
- **Security**: Secure API key management and private key handling

## Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Configure your environment variables:
   ```env
   # Polymarket API Configuration
   POLYMARKET_API_KEY=your_api_key_here
   POLYMARKET_PASSPHRASE=your_passphrase_here
   POLYMARKET_SECRET=your_secret_here
   POLYMARKET_PRIVATE_KEY=your_private_key_here

   # Trading Configuration
   TRADING_ENABLED=false
   MAX_POSITION_SIZE=100
   MIN_CONFIDENCE_THRESHOLD=0.7

   # ElizaOS Configuration
   OPENAI_API_KEY=your_openai_api_key
   ANTHROPIC_API_KEY=your_anthropic_api_key
   ```

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