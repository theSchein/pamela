#!/bin/bash

# setup-new-agent.sh - Interactive script to customize Pamela for your own trading agent

set -e

echo "==========================================="
echo "    Trading Agent Setup Wizard"
echo "==========================================="
echo ""
echo "This script will help you customize Pamela to create your own trading agent."
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
read -p "Enter your agent's name (e.g., Alice, TradingBot): " AGENT_NAME
if [ -z "$AGENT_NAME" ]; then
    echo "Error: Agent name cannot be empty"
    exit 1
fi

# Generate UUID
echo "Generating unique agent ID..."
AGENT_ID=$(generate_uuid)
echo "Agent ID: $AGENT_ID"

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
        ;;
    2)
        STRATEGY_NAME="Aggressive"
        MIN_CONFIDENCE="0.60"
        MAX_POSITION="200"
        RISK_LIMIT="100"
        ;;
    3)
        STRATEGY_NAME="Balanced"
        MIN_CONFIDENCE="0.70"
        MAX_POSITION="100"
        RISK_LIMIT="50"
        ;;
    4)
        STRATEGY_NAME="News-driven"
        MIN_CONFIDENCE="0.65"
        MAX_POSITION="100"
        RISK_LIMIT="50"
        ;;
    5)
        STRATEGY_NAME="Index"
        MIN_CONFIDENCE="0.70"
        MAX_POSITION="100"
        RISK_LIMIT="50"
        INDEX_ENABLED="true"
        ;;
    6)
        STRATEGY_NAME="Custom"
        MIN_CONFIDENCE="0.70"
        MAX_POSITION="100"
        RISK_LIMIT="50"
        ;;
    *)
        echo "Invalid choice. Using balanced strategy."
        STRATEGY_NAME="Balanced"
        MIN_CONFIDENCE="0.70"
        MAX_POSITION="100"
        RISK_LIMIT="50"
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

# Check if .env exists
if [ -f .env ]; then
    echo ""
    read -p ".env file exists. Create .env.new instead? (y/n): " CREATE_NEW
    if [ "$CREATE_NEW" = "y" ] || [ "$CREATE_NEW" = "Y" ]; then
        ENV_FILE=".env.new"
    else
        echo "Please backup your .env file first"
        exit 1
    fi
else
    ENV_FILE=".env"
fi

# Create customized .env file
echo ""
echo "Creating $ENV_FILE with your configuration..."

cat > $ENV_FILE << EOF
# ============================================
# AGENT CONFIGURATION - Customized by Setup Script
# ============================================

# Agent Identity
AGENT_NAME=$AGENT_NAME
AGENT_ID=$AGENT_ID

# Database Configuration
PGLITE_DATA_DIR=./.eliza/.${AGENT_NAME,,}db

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
WALLET_PRIVATE_KEY=0x_your_wallet_private_key_here
PRIVATE_KEY=0x_your_wallet_private_key_here
EVM_PRIVATE_KEY=0x_your_wallet_private_key_here

# Polymarket API Configuration
CLOB_API_URL=https://clob.polymarket.com/

# ============================================
# TRADING STRATEGY - $STRATEGY_NAME
# ============================================
TRADING_ENABLED=true
MIN_CONFIDENCE_THRESHOLD=$MIN_CONFIDENCE
MAX_POSITION_SIZE=$MAX_POSITION
RISK_LIMIT_PER_TRADE=$RISK_LIMIT
MAX_DAILY_TRADES=10
MAX_OPEN_POSITIONS=20
UNSUPERVISED_MODE=false
AUTO_REDEMPTION=true
EOF

# Add index trading config if selected
if [ "$INDEX_ENABLED" = "true" ]; then
    cat >> $ENV_FILE << EOF

# Index Trading Configuration
INDEX_TRADING_ENABLED=true
SPMC_API_URL=https://api.spmc.dev
SPMC_INDEX_ID=your-index-id-here
MIN_INDEX_POSITION=10
INDEX_REBALANCE_DAY=MONDAY
INDEX_REBALANCE_HOUR=9
EOF
fi

# Add Telegram config if provided
if [ -n "$TELEGRAM_TOKEN" ]; then
    cat >> $ENV_FILE << EOF

# ============================================
# TELEGRAM BOT CONFIGURATION
# ============================================
TELEGRAM_BOT_TOKEN=$TELEGRAM_TOKEN
TELEGRAM_BOT_USERNAME=$TELEGRAM_USERNAME
EOF
fi

# Add optional sections
cat >> $ENV_FILE << EOF

# ============================================
# OPTIONAL DATA SOURCES
# ============================================
# NEWS_API_KEY=your_newsapi_key
# TAVILY_API_KEY=your_tavily_key
# TWITTER_API_KEY=your_twitter_key
# TWITTER_API_SECRET_KEY=your_twitter_secret

# ============================================
# PERFORMANCE
# ============================================
NODE_OPTIONS=--max-old-space-size=4096
LOG_LEVEL=info
EOF

echo "✅ Created $ENV_FILE"

# Update character.ts with agent name
echo ""
echo "Updating character.ts with $AGENT_NAME..."

# Create a backup
cp src/character.ts src/character.ts.backup

# Simple replacement in character.ts (preserves most of the file)
sed -i "s/name: \"Pamela\"/name: \"$AGENT_NAME\"/" src/character.ts
sed -i "s/df35947c-da83-0a0a-aa27-c4cc3ec722cd/$AGENT_ID/" src/character.ts

echo "✅ Updated character.ts (backup saved as character.ts.backup)"

# Update package.json name
echo ""
echo "Updating package.json..."
sed -i "s/\"name\": \"pamela\"/\"name\": \"${AGENT_NAME,,}\"/" package.json
echo "✅ Updated package.json"

# Summary
echo ""
echo "==========================================="
echo "    Setup Complete!"
echo "==========================================="
echo ""
echo "Agent Name: $AGENT_NAME"
echo "Agent ID: $AGENT_ID"
echo "Strategy: $STRATEGY_NAME"
echo "Config File: $ENV_FILE"
echo ""
echo "Next steps:"
echo "1. Edit $ENV_FILE and add your API keys and wallet private key"
echo "2. Further customize src/character.ts with your agent's personality"
echo "3. Generate a wallet if needed: npm run wallet:new"
echo "4. Install dependencies: npm install"
echo "5. Run your agent: npm run dev"
echo ""
echo "For more customization options, see FORKING.md"
echo ""
echo "Happy trading! 🚀"