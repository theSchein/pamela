# PaMeLa - Prediction Market Layer 
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

Pamela is a framework prediction market trading agent to independently execute trades on Polymarket using her own Polygon wallet. The agent is able to trade autonomously using its own signals and models as well as take order requests from users over telegram. Built on ElizaOS, this is an example implementation of the @plugin-polymarket to bring Polymarket trading action to agents. 


### Key Capabilities
- **Autonomous Trading**: Executes buy, sell, and redemption orders independently
- **Market Intelligence**: Real-time analysis of 1000+ prediction markets
- **Risk Management**: Built-in position sizing and safety controls
- **Natural Language Interface**: Accepts trading commands in plain English
- **Portfolio Management**: Tracks positions, performance, and P&L
- **CLOB Integration**: Direct connection to Polymarket's order book
- **External Signals**: Integrates the news plugins and language processing to perform sentiment analysis on  real news stories
- **Telegram Interface**: Communitcate with the agent to monitor status and initiate orders
- ****:

## Quick Start

### Prerequisites
- Node.js 20+ and Bun runtime (required)
- Docker & Docker Compose (for containerized testing)
- Polygon wallet with USDC.e for trading
- LLM API key (Anthropic, OpenAI, or others)
- Telegram Bot Token 


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
git clone https://github.com/theSchein/pamela
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
elizaos dev


# Docker testing (requires DOCKER_USERNAME env var)
docker-compose up

# Run tests
npm test


# Deploy to Phala TEE (secure trading)
export DOCKER_USERNAME=your-dockerhub-username
./deploy-phala.sh
```


## Contributing

We welcome contributions to Pamela! This is an active open-source project focused on autonomous prediction market trading.


### Pull Request Process
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


## Support

- **Issues**: [GitHub Issues](https://github.com/theSchein/pamela/issues)
- **Discussions**: [GitHub Discussions](https://github.com/theSchein/pamela/discussions)
- **Questions**: Email me at ben@spmc.dev


---

**⚠️ Disclaimer**: Pamela is experimental software for educational and research purposes. Trading prediction markets involves financial risk. Use at your own discretion and never trade more than you can afford to lose.