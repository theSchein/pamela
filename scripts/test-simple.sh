#!/bin/bash

# Simple Local Testing Script (using PGLite)
set -e

echo "🚀 Starting simple local testing environment (PGLite)..."

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

# Start services with simple compose file
echo "📦 Starting services with docker-compose (PGLite)..."
docker-compose -f docker-compose.simple.yml down
docker-compose -f docker-compose.simple.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check agent health
echo "🔍 Checking agent health..."
if curl -f http://localhost:3000/api/health; then
    echo "✅ Agent is healthy"
else
    echo "❌ Agent health check failed"
    docker-compose -f docker-compose.simple.yml logs agent
    exit 1
fi

# Check frontend
echo "🔍 Checking frontend..."
if curl -f http://localhost:5173; then
    echo "✅ Frontend is accessible"
else
    echo "❌ Frontend check failed"
    docker-compose -f docker-compose.simple.yml logs web
    exit 1
fi

echo ""
echo "✅ All services are running!"
echo ""
echo "📝 Access points:"
echo "   - Frontend: http://localhost:5173"
echo "   - Agent API: http://localhost:3000"
echo "   - WebSocket: ws://localhost:3001"
echo ""
echo "📊 View logs:"
echo "   - All: docker-compose -f docker-compose.simple.yml logs -f"
echo "   - Agent: docker-compose -f docker-compose.simple.yml logs -f agent"
echo "   - Web: docker-compose -f docker-compose.simple.yml logs -f web"
echo ""
echo "🛑 Stop services:"
echo "   docker-compose -f docker-compose.simple.yml down"