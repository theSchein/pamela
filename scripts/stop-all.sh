#!/bin/bash

# stop-all.sh - Stop all running agents
# Usage: ./scripts/stop-all.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "==========================================="
echo "  Stopping All Trading Agents"
echo "==========================================="
echo ""

# Find all agents with docker-compose.yml files
AGENTS=$(find agents -maxdepth 2 -name "docker-compose.yml" -exec dirname {} \; | sed 's|agents/||' | sort)

if [ -z "$AGENTS" ]; then
    echo -e "${YELLOW}No agents with Docker configurations found.${NC}"
    exit 0
fi

echo "Found agents:"
for agent in $AGENTS; do
    echo "  - $agent"
done
echo ""

# Stop each agent
STOPPED=0

for agent in $AGENTS; do
    echo "Stopping $agent..."
    cd "agents/$agent"

    if docker-compose down; then
        echo -e "${GREEN}✅ $agent stopped${NC}"
        STOPPED=$((STOPPED + 1))
    else
        echo -e "${RED}❌ Failed to stop $agent${NC}"
    fi

    cd ../..
    echo ""
done

echo "==========================================="
echo "  Stopped $STOPPED agent(s)"
echo "==========================================="
