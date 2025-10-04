#!/bin/bash

# deploy-all.sh - Deploy all configured agents via Docker
# Usage: ./scripts/deploy-all.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "==========================================="
echo "  Deploying All Trading Agents"
echo "==========================================="
echo ""

# Find all agents with docker-compose.yml files
AGENTS=$(find agents -maxdepth 2 -name "docker-compose.yml" -exec dirname {} \; | sed 's|agents/||' | sort)

if [ -z "$AGENTS" ]; then
    echo -e "${RED}No agents with Docker configurations found.${NC}"
    echo ""
    echo "Generate Docker configs with:"
    echo "  ./scripts/generate-docker-configs.sh <agent-name>"
    exit 1
fi

echo "Found agents:"
for agent in $AGENTS; do
    echo "  - $agent"
done
echo ""

# Ask for confirmation
read -p "Deploy all agents? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Deployment cancelled"
    exit 0
fi

echo ""

# Deploy each agent
DEPLOYED=0
FAILED=0

for agent in $AGENTS; do
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Deploying: $agent${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    cd "agents/$agent"

    if docker-compose up -d; then
        echo -e "${GREEN}✅ $agent deployed successfully${NC}"
        DEPLOYED=$((DEPLOYED + 1))
    else
        echo -e "${RED}❌ Failed to deploy $agent${NC}"
        FAILED=$((FAILED + 1))
    fi

    cd ../..
    echo ""
done

# Summary
echo "==========================================="
echo "  Deployment Summary"
echo "==========================================="
echo ""
echo -e "${GREEN}Successfully deployed: $DEPLOYED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED${NC}"
fi
echo ""

# Show all running containers
echo "Running containers:"
docker ps --filter "name=agent" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

echo "View logs for a specific agent:"
echo "  docker logs -f <agent-name>-agent"
echo ""
echo "Or use docker-compose in the agent directory:"
echo "  cd agents/<agent-name> && docker-compose logs -f"
