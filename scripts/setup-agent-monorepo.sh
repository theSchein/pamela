#!/bin/bash

# setup-agent-monorepo.sh - Setup script for multi-agent monorepo architecture
# This script creates a new agent in the monorepo without modifying shared code

set -e

echo "==========================================="
echo "  Multi-Agent Monorepo Setup Wizard"
echo "==========================================="
echo ""
echo "This script will create a new agent in the monorepo."
echo "Shared code remains unchanged - only agent-specific config is created."
echo ""

# Function to generate UUID
generate_uuid() {
    if command -v uuidgen &> /dev/null; then
        uuidgen | tr '[:upper:]' '[:lower:]'
    else
        # Fallback UUID generation
        echo "$(openssl rand -hex 8)-$(openssl rand -hex 4)-$(openssl rand -hex 4)-$(openssl rand -hex 4)-$(openssl rand -hex 12)"
    fi
}

# Get agent name
read -p "Enter agent name (e.g., agent1, conservative-trader): " AGENT_NAME
if [ -z "$AGENT_NAME" ]; then
    echo "Error: Agent name cannot be empty"
    exit 1
fi

# Sanitize agent name for directory/file names
AGENT_DIR=$(echo "$AGENT_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')

# Check if agent already exists
if [ -d "agents/$AGENT_DIR" ]; then
    echo "Error: Agent directory 'agents/$AGENT_DIR' already exists"
    exit 1
fi

if [ -f "src/characters/${AGENT_DIR}.ts" ]; then
    echo "Error: Character file 'src/characters/${AGENT_DIR}.ts' already exists"
    exit 1
fi

# Generate UUID
echo "Generating unique agent ID..."
AGENT_ID=$(generate_uuid)
echo "Agent ID: $AGENT_ID"

# Get display name (can have spaces and capitals)
read -p "Enter agent display name (default: $AGENT_NAME): " AGENT_DISPLAY_NAME
if [ -z "$AGENT_DISPLAY_NAME" ]; then
    AGENT_DISPLAY_NAME="$AGENT_NAME"
fi

# Get trading strategy type
echo ""
echo "Select a trading strategy template:"
echo "1) Conservative (high confidence, low risk)"
echo "2) Aggressive (lower confidence, higher risk)"
echo "3) Balanced (moderate settings)"
echo "4) News-driven (reacts to breaking news)"
echo "5) Index follower (follows SPMC index)"
echo "6) Custom (you'll configure manually)"
read -p "Enter choice (1-6): " STRATEGY_CHOICE

# Set strategy parameters based on choice
case $STRATEGY_CHOICE in
    1)
        STRATEGY_NAME="Conservative"
        MIN_CONFIDENCE="0.85"
        MAX_POSITION="50"
        RISK_LIMIT="25"
        MAX_DAILY_TRADES="5"
        ;;
    2)
        STRATEGY_NAME="Aggressive"
        MIN_CONFIDENCE="0.60"
        MAX_POSITION="200"
        RISK_LIMIT="100"
        MAX_DAILY_TRADES="20"
        ;;
    3)
        STRATEGY_NAME="Balanced"
        MIN_CONFIDENCE="0.70"
        MAX_POSITION="100"
        RISK_LIMIT="50"
        MAX_DAILY_TRADES="10"
        ;;
    4)
        STRATEGY_NAME="News-driven"
        MIN_CONFIDENCE="0.65"
        MAX_POSITION="100"
        RISK_LIMIT="50"
        MAX_DAILY_TRADES="15"
        ;;
    5)
        STRATEGY_NAME="Index"
        MIN_CONFIDENCE="0.70"
        MAX_POSITION="100"
        RISK_LIMIT="50"
        MAX_DAILY_TRADES="10"
        INDEX_ENABLED="true"
        read -p "Enter SPMC Index ID: " SPMC_INDEX_ID
        ;;
    6)
        STRATEGY_NAME="Custom"
        MIN_CONFIDENCE="0.70"
        MAX_POSITION="100"
        RISK_LIMIT="50"
        MAX_DAILY_TRADES="10"
        ;;
    *)
        echo "Invalid choice. Using balanced strategy."
        STRATEGY_NAME="Balanced"
        MIN_CONFIDENCE="0.70"
        MAX_POSITION="100"
        RISK_LIMIT="50"
        MAX_DAILY_TRADES="10"
        ;;
