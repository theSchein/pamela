# PaMeLa - Prediction Market Layer  

<div align="center">

![Pamela Logo](/images/pamela.png)

**A Prediction Market Trading Agent Framework**

[![Website](https://img.shields.io/badge/Website-pamelabot.watch-blue)](https://pamelabot.watch)
[![Telegram Bot](https://img.shields.io/badge/Telegram-%40pamela__pm__bot-0088cc)](https://t.me/pamela_pm_bot)
[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built on ElizaOS](https://img.shields.io/badge/Built%20on-ElizaOS-purple)](https://github.com/elizaos/eliza)

</div>

## What is Pamela?

Pamela is an autonomous AI agent that trades prediction markets 24/7. She analyzes news, evaluates probabilities, and executes trades on Polymarket. This agent is capable of trading autonomously or according to the direction of user prompts over telegram. Built on ElizaOS, she demonstrates how AI agents can participate in prediction markets.

**Use this repository as a template to create your own trading agent!** Fork it, customize the character, and deploy your own unique strategy. See [FORKING.md](FORKING.md) for detailed instructions.

<div align="center">
  <table>
    <tr>
      <td align="center">
        <img src="/images/tg_pam.jpeg" width="300" alt="Telegram Interface">
        <br><b>Chat with Pamela on Telegram</b>
      </td>
      <td align="center">
        <img src="/images/pamela_monitor.png" width="400" alt="Web Monitor">
        <br><b>Track live at <a href="https://pamelabot.watch">pamelabot.watch</a></b>
      </td>
    </tr>
  </table>
</div>

### Features
-  **Fully Autonomous**: Trades 24/7 without supervision
-  **Telegram Bot**: Chat interface for monitoring and commands at @pamela_pm_bot
-  **Web Dashboard**: Real-time portfolio tracking at [pamelabot.watch](https://pamelabot.watch)
-  **News Analysis**: Processes breaking news for trading signals
-  **Risk Management**: Built-in position limits and safety controls
-  **TEE Ready**: Deployable to secure enclaves for verifiable trading

## Quick Start

### Prerequisites
- Node.js 20+ and Bun runtime (required)
- Docker & Docker Compose (for containerized testing)
- Polygon wallet with USDC.e for trading
- LLM API key (Anthropic, OpenAI, or others) (local llm coming soon)
- Telegram Bot Token 


### Project Structure

```
pamela/
├── src/               # Agent source (ElizaOS + character)
├── web/              # Dashboard at pamelabot.watch
├── shared/           # Shared types and constants
├── scripts/          # Deployment and monitoring tools
├── images/           # Screenshots and assets
└── docs/             # Documentation
```

### Installation

```bash
# Clone the repository
git clone https://github.com/theSchein/pamela
cd pamela

# Install manually
npm install
cp .env.example .env
# Edit .env with your API keys and settings

# OR quick start with Docker
cp .env.example .env
# Edit .env with your API keys
docker-compose up
```


### Configuration

```bash
# Copy and configure environment variables
cp .env.example .env
# Edit .env with:
# - Your wallet private key
# - LLM API keys (OpenAI, Anthropic, etc.)
# - Trading parameters
# - Optional: Telegram bot token, social media keys
```

### Running Pamela

```bash
# For first-time setup with a fresh database (ElizaOS 1.6.1 requirement)
# This creates the agent record in the database before starting
export AGENT_CHARACTER=pamela  # or your agent name
node scripts/setup-agent-db.mjs

# Development mode
npm run dev

# Production mode
npm start

# With web dashboard
npm run dev:all  # Runs both agent and web dashboard

# For multi-agent monorepo setup
export AGENT_CHARACTER=lib-out  # Set which agent to run
node scripts/setup-agent-db.mjs  # One-time setup for this agent
npm run dev
```

### Docker & TEE Deployment

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



## Contributing

We welcome contributions to Pamela! This is an active open-source project focused on autonomous prediction market trading.


### Pull Request Process
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


## Customization & Forking

This repository is designed to be forked and customized for your own trading agent:

1. **Read the Forking Guide**: See [FORKING.md](FORKING.md) for detailed instructions
2. **Customize Character**: Edit `src/character.ts` with your agent's personality
3. **Configure Strategy**: Adjust trading parameters in `.env`
4. **Deploy Your Agent**: Use the same deployment methods with your configuration

## Support

- **Issues**: [GitHub Issues](https://github.com/theSchein/pamela/issues)
- **Discussions**: [GitHub Discussions](https://github.com/theSchein/pamela/discussions)
- **Documentation**: Check `/docs` folder for guides


---

**⚠️ Disclaimer**: Pamela is experimental software for educational and research purposes. Trading prediction markets involves financial risk. Use at your own discretion and never trade more than you can afford to lose.