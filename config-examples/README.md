# Agent Configuration Examples

This directory contains example configuration files for deploying trading agents via SPMC (Prediction Market Aggregation Platform) integration.

## Overview

Each configuration file defines:
- **Agent identity**: UUID, character name, personality
- **Trading strategy**: SPMC index-following or custom trading model
- **Environment variables**: Trading parameters, API keys, feature flags

## Configuration Structure

### Top-Level Fields

```json
{
  "agent_id": "uuid-format",           // Unique identifier for agent
  "agent_character": "character-name", // Character name to load
  "character": { },                    // Full character definition
  "trading_strategy": "spmc_index|custom_model",
  "environment": { }                   // Environment variable overrides
}
```

### Character Definition

The `character` object must include:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Must match `agent_id` |
| `name` | String | Yes | Display name for agent |
| `system` | String | Yes | System prompt defining agent role and behavior |
| `bio` | Array | Yes | Background information as string array |
| `topics` | Array | Yes | Topics agent can discuss |
| `adjectives` | Array | Yes | Personality traits |
| `style` | Object | Yes | Communication style guidelines |
| `messageExamples` | Array | No | Example messages (can be empty) |
| `settings` | Object | Yes | Agent settings (avatar, autoJoinChannels) |

### Environment Variables

Common variables across all agents:

**Core Identity:**
- `AGENT_CHARACTER`: Character name to load from registry

**Trading Controls:**
- `TRADING_ENABLED`: Enable/disable trading (`true`/`false`)
- `UNSUPERVISED_MODE`: Allow autonomous trading without approval
- `MAX_POSITION_SIZE`: Maximum USDC per position
- `MIN_CONFIDENCE_THRESHOLD`: Minimum confidence score (0.0-1.0)
- `MAX_DAILY_TRADES`: Daily trade limit
- `MAX_OPEN_POSITIONS`: Maximum concurrent positions
- `RISK_LIMIT_PER_TRADE`: Maximum USDC risk per trade

**Index Trading (for SPMC index followers):**
- `INDEX_TRADING_ENABLED`: Enable index-following strategy
- `SPMC_INDEX_ID`: The index/group ID to track
- `INDEX_REBALANCE_DAY`: Day for rebalancing (MONDAY, TUESDAY, etc.)
- `INDEX_REBALANCE_HOUR`: Hour for rebalancing (0-23)

**Service Intervals:**
- `NEWS_CHECK_INTERVAL_MINUTES`: How often to check news (default: 30)
- `REDEMPTION_CHECK_INTERVAL_MINUTES`: How often to check for redeemable positions (default: 60)
- `MARKET_SCAN_INTERVAL_MINUTES`: How often to scan for opportunities (custom traders)

## Agent Profiles

### Pamela
**Strategy**: Custom trading model with news-driven confidence scoring
**Personality**: Independent, confident, contrarian trader
**Trading Style**: News-driven signals, contrarian positions, moderate risk
**Config**: [pamela.json](pamela.json)

**Key Settings:**
- MAX_POSITION_SIZE: 100 USDC
- MIN_CONFIDENCE_THRESHOLD: 0.7
- MAX_DAILY_TRADES: 10
- Focuses on news analysis and confidence scoring

### Lib Out
**Strategy**: SPMC index follower (systematic)
**Personality**: Disciplined, data-driven, methodical
**Trading Style**: Pure index replication, no discretionary trades
**Config**: [lib-out.json](lib-out.json)

**Key Settings:**
- INDEX_TRADING_ENABLED: true
- MAX_POSITION_SIZE: 500 USDC
- Rebalances weekly (Monday 9 AM)
- Strictly follows index allocations

### Chalk Eater
**Strategy**: Custom model targeting high-probability, expiring markets
**Personality**: Aggressive, manic, high-frequency
**Trading Style**: Large positions on heavy favorites, rapid turnover
**Config**: [chalk-eater.json](chalk-eater.json)

**Key Settings:**
- MAX_POSITION_SIZE: 200 USDC
- MIN_CONFIDENCE_THRESHOLD: 0.85 (very high)
- MAX_DAILY_TRADES: 50 (high frequency)
- MARKET_SCAN_INTERVAL: 5 minutes

### Nothing Ever Happens
**Strategy**: SPMC contrarian index follower
**Personality**: Skeptical, contrarian, stability-focused
**Trading Style**: Mean reversion, status quo bias, index-following
**Config**: [nothing-ever-happens.json](nothing-ever-happens.json)

