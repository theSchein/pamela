#!/bin/bash

# Deployment script for Pamela Trading Agent

set -e

echo "🚀 Deploying Pamela Trading Agent..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please copy .env.production.example to .env and fill in your API keys"
    exit 1
fi

# Check required environment variables
required_vars=("OPENAI_API_KEY" "POLYMARKET_PRIVATE_KEY")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: $var is not set in .env file"
        exit 1
    fi
done

# Build and deploy based on deployment method
case "${1:-docker}" in
    "docker")
        echo "📦 Building Docker images..."
        docker-compose -f docker-compose.production.yml build
        
        echo "🔄 Starting services..."
        docker-compose -f docker-compose.production.yml up -d
        
        echo "✅ Deployment complete!"
        echo "Agent: http://localhost:3000"
        echo "Frontend: http://localhost:80"
        ;;
        
    "railway")
        echo "🚂 Deploying to Railway..."
        
        if ! command -v railway &> /dev/null; then
            echo "❌ Railway CLI not found. Install with: npm install -g @railway/cli"
            exit 1
        fi
        
        echo "📤 Pushing to Railway..."
        railway up
        
        echo "✅ Deployment complete!"
        echo "Check Railway dashboard for service URLs"
        ;;
        
    "build")
        echo "🏗️ Building production artifacts..."
        
        # Build shared packages
        echo "Building shared packages..."
        npm run build:shared
        
        # Build agent
        echo "Building agent..."
        npm run build:agent
        
        # Build frontend
        echo "Building frontend..."
        npm run build:web
        
        echo "✅ Build complete!"
        ;;
        
    *)
        echo "Usage: ./deploy.sh [docker|railway|build]"
        echo "  docker  - Deploy using Docker Compose (default)"
        echo "  railway - Deploy to Railway platform"
        echo "  build   - Build production artifacts only"
        exit 1
        ;;
esac

# Show logs
if [ "${1:-docker}" = "docker" ]; then
    echo ""
    echo "📋 View logs with:"
    echo "  docker-compose -f docker-compose.production.yml logs -f agent"
    echo "  docker-compose -f docker-compose.production.yml logs -f web"
fi