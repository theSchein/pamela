# Pamela - Autonomous Prediction Market Trading Agent

<div align="center">

![Pamela Logo](https://elizaos.github.io/eliza-avatars/Eliza/portrait.png)

**An autonomous AI prediction market trading agent built on ElizaOS**

[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)
[![ElizaOS](https://img.shields.io/badge/ElizaOS-Latest-purple.svg)](https://github.com/elizaos/eliza)

</div>

## 🎯 Overview

Pamela is an autonomous prediction market trading agent that can independently execute trades on Polymarket using her own Polygon wallet. Built on the ElizaOS framework, she combines advanced market analysis with autonomous decision-making to trade prediction markets without human intervention.

### Key Capabilities
- **Autonomous Trading**: Executes buy, sell, and redemption orders independently
- **Market Intelligence**: Real-time analysis of 1000+ prediction markets
- **Risk Management**: Built-in position sizing and safety controls
- **Natural Language Interface**: Accepts trading commands in plain English
- **Portfolio Management**: Tracks positions, performance, and P&L
- **CLOB Integration**: Direct connection to Polymarket's order book

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ (required)
- Docker & Docker Compose (for containerized testing)
- Polygon wallet with USDC for trading
- OpenAI API key for language model
- Telegram Bot Token (for Telegram deployment)

### Deployment Options

Pamela can be deployed as:
1. **Telegram Bot** (Recommended) - Stable, production-ready
2. **Web Interface** - Custom React frontend (experimental)
3. **Discord Bot** - Using Discord plugin
4. **API Service** - Direct HTTP/WebSocket access

### Monorepo Structure

```
pamela/
├── apps/
│   ├── agent/     # ElizaOS backend with Polymarket integration
│   └── web/       # React frontend (optional)
├── packages/
│   └── shared/    # Shared TypeScript types
└── scripts/       # Testing and deployment scripts
```

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/pamela
cd pamela

# Quick start with Docker
cp .env.local.example .env.local
# Edit .env.local with your API keys
./scripts/test-local.sh

# OR install manually
npm install
cp apps/agent/.env.example apps/agent/.env
# Edit apps/agent/.env with your API keys
```

### Telegram Bot Setup

1. **Create Bot with BotFather**
   ```bash
   # In Telegram, message @BotFather
   /newbot
   # Follow prompts to get your bot token
   ```

2. **Configure Environment**
   ```bash
   # Add to .env
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   ```

3. **Start Telegram Bot**
   ```bash
   # Quick start
   ./start-telegram.sh
   
   # Or with Docker
   docker-compose -f docker-compose.telegram.yml up
   ```

4. **Chat with Pamela**
   - Find your bot on Telegram
   - Send `/start` to begin
   - Ask about markets, prices, or place trades

See [TELEGRAM_SETUP.md](TELEGRAM_SETUP.md) for detailed setup instructions.

### Configuration

Edit `.env` with your credentials:

```env
# Required: Polymarket Trading
POLYMARKET_PRIVATE_KEY=your_polygon_private_key
CLOB_API_URL=https://clob.polymarket.com/

# Required: AI Model
OPENAI_API_KEY=your_openai_api_key

# Trading Configuration
TRADING_ENABLED=true
MAX_POSITION_SIZE=100
MIN_CONFIDENCE_THRESHOLD=0.7

# Database
PGLITE_DATA_DIR=./.eliza/.elizadb
```

### Running Pamela

```bash
# Development with Docker (recommended)
./scripts/test-local.sh

# Development without Docker
npm run dev

# Test production build locally
./scripts/test-production.sh

# Run tests
npm test
```

### Local Testing

See [TESTING.md](TESTING.md) for comprehensive local testing guide.

## 📊 Trading Capabilities

### Market Analysis
```javascript
// Get all active markets
retrieveAllMarkets()

// Analyze specific market
getMarketDetails(tokenId)

// Check current prices
getBestPrice(tokenId)
```

### Order Execution
```javascript
// Place limit order
placeOrder({
  tokenId: "71321045679252212594626385532706912750332728571942532289631379312455583992563",
  side: "buy",
  amount: 10,
  price: 0.65,
  orderType: "GTC"
})
```

### Natural Language Trading
```
"Show me markets about the 2024 election"
"Buy $25 of YES on Trump winning at 65 cents"
"What's my current portfolio value?"
```

## 🏗️ Architecture

### Plugin System
- **Core Plugin**: Basic conversational capabilities
- **Polymarket Plugin**: Trading and market analysis
- **Bootstrap Plugin**: Message handling and routing

### Services
- **Market Sync Service**: Maintains local market database
- **Market Detail Service**: Provides real-time market information
- **WebSocket Provider**: Live price updates and order status

### Database Schema
- Market data synchronization with PostgreSQL/PGLite
- Trade history and position tracking
- Performance analytics and metrics

## 🛡️ Security & Risk Management

### Built-in Safeguards
- **Position Limits**: Configurable maximum position sizes
- **Balance Verification**: Checks wallet balance before trades
- **Market Validation**: Verifies token IDs and market status
- **Confidence Thresholds**: Only trades above confidence levels

### Security Features
- Private key handling via environment variables
- Secure CLOB API authentication
- Input validation and sanitization
- Comprehensive error handling

## 🧪 Testing

### Test Suites
```bash
# Component tests
npm run test:component

# End-to-end tests
npm run test:e2e  

# Full test suite
npm test

# Coverage report
npm run test:coverage
```

### CLI-Based Testing
```bash
# Test with ElizaOS CLI
elizaos test --type e2e --name project
elizaos dev --character ./src/character.ts
```

## 🚀 Deployment

### Railway (Recommended)

Deploy as two separate services:

```bash
# Deploy Agent Backend
cd apps/agent
railway login
railway link  # Link to agent service
railway up

# Deploy Web Frontend (in new terminal)
cd apps/web
railway link  # Link to web service
railway up
```

Configure environment variables in Railway dashboard for each service.

### Docker
```bash
# Build container
docker build -t pamela .

# Run container
docker run -p 3000:3000 --env-file .env pamela
```

### Environment Variables for Production
```env
NODE_ENV=production
POLYMARKET_PRIVATE_KEY=...
OPENAI_API_KEY=...
DATABASE_URL=postgresql://...
```

## 🤝 Contributing

We welcome contributions to Pamela! This is an active open-source project focused on autonomous prediction market trading.

### Development Setup
```bash
# Fork and clone the repository
git clone https://github.com/your-username/pamela
cd pamela

# Install dependencies
npm install

# Run tests
npm test

# Start development mode
npm run dev
```

### Areas for Contribution
- **Trading Strategies**: Improve autonomous decision-making algorithms
- **Market Analysis**: Enhance market intelligence and data processing
- **Risk Management**: Strengthen safety and risk controls
- **Testing**: Add comprehensive test coverage
- **Documentation**: Improve guides and API documentation

### Pull Request Process
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Development Status

### ✅ Completed Features
- Market data retrieval and analysis (1000+ markets)
- Buy order execution with natural language processing
- CLOB integration with Polymarket
- PostgreSQL/PGLite database synchronization
- Risk management and position limits
- Comprehensive testing framework

### 🚧 In Progress
- Sell position functionality
- Position redemption system
- News integration for market intelligence
- Advanced autonomous trading strategies

### 🎯 Roadmap
- Railway chatbot deployment
- Social media integration
- TEE-compatible architecture
- Multi-agent trading systems

## 🔧 Plugin Architecture

### Core Components
- **Actions**: Market analysis, price checking, and trading operations
- **Services**: Background market sync and data processing
- **Providers**: Real-time WebSocket data feeds
- **Database**: Market data and trading history storage

### Plugin Compatibility
The Polymarket plugin required several ElizaOS compatibility updates:
- Action handler return type updates (Content → ActionResult)
- WebSocket type definitions added
- State management improvements
- Database migration system integration

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built on [ElizaOS](https://github.com/elizaos/eliza) framework
- Integrates with [Polymarket](https://polymarket.com) prediction markets
- Uses [Polygon](https://polygon.technology) blockchain for trading

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/pamela/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/pamela/discussions)
- **Security**: See [SECURITY.md](SECURITY.md) for reporting vulnerabilities

---

**⚠️ Disclaimer**: Pamela is experimental software for educational and research purposes. Trading prediction markets involves financial risk. Use at your own discretion and never trade more than you can afford to lose.