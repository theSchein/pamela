#!/bin/bash

# Railway Deployment Script for Pamela Agent
# This script helps prepare and deploy the agent to Railway

set -e

echo "🚂 Railway Deployment Helper for Pamela Agent"
echo "============================================"

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI is not installed"
    echo "📦 Install it with: npm install -g @railway/cli"
    echo "   Or visit: https://docs.railway.app/develop/cli"
    exit 1
fi

# Function to check required environment variables
check_env_vars() {
    local missing_vars=()
    
    # Required variables
    local required_vars=(
        "DISCORD_API_TOKEN"
        "OPENAI_API_KEY"
        "POLYMARKET_PRIVATE_KEY"
    )
    
    echo "📋 Checking environment variables..."
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        else
            echo "   ✅ $var is set"
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        echo ""
        echo "⚠️  Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "   - $var"
        done
        echo ""
        echo "Please set these in your Railway project dashboard:"
        echo "https://railway.app/project/[your-project-id]/settings/variables"
        return 1
    fi
    
    echo "✅ All required environment variables are set"
    return 0
}

# Function to set Railway environment variables
set_railway_vars() {
    echo "📝 Setting Railway environment variables..."
    
    # Load from .env file if it exists
    if [ -f .env ]; then
        echo "   Loading variables from .env file..."
        
        # Set each variable in Railway
        while IFS='=' read -r key value; do
            # Skip comments and empty lines
            [[ "$key" =~ ^#.*$ ]] && continue
            [[ -z "$key" ]] && continue
            
            # Remove quotes from value
            value="${value%\"}"
            value="${value#\"}"
            value="${value%\'}"
            value="${value#\'}"
            
            echo "   Setting $key..."
            railway variables set "$key=$value" --service pamela-agent 2>/dev/null || true
        done < .env
        
        echo "✅ Environment variables uploaded to Railway"
    else
        echo "⚠️  No .env file found. Please set variables manually in Railway dashboard"
    fi
}

# Function to deploy to Railway
deploy_to_railway() {
    echo "🚀 Deploying to Railway..."
    
    # Check if we're in a Railway project
    if ! railway status &> /dev/null; then
        echo "📦 Linking to Railway project..."
        railway link
    fi
    
    # Deploy
    echo "📤 Starting deployment..."
    railway up --detach
    
    echo ""
    echo "✅ Deployment initiated!"
    echo ""
    echo "📊 Monitor your deployment at:"
    railway open
}

# Main execution
main() {
    echo ""
    
    # Check if .env exists
    if [ ! -f .env ]; then
        echo "⚠️  Warning: .env file not found"
        echo "   You'll need to set environment variables in Railway dashboard"
        echo ""
    fi
    
    # Options menu
    echo "What would you like to do?"
    echo "1) Full deployment (set vars + deploy)"
    echo "2) Deploy only (vars already set)"
    echo "3) Set environment variables only"
    echo "4) Check deployment status"
    echo "5) View logs"
    echo "6) Exit"
    echo ""
    read -p "Select option (1-6): " option
    
    case $option in
        1)
            set_railway_vars
            deploy_to_railway
            ;;
        2)
            deploy_to_railway
            ;;
        3)
            set_railway_vars
            ;;
        4)
            echo "📊 Checking deployment status..."
            railway status
            railway logs --tail 20
            ;;
        5)
            echo "📜 Viewing recent logs..."
            railway logs --tail 50
            ;;
        6)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "❌ Invalid option"
            exit 1
            ;;
    esac
    
    echo ""
    echo "🎉 Done!"
    echo ""
    echo "📚 Next steps:"
    echo "   1. Check deployment status: railway logs"
    echo "   2. Open Railway dashboard: railway open"
    echo "   3. Test health endpoint: curl https://[your-app].railway.app/health"
    echo "   4. Add your Discord bot to a server and test it!"
}

# Run main function
main