#!/bin/bash

# logs-agent.sh - View logs for a specific agent
# Usage: ./scripts/logs-agent.sh <agent-name> [--follow]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

if [ -z "$1" ]; then
    echo -e "${RED}Error: Agent name required${NC}"
    echo "Usage: $0 <agent-name> [--follow]"
    echo ""
    echo "Available agents:"
    ls -1 agents/ 2>/dev/null | grep -v "^\." || echo "  (no agents configured yet)"
    exit 1
fi

AGENT_NAME="$1"
AGENT_DIR="agents/$AGENT_NAME"
FOLLOW_FLAG=""

if [ "$2" = "--follow" ] || [ "$2" = "-f" ]; then
    FOLLOW_FLAG="-f"
fi

if [ ! -d "$AGENT_DIR" ]; then
    echo -e "${RED}Error: Agent directory '$AGENT_DIR' does not exist${NC}"
    exit 1
fi

if [ ! -f "$AGENT_DIR/docker-compose.yml" ]; then
    echo -e "${RED}Error: Docker compose file not found for $AGENT_NAME${NC}"
    echo "Generate Docker configs with: ./scripts/generate-docker-configs.sh $AGENT_NAME"
    exit 1
fi

echo -e "${GREEN}Viewing logs for $AGENT_NAME...${NC}"
echo ""

cd "$AGENT_DIR"
docker-compose logs $FOLLOW_FLAG