**Key Settings:**
- INDEX_TRADING_ENABLED: true
- Contrarian/stability index
- Emphasizes boring, stable outcomes
- Skeptical of dramatic predictions

### Trumped Up
**Strategy**: SPMC political markets index follower
**Personality**: Political market specialist, systematic
**Trading Style**: Index-following focused on political/election markets
**Config**: [trumped-up.json](trumped-up.json)

**Key Settings:**
- INDEX_TRADING_ENABLED: true
- Political markets index
- Tracks electoral dynamics
- Strictly methodical execution

## Using Configurations

### Local Development

1. Copy example config to `.env` format:
```bash
cp config-examples/pamela.json /app/config.json
```

2. Set environment variables from config:
```bash
export AGENT_CHARACTER=pamela
export TRADING_ENABLED=true
# ... other variables
```

3. Run agent:
```bash
npm run dev
```

### SPMC Deployment

SPMC will inject the configuration automatically at `/app/config.json` during deployment:

1. Create git tag:
```bash
./scripts/create-deployment-tag.sh pamela v1.0.0
```

2. SPMC pulls the tag and injects config:
```bash
docker build \
  --build-arg AGENT_ID=885c8140-1f94-4be4-b553-ab5558b4d800 \
  --build-arg AGENT_CHARACTER=pamela \
  --build-arg GIT_TAG=pamela-v1.0.0 \
  --build-arg GIT_COMMIT_SHA=abc123 \
  -t trading-agent:pamela \
  .
```

3. Container starts with injected config at `/app/config.json`

### Configuration Priority

The agent loads configuration with the following priority:

1. **SPMC injected config** (`/app/config.json` or `CONFIG_PATH`)
2. **Legacy monorepo config** (`agents/<name>/agent-config.json`)
3. **Character registry** (`src/characters/<name>.ts`)
4. **Default character** (`pamela`)

## Required Secrets

These values should be provided separately (not in config files):

**Required:**
- `POLYMARKET_PRIVATE_KEY`: Polygon wallet private key (0x...)
- At least one LLM provider:
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `OLLAMA_API_ENDPOINT`

**Optional:**
- `TELEGRAM_BOT_TOKEN`: For Telegram bot interface
- `DISCORD_API_TOKEN`: For Discord bot interface
- `TWITTER_*`: Twitter API credentials

**Blockchain:**
- `POLYGON_RPC_URL`: Polygon RPC endpoint (default: public endpoint)
- `USDC_ADDRESS`: USDC token address (default: Polygon mainnet)

## Customizing Configurations

To create a new agent configuration:

1. **Generate UUID**: Visit [uuidgenerator.net](https://www.uuidgenerator.net/version4)

2. **Copy template**:
```bash
cp config-examples/pamela.json config-examples/my-agent.json
```

3. **Update fields**:
   - `agent_id`: Your new UUID
   - `agent_character`: Your agent name
   - `character.id`: Same as agent_id
   - `character.name`: Display name
   - `character.system`: Define trading philosophy
   - `character.bio`: Agent background
   - `character.style`: Communication patterns
   - `environment`: Trading parameters

4. **Create character file** (optional, for registry):
```typescript
// src/characters/my-agent.ts
import { type Character } from "@elizaos/core";

export const myAgent: Character = {
  // Copy character definition from JSON
};
```

5. **Register character** (optional):
```typescript
// src/characters/index.ts
export { myAgent } from "./my-agent.js";
```

## Testing Configurations

Test configuration loading locally:

```bash
# Test character loading
tsx scripts/test-character-loading.ts

# Test with specific config
export CONFIG_PATH=/path/to/config.json
npm run dev
```

Verify API endpoints:

```bash
# Health check
curl http://localhost:8080/health

# Wallet address
curl http://localhost:8080/wallet
```

## Deployment Checklist

Before deploying a new agent:

- [ ] UUID generated and unique
- [ ] Character definition complete (all required fields)
- [ ] Trading strategy configured (SPMC index or custom model)
- [ ] Environment variables set appropriately
- [ ] Wallet generated and funded with USDC
- [ ] LLM API keys configured
- [ ] Git tag created with version
- [ ] Configuration tested locally
- [ ] API endpoints responding correctly
- [ ] Telegram bot created (if using)

## Support

For issues or questions:
- Review [CLAUDE.md](../CLAUDE.md) for full development guide
- Check [FORKING.md](../FORKING.md) for customization instructions
- Test locally before SPMC deployment
- Verify all required secrets are provided separately
