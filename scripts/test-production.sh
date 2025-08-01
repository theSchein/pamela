#!/bin/bash

# Production Build Testing Script
set -e

echo "🏗️ Testing production build locally..."

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ .env.local not found!"
    echo "Please copy .env.local.example to .env.local and fill in your values"
    exit 1
fi

# Load environment variables
export $(cat .env.local | grep -v '^#' | xargs)

# Check required variables
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OPENAI_API_KEY is not set in .env.local"
    exit 1
fi

if [ -z "$POLYMARKET_PRIVATE_KEY" ]; then
    echo "❌ POLYMARKET_PRIVATE_KEY is not set in .env.local"
    exit 1
fi

# Build and start production services
echo "📦 Building production images..."
docker-compose -f docker-compose.prod.yml build

echo "🚀 Starting production services..."
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

# Wait for services
echo "⏳ Waiting for services to start..."
sleep 15

# Health checks
echo "🔍 Running health checks..."

# Check agent
if curl -f http://localhost:3000/api/health; then
    echo "✅ Agent is healthy"
else
    echo "❌ Agent health check failed"
    docker-compose -f docker-compose.prod.yml logs agent
    exit 1
fi

# Check frontend
if curl -f http://localhost:80; then
    echo "✅ Frontend is accessible"
else
    echo "❌ Frontend check failed"
    docker-compose -f docker-compose.prod.yml logs web
    exit 1
fi

echo ""
echo "✅ Production build is running!"
echo ""
echo "📝 Access points:"
echo "   - Frontend: http://localhost"
echo "   - Agent API: http://localhost:3000"
echo ""
echo "📊 View logs:"
echo "   - All: docker-compose -f docker-compose.prod.yml logs -f"
echo "   - Agent: docker-compose -f docker-compose.prod.yml logs -f agent"
echo "   - Web: docker-compose -f docker-compose.prod.yml logs -f web"
echo ""
echo "🛑 Stop services:"
echo "   docker-compose -f docker-compose.prod.yml down"