# Forking Guide - Create Your Own Trading Agent

This guide will help you fork Pamela and create your own unique prediction market trading agent with a custom personality and strategy.

## Quick Start (30 minutes)

### Step 1: Fork & Clone
```bash
# Fork this repository on GitHub first, then:
git clone https://github.com/YOUR_USERNAME/YOUR_AGENT_NAME
cd YOUR_AGENT_NAME
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Your Agent
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration:
# - Generate new wallet or use existing
# - Add your API keys
# - Customize trading parameters
```

### Step 4: Customize Character
Edit `src/character.ts` to define your agent's personality. See detailed instructions below.

### Step 5: Run Your Agent
```bash
npm run dev  # Development mode
npm start    # Production mode
```

## Detailed Customization Guide

### 1. Environment Configuration (.env)

#### Required Changes:
```env
# Generate new UUID at https://www.uuidgenerator.net/
AGENT_ID=your-new-uuid-here
AGENT_NAME=YourAgentName

# Your wallet (generate with: npm run wallet:new)
POLYMARKET_PRIVATE_KEY=0x_your_private_key
WALLET_PRIVATE_KEY=0x_your_private_key
PRIVATE_KEY=0x_your_private_key
EVM_PRIVATE_KEY=0x_your_private_key
```

#### Strategy Customization:
```env
# Conservative Strategy Example
MIN_CONFIDENCE_THRESHOLD=0.85  # Very high confidence required
MAX_POSITION_SIZE=50           # Smaller positions
RISK_LIMIT_PER_TRADE=25        # Lower risk per trade

# Aggressive Strategy Example  
MIN_CONFIDENCE_THRESHOLD=0.60  # Lower confidence acceptable
MAX_POSITION_SIZE=200          # Larger positions
RISK_LIMIT_PER_TRADE=100       # Higher risk tolerance

# Index Following Strategy
INDEX_TRADING_ENABLED=true
SPMC_INDEX_ID=your-chosen-index
```

### 2. Character Definition (src/character.ts)

Your agent's personality is defined in `src/character.ts`. Here's what to customize:

#### Basic Identity:
```typescript
export const character: Character = {
  name: "YourAgentName",  // Change this
  id: "your-uuid-here",    // Use the UUID from .env
```

#### System Prompt (Trading Philosophy):
```typescript
system: "You are [AgentName], a [description of trading style]. You [key behaviors]. You focus on [market types]. You believe [core philosophy]."
```

#### Example System Prompts:

**Conservative Value Investor:**
```typescript
system: "You are Alice, a conservative value investor focusing on long-term political and economic markets. You only trade when you have high confidence based on fundamental analysis. You believe in patient, research-driven decisions and never chase trends."
```

**Aggressive Day Trader:**
```typescript
system: "You are Bob, an aggressive day trader specializing in sports and short-term event markets. You make quick decisions based on momentum and sentiment. You're comfortable with higher risk for higher rewards."
```

**News-Driven Trader:**
```typescript
system: "You are Dave, a news-driven trader who reacts quickly to breaking news. You scan multiple sources for market-moving information and trade on sentiment shifts before the crowd catches on."
```

#### Bio (Background & Personality):
```typescript
bio: [
  "Your agent's background",
  "Trading philosophy",
  "Special expertise areas",
  "Risk tolerance",
  "Personality traits",
  "Current focus areas"
]
```

#### Topics (Areas of Expertise):
```typescript
topics: [
  "prediction markets",  // Keep this
  "your specialty area",
  "specific market types",
  "relevant domains"
]
```

#### Message Examples:
Customize the conversation examples to match your agent's personality and speaking style.

### 3. Package.json Updates

Update metadata for your agent:
```json
{
  "name": "your-agent-name",
  "description": "Your agent's description",
  "repository": {
    "url": "https://github.com/YOUR_USERNAME/YOUR_REPO"
  },
  "author": "Your Name"
}
```

### 4. Telegram Bot Setup (Optional)

If you want your agent to have its own Telegram bot:

