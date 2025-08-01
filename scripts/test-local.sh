#!/bin/bash

# Local Testing Script
set -e

echo "🚀 Starting local testing environment..."

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

# Start services
echo "📦 Starting services with docker-compose..."
docker-compose down
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check agent health
echo "🔍 Checking agent health..."
curl -f http://localhost:3000/api/health || {
    echo "❌ Agent health check failed"
    docker-compose logs agent
    exit 1
}

# Check frontend
echo "🔍 Checking frontend..."
curl -f http://localhost:5173 || {
    echo "❌ Frontend check failed"
    docker-compose logs web
    exit 1
}

echo "✅ All services are running!"
echo ""
echo "📝 Access points:"
echo "   - Frontend: http://localhost:5173"
echo "   - Agent API: http://localhost:3000"
echo "   - WebSocket: ws://localhost:3001"
echo ""
echo "📊 View logs:"
echo "   - All: docker-compose logs -f"
echo "   - Agent: docker-compose logs -f agent"
echo "   - Web: docker-compose logs -f web"
echo ""
echo "🛑 Stop services:"
echo "   docker-compose down"