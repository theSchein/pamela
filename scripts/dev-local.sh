#!/bin/bash

# Local Development without Docker
set -e

echo "🚀 Starting local development (no Docker)..."

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js 20+ is required (found $(node -v))"
    exit 1
fi

# Check if .env files exist
if [ ! -f apps/agent/.env ]; then
    echo "📝 Creating agent .env file..."
    cp apps/agent/.env.example apps/agent/.env
    echo "⚠️  Please edit apps/agent/.env with your API keys"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install agent dependencies
echo "📦 Installing agent dependencies..."
cd apps/agent
npm install
cd ../..

# Install web dependencies
echo "📦 Installing web dependencies..."
cd apps/web
npm install
cd ../..

# Install shared dependencies
echo "📦 Installing shared dependencies..."
cd packages/shared
npm install
cd ../..

echo ""
echo "✅ Dependencies installed!"
echo ""
echo "📝 To start development:"
echo ""
echo "Option 1 - Run both services (recommended):"
echo "  npm run dev"
echo ""
echo "Option 2 - Run services separately:"
echo "  Terminal 1: cd apps/agent && npm run dev"
echo "  Terminal 2: cd apps/web && npm run dev"
echo ""
echo "⚠️  Make sure to:"
echo "1. Edit apps/agent/.env with your API keys"
echo "2. Set TRADING_ENABLED=false for safe testing"
echo "3. Use a test Polygon wallet, not your main wallet"