esac

echo "Using $STRATEGY_NAME strategy template"

# Ask about Telegram bot
echo ""
read -p "Do you have a Telegram bot token? (y/n): " HAS_TELEGRAM
if [ "$HAS_TELEGRAM" = "y" ] || [ "$HAS_TELEGRAM" = "Y" ]; then
    read -p "Enter your Telegram bot token: " TELEGRAM_TOKEN
    read -p "Enter your bot username (e.g., @mybot): " TELEGRAM_USERNAME
fi

# Create agent directory structure
echo ""
echo "Creating agent directory: agents/$AGENT_DIR"
mkdir -p "agents/$AGENT_DIR"

# Create agent .env file
echo "Creating agents/$AGENT_DIR/.env..."
cat > "agents/$AGENT_DIR/.env" << EOF
# ============================================
# AGENT CONFIGURATION - $AGENT_DISPLAY_NAME
# ============================================

# Agent Identity
AGENT_NAME=$AGENT_DISPLAY_NAME
AGENT_ID=$AGENT_ID
AGENT_CHARACTER=$AGENT_DIR

# Database Configuration (isolated per agent)
PGLITE_DATA_DIR=./.eliza/.elizadb-$AGENT_DIR

# ============================================
# LLM PROVIDER - Add your API key
# ============================================
# Option 1: OpenAI (recommended)
OPENAI_API_KEY=your_openai_api_key_here

# Option 2: Anthropic Claude
# ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Option 3: Local Ollama
# OLLAMA_API_ENDPOINT=http://localhost:11434

# ============================================
# POLYMARKET TRADING - Add your wallet key
# ============================================
# Generate new wallet with: npm run wallet:new
POLYMARKET_PRIVATE_KEY=0x_your_wallet_private_key_here

# Polymarket API Configuration
CLOB_API_URL=https://clob.polymarket.com/

# ============================================
# TRADING STRATEGY - $STRATEGY_NAME
# ============================================
TRADING_ENABLED=true
MIN_CONFIDENCE_THRESHOLD=$MIN_CONFIDENCE
MAX_POSITION_SIZE=$MAX_POSITION
RISK_LIMIT_PER_TRADE=$RISK_LIMIT
MAX_DAILY_TRADES=$MAX_DAILY_TRADES
MAX_OPEN_POSITIONS=20
UNSUPERVISED_MODE=false
AUTO_REDEMPTION=true
SIMPLE_STRATEGY_ENABLED=false
USE_HARDCODED_MARKETS=false
EOF

# Add index trading config if selected
if [ "$INDEX_ENABLED" = "true" ]; then
    cat >> "agents/$AGENT_DIR/.env" << EOF

# ============================================
# INDEX TRADING CONFIGURATION
# ============================================
INDEX_TRADING_ENABLED=true
SPMC_API_URL=https://api.spmc.dev
SPMC_INDEX_ID=$SPMC_INDEX_ID
MIN_INDEX_POSITION=10
INDEX_REBALANCE_DAY=MONDAY
INDEX_REBALANCE_HOUR=9
MAX_SLIPPAGE=0.05
EOF
fi

# Add Telegram config if provided
if [ -n "$TELEGRAM_TOKEN" ]; then
    cat >> "agents/$AGENT_DIR/.env" << EOF

# ============================================
# TELEGRAM BOT CONFIGURATION
# ============================================
TELEGRAM_BOT_TOKEN=$TELEGRAM_TOKEN
TELEGRAM_BOT_USERNAME=$TELEGRAM_USERNAME
EOF
fi

