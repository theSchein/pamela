#!/bin/bash

# Start Telegram Bot locally

echo "🤖 Starting Pamela Telegram Bot..."

# Check if TELEGRAM_BOT_TOKEN is set
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "❌ Error: TELEGRAM_BOT_TOKEN not set in environment"
    echo "Please add TELEGRAM_BOT_TOKEN to your .env file"
    exit 1
fi

# Check if required dependencies are installed
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed"
    exit 1
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Start the bot
echo "🚀 Starting ElizaOS with Telegram plugin..."
cd apps/agent && npm start