1. Create bot with BotFather:
```
/newbot
Name: Your Agent Name
Username: youragent_bot
```

2. Add to .env:
```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_BOT_USERNAME=@youragent_bot
```

3. Customize bot commands in BotFather

### 5. Custom Trading Strategies

#### Option A: Configuration-Based
Adjust parameters in `.env` for different strategies without code changes.

#### Option B: Code-Based
Create custom logic in `src/strategies/`:
```typescript
// src/strategies/myStrategy.ts
export class MyCustomStrategy {
  async evaluateMarket(market: Market): Promise<TradeSignal> {
    // Your custom logic
  }
}
```

### 6. Branding & UI Customization

#### Web Dashboard (optional):
- Update `web/components/Header.tsx` with your agent name
- Customize colors in `web/tailwind.config.js`
- Replace logos in `images/` folder

#### Social Media:
- Update Twitter/Discord usernames in `.env`
- Customize announcement templates

## Common Customization Examples

### Example 1: Sports Betting Specialist
```typescript
name: "SportsBetty",
system: "You are SportsBetty, a sports betting specialist focusing on NFL, NBA, and Premier League markets...",
bio: ["Former sports analyst", "Statistical modeling expert", ...],
topics: ["sports betting", "NFL predictions", "NBA analytics", ...]
```

### Example 2: Political Markets Expert
```typescript
name: "PoliTrader",
system: "You are PoliTrader, specializing in political prediction markets...",
bio: ["Political science background", "Election modeling expertise", ...],
topics: ["elections", "political forecasting", "polling analysis", ...]
```

### Example 3: Crypto Events Trader
```typescript
name: "CryptoOracle",
system: "You are CryptoOracle, focused on cryptocurrency milestone markets...",
bio: ["DeFi expert", "On-chain analyst", "Crypto market veteran", ...],
topics: ["bitcoin predictions", "ethereum milestones", "DeFi events", ...]
```

## Testing Your Customizations

1. **Test Configuration:**
```bash
npm run dev  # Check that agent starts with new config
```

2. **Test Trading Logic:**
```bash
# Set UNSUPERVISED_MODE=false for testing
# Use small amounts initially
```

3. **Test Telegram Bot:**
- Message your bot with /start
- Try basic commands
- Verify responses match personality

## Deployment Options

### Local Machine
```bash
npm start  # Run directly
```

### Docker Container
```bash
docker build -t my-agent .
docker run -d --env-file .env my-agent
```

### Systemd Service
```bash
sudo cp scripts/pamela.service /etc/systemd/system/my-agent.service
# Edit service file with your paths
sudo systemctl start my-agent
```

### Phala TEE (Secure Enclave)
```bash
export DOCKER_USERNAME=your-username
./deploy-phala.sh
```

## Troubleshooting

### Agent won't start
- Check all required environment variables are set
- Verify wallet has funds on Polygon
- Ensure at least one LLM API key is valid

### Character not updating
- Restart agent after changes
- Check for syntax errors in character.ts
- Verify character is exported correctly

### Trading not working
- Confirm TRADING_ENABLED=true
- Check wallet has USDC on Polygon
- Verify CLOB_API_URL is correct

## Advanced Customization

### Multiple Agents
See our [multi-agent setup guide](docs/MULTI_AGENT.md) for running multiple agents with different strategies.

### Custom Plugins
Extend functionality by adding ElizaOS plugins. See [plugin documentation](https://github.com/elizaos/eliza).

### Index Creation
Create your own index on [SPMC](https://spmc.dev) and have your agent follow it.

## Getting Help

- Review existing [character examples](src/character.ts)
- Check [ElizaOS documentation](https://github.com/elizaos/eliza)
- Open an issue for questions
- Join the community discussions

## Next Steps

1. ✅ Fork and customize your agent
2. ✅ Test thoroughly with small amounts
3. ✅ Deploy to production
4. 📊 Monitor performance
5. 🔄 Iterate and improve strategy

Happy trading! 🚀