# Add optional sections
cat >> "agents/$AGENT_DIR/.env" << EOF

# ============================================
# OPTIONAL DATA SOURCES
# ============================================
# NEWS_API_KEY=your_newsapi_key
# TAVILY_API_KEY=your_tavily_key

# ============================================
# OPTIONAL SOCIAL PLATFORMS
# ============================================
# DISCORD_API_TOKEN=your_discord_token
# TWITTER_API_KEY=your_twitter_key

# ============================================
# PERFORMANCE
# ============================================
NODE_OPTIONS=--max-old-space-size=4096
LOG_LEVEL=info
EOF

echo "✅ Created agents/$AGENT_DIR/.env"

# Create character file in src/characters/
echo ""
echo "Creating character file: src/characters/${AGENT_DIR}.ts..."

cat > "src/characters/${AGENT_DIR}.ts" << 'EOF'
import { type Character } from "@elizaos/core";

/**
 * CHARACTER: ${AGENT_DISPLAY_NAME}
 * Strategy: ${STRATEGY_NAME}
 *
 * Customize this character to define your agent's unique personality,
 * trading philosophy, and communication style.
 */
export const character: Character = {
  id: "${AGENT_ID}" as `${string}-${string}-${string}-${string}-${string}`,
  name: "${AGENT_DISPLAY_NAME}",

  plugins: [
    "@elizaos/plugin-sql",
    ...(process.env.ANTHROPIC_API_KEY?.trim() ? ["@elizaos/plugin-anthropic"] : []),
    ...(process.env.OPENROUTER_API_KEY?.trim() ? ["@elizaos/plugin-openrouter"] : []),
    ...(process.env.OPENAI_API_KEY?.trim() ? ["@elizaos/plugin-openai"] : []),
    ...(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ? ["@elizaos/plugin-google-genai"] : []),
    ...(process.env.OLLAMA_API_ENDPOINT?.trim() ? ["@elizaos/plugin-ollama"] : []),
    ...(process.env.DISCORD_API_TOKEN?.trim() ? ["@elizaos/plugin-discord"] : []),
    ...(process.env.TELEGRAM_BOT_TOKEN?.trim() ? ["@elizaos/plugin-telegram"] : []),
    ...(process.env.TWITTER_API_KEY?.trim() ? ["@elizaos/plugin-twitter"] : []),
    ...(!process.env.IGNORE_BOOTSTRAP ? ["@elizaos/plugin-bootstrap"] : []),
  ],

  settings: {
    secrets: {},
    autoJoinChannels: true,
  },

  // CUSTOMIZE: Define your agent's trading philosophy and personality
  system:
    "You are ${AGENT_DISPLAY_NAME}, a ${STRATEGY_NAME} prediction market trader. " +
    "Customize this system prompt to define your unique trading approach and personality.",

  // CUSTOMIZE: Your agent's background and characteristics
  bio: [
    "Autonomous prediction market trader",
    "Strategy: ${STRATEGY_NAME}",
    "Focus: [Customize with your market focus areas]",
    "Philosophy: [Customize with your trading philosophy]",
  ],

  // CUSTOMIZE: Areas your agent specializes in
  topics: [
    "prediction markets",
    "polymarket trading",
    "market analysis",
    // Add your specific areas of expertise
  ],

  // CUSTOMIZE: Example conversations showing your agent's personality
  messageExamples: [
    [
      {
        name: "{{name1}}",
        content: { text: "What markets are you watching?" },
      },
      {
        name: "${AGENT_DISPLAY_NAME}",
        content: { text: "Customize this with your agent's conversation style..." },
      },
    ],
  ],

  style: {
    all: [
      "Customize these style guidelines",
      "Define how your agent communicates",
      "Set the tone and personality",
    ],
    chat: [
      "Specific chat behavior",
      "Response patterns",
      "Engagement style",
    ],
  },
};
EOF

