# PaMeLa - Prediction Market Lady 
## A Prediction Market Trading Agent Framework

<div align="center">

![Pamela Logo](/images/pamela.png)

**An autonomous AI prediction market trading agent built on ElizaOS**

[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)
[![ElizaOS](https://img.shields.io/badge/ElizaOS-Latest-purple.svg)](https://github.com/elizaos/eliza)

</div>

## Overview

Pamela is a framework prediction market trading agent to independently execute trades on Polymarket using her own Polygon wallet. Built on ElizaOS, this is an example implementation of the @plugin-polymarket to bring Polymarket trading action to Eliza agents. 


### Key Capabilities
- **Autonomous Trading**: Executes buy, sell, and redemption orders independently
- **Market Intelligence**: Real-time analysis of 1000+ prediction markets
- **Risk Management**: Built-in position sizing and safety controls
- **Natural Language Interface**: Accepts trading commands in plain English
- **Portfolio Management**: Tracks positions, performance, and P&L
- **CLOB Integration**: Direct connection to Polymarket's order book

## Quick Start

### Prerequisites
- Node.js 20+ and Bun runtime (required)
- Docker & Docker Compose (for containerized testing)
- Polygon wallet with USDC for trading
- LLM API key (Anthropic, OpenAI, or others)
- Discord Bot Token (for Discord deployment)

### Deployment Options

Pamela can be deployed as:
1. **Railway** (Recommended for 24/7) - Cloud deployment with auto-scaling
2. **Discord Bot** - Using Discord plugin for community trading
3. **Telegram Bot** - Stable, production-ready
4. **Web Interface** - Custom React frontend (experimental)
5. **API Service** - Direct HTTP/WebSocket access

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
# Required: Polymarket Trading (all three must be the same key)
WALLET_PRIVATE_KEY=your_polygon_private_key
PRIVATE_KEY=your_polygon_private_key
POLYMARKET_PRIVATE_KEY=your_polygon_private_key
CLOB_API_URL=https://clob.polymarket.com/

# Required: AI Model (at least one)
ANTHROPIC_API_KEY=your_anthropic_api_key
# OR
OPENAI_API_KEY=your_openai_api_key

# Discord Bot (if using Discord)
DISCORD_API_TOKEN=your_discord_bot_token
DISCORD_APPLICATION_ID=your_discord_app_id

# Memory Optimization (important for production)
NODE_OPTIONS=--max-old-space-size=4096

# Trading Configuration
TRADING_ENABLED=true
MAX_POSITION_SIZE=100
MIN_CONFIDENCE_THRESHOLD=0.7

# Database
PGLITE_DATA_DIR=./.eliza/.elizadb
```

### Docker & TEE Deployment Configuration

When deploying with Docker or to Phala TEE, you need to set your Docker Hub username:

```bash
# Set your Docker Hub username (required for deployment)
export DOCKER_USERNAME=your-dockerhub-username

# Optional: Customize image name and tag
export DOCKER_IMAGE_NAME=pamela-agent  # Default: pamela-agent
export DOCKER_IMAGE_TAG=latest          # Default: latest
export TEE_AGENT_NAME=pamela-tee-agent  # Default: pamela-tee-agent

# Deploy to Phala TEE (secure enclave)
./deploy-phala.sh

# Or run with docker-compose
docker-compose up
```

The deployment scripts will use these environment variables to:
- Build and tag your Docker image as `${DOCKER_USERNAME}/${DOCKER_IMAGE_NAME}:${DOCKER_IMAGE_TAG}`
- Push to your Docker Hub account
- Deploy to Phala TEE with proper environment variable injection

### Running Pamela

```bash
# Development (local)
npm run dev

# Production (Railway deployment)
railway up --detach

# Docker testing (requires DOCKER_USERNAME env var)
docker-compose up

# Run tests
npm test

# Deploy to Railway (24/7 operation)
./scripts/deploy-railway.sh

# Deploy to Phala TEE (secure trading)
export DOCKER_USERNAME=your-dockerhub-username
./deploy-phala.sh
```


## Trading Capabilities


### Natural Language Trading
```
"Show me markets about the 2028 election"
"Buy $25 of YES on Trump winning at 65 cents"
"What's my current portfolio value?"
```

## Architecture

### Plugin System
- **Core Plugin**: Basic conversational capabilities
- **Polymarket Plugin**: Trading and market analysis
- **Bootstrap Plugin**: Message handling and routing
- **Discord Plugin**: Discord bot integration (optional)
- **Telegram Plugin**: Telegram bot integration (optional)


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

## Contributing

We welcome contributions to Pamela! This is an active open-source project focused on autonomous prediction market trading.


### Pull Request Process
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


## Support

- **Issues**: [GitHub Issues](https://github.com/your-org/pamela/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/pamela/discussions)
- **Security**: See [SECURITY.md](SECURITY.md) for reporting vulnerabilities

---

**⚠️ Disclaimer**: Pamela is experimental software for educational and research purposes. Trading prediction markets involves financial risk. Use at your own discretion and never trade more than you can afford to lose.