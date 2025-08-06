#!/bin/bash

# Railway CLI Deployment Script
# This script helps deploy Pamela to Railway

set -e

echo "🚂 Railway Deployment for Pamela Agent"
echo "======================================"
echo ""

# Check if logged in
echo "✅ Checking Railway CLI login..."
railway whoami || {
    echo "❌ Not logged in to Railway"
    echo "Please run: railway login"
    exit 1
}

echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Create or link a Railway project:"
echo "   railway init        # Create new project"
echo "   OR"
echo "   railway link        # Link existing project"
echo ""
echo "2. Set environment variables from your .env file:"
echo ""

# Read .env file and generate railway variables commands
if [ -f .env ]; then
    echo "   # Copy and paste these commands:"
    echo "   # ================================"
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ "$key" =~ ^#.*$ ]] && continue
        [[ -z "$key" ]] && continue
        
        # Remove quotes from value
        value="${value%\"}"
        value="${value#\"}"
        value="${value%\'}"
        value="${value#\'}"
        
        # Escape special characters for shell
        value="${value//\$/\\\$}"
        value="${value//\`/\\\`}"
        
        echo "   railway variables set \"$key=$value\""
    done < .env
    echo "   # ================================"
else
    echo "   ⚠️  No .env file found. Set variables manually:"
    echo "   railway variables set DISCORD_API_TOKEN=your_token"
    echo "   railway variables set OPENAI_API_KEY=your_key"
    echo "   railway variables set POLYMARKET_PRIVATE_KEY=your_key"
fi

echo ""
echo "3. Deploy the application:"
echo "   railway up"
echo ""
echo "4. Check deployment status:"
echo "   railway logs --tail 50"
echo ""
echo "5. Open Railway dashboard:"
echo "   railway open"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎯 Quick Deploy Commands (run in order):"
echo ""
echo "railway init                    # Create project"
echo "./deploy-now.sh --set-vars      # Set all variables"
echo "railway up                       # Deploy"
echo ""

# Handle --set-vars flag
if [ "$1" == "--set-vars" ]; then
    echo "📝 Setting environment variables..."
    if [ -f .env ]; then
        while IFS='=' read -r key value; do
            # Skip comments and empty lines
            [[ "$key" =~ ^#.*$ ]] && continue
            [[ -z "$key" ]] && continue
            
            # Remove quotes
            value="${value%\"}"
            value="${value#\"}"
            value="${value%\'}"
            value="${value#\'}"
            
            echo "Setting $key..."
            railway variables set "$key=$value" 2>/dev/null || echo "  ⚠️  Failed to set $key"
        done < .env
        echo "✅ Environment variables set!"
        echo ""
        echo "Now run: railway up"
    else
        echo "❌ No .env file found"
        exit 1
    fi
fi