# Use sed to substitute the variables (since heredoc with single quotes doesn't expand vars)
sed -i "s/\${AGENT_DISPLAY_NAME}/$AGENT_DISPLAY_NAME/g" "src/characters/${AGENT_DIR}.ts"
sed -i "s/\${AGENT_ID}/$AGENT_ID/g" "src/characters/${AGENT_DIR}.ts"
sed -i "s/\${STRATEGY_NAME}/$STRATEGY_NAME/g" "src/characters/${AGENT_DIR}.ts"

echo "✅ Created src/characters/${AGENT_DIR}.ts"

# Create agent README
echo ""
echo "Creating agents/$AGENT_DIR/README.md..."
cat > "agents/$AGENT_DIR/README.md" << EOF
# $AGENT_DISPLAY_NAME

**Agent ID:** \`$AGENT_ID\`
**Strategy:** $STRATEGY_NAME
**Character File:** \`src/characters/${AGENT_DIR}.ts\`

## Configuration

- **Environment File:** \`agents/$AGENT_DIR/.env\`
- **Database:** \`.eliza/.elizadb-$AGENT_DIR\`
- **Character:** \`src/characters/${AGENT_DIR}.ts\`

## Running This Agent

\`\`\`bash
# Local development
AGENT_CHARACTER=$AGENT_DIR npm run dev

# Using env file
export \$(cat agents/$AGENT_DIR/.env | xargs) && npm run dev

# Docker (after generating Docker configs)
cd agents/$AGENT_DIR
docker-compose up -d
\`\`\`

## Next Steps

1. Edit \`agents/$AGENT_DIR/.env\`:
   - Add your LLM API key (OPENAI_API_KEY or ANTHROPIC_API_KEY)
   - Add your wallet private key (generate with \`npm run wallet:new\`)
   - Add your Telegram bot token (if applicable)

2. Customize \`src/characters/${AGENT_DIR}.ts\`:
   - Define unique personality and trading philosophy
   - Add message examples showing conversation style
   - Set communication style preferences

3. Generate wallet:
   \`\`\`bash
   npm run wallet:new
   \`\`\`

4. Fund wallet with USDC on Polygon

5. Test locally before deploying

## Strategy Parameters

- **Confidence Threshold:** $MIN_CONFIDENCE
- **Max Position Size:** \$$MAX_POSITION
- **Risk Limit:** \$$RISK_LIMIT
- **Max Daily Trades:** $MAX_DAILY_TRADES
EOF

if [ "$INDEX_ENABLED" = "true" ]; then
    cat >> "agents/$AGENT_DIR/README.md" << EOF
- **Index Following:** Enabled
- **SPMC Index ID:** $SPMC_INDEX_ID
EOF
fi

echo "✅ Created agents/$AGENT_DIR/README.md"

# Summary
echo ""
echo "==========================================="
echo "    Agent Setup Complete!"
echo "==========================================="
echo ""
echo "Agent Name: $AGENT_DISPLAY_NAME"
echo "Agent Directory: agents/$AGENT_DIR"
echo "Agent ID: $AGENT_ID"
echo "Strategy: $STRATEGY_NAME"
echo "Character File: src/characters/${AGENT_DIR}.ts"
echo ""
echo "Next steps:"
echo "1. Edit agents/$AGENT_DIR/.env and add your API keys and wallet"
echo "2. Customize src/characters/${AGENT_DIR}.ts with unique personality"
echo "3. Generate wallet: npm run wallet:new"
echo "4. Test agent: AGENT_CHARACTER=$AGENT_DIR npm run dev"
echo "5. Generate Docker configs: ./scripts/generate-docker-configs.sh $AGENT_DIR"
echo ""
echo "See agents/$AGENT_DIR/README.md for more details"
echo ""
echo "Happy trading! 🚀"
