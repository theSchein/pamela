#!/bin/bash

# Discord Bot Quick Start Script
# This script starts the Pamela Discord bot with trading capabilities

set -e

# Add Bun to PATH if installed
if [ -d "$HOME/.bun/bin" ]; then
    export PATH="$HOME/.bun/bin:$PATH"
fi

echo "🤖 Starting Pamela Discord Bot..."

# Check if .env exists in root
if [ ! -f .env ]; then
    echo "❌ Missing .env file"
    echo "   Please create one from .env.example and configure your keys"
    exit 1
fi

# Load environment variables from root
source .env

# Check required variables
if [ -z "$DISCORD_API_TOKEN" ]; then
    echo "❌ DISCORD_API_TOKEN is not set in .env"
    echo "   Get your bot token from: https://discord.com/developers/applications"
    exit 1
fi

if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OPENAI_API_KEY is not set in .env"
    exit 1
fi

if [ -z "$POLYMARKET_PRIVATE_KEY" ]; then
    echo "⚠️  Warning: POLYMARKET_PRIVATE_KEY is not set - trading features will be limited"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "✅ Environment configured"
echo "🚀 Starting Discord bot..."
echo "📍 Bot will connect to Discord and start responding to messages"
echo "💬 Use @mention or DM the bot to interact"
echo ""

# Start the bot using Bun directly
if command -v bun &> /dev/null; then
    echo "Using Bun to start the agent..."
    bun run start:eliza
else
    echo "Bun not found, using npm..."
    npm start
fi