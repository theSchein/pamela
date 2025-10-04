#!/bin/bash

# run-agent.sh - Run a specific agent locally
# Usage: ./scripts/run-agent.sh <agent-name>

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ -z "$1" ]; then
    echo -e "${RED}Error: Agent name required${NC}"
    echo "Usage: $0 <agent-name>"
    echo ""
    echo "Available agents:"
    ls -1 agents/ 2>/dev/null | grep -v "^\." || echo "  (no agents configured yet)"
    exit 1
fi

AGENT_NAME="$1"
AGENT_DIR="agents/$AGENT_NAME"

if [ ! -d "$AGENT_DIR" ]; then
    echo -e "${RED}Error: Agent directory '$AGENT_DIR' does not exist${NC}"
    exit 1
fi

if [ ! -f "$AGENT_DIR/.env" ]; then
    echo -e "${RED}Error: Agent .env file not found: $AGENT_DIR/.env${NC}"
    exit 1
fi

echo "==========================================="
echo "  Running Agent: $AGENT_NAME"
echo "==========================================="
echo ""
echo -e "${YELLOW}Loading environment from $AGENT_DIR/.env${NC}"
echo -e "${YELLOW}Setting AGENT_CHARACTER=$AGENT_NAME${NC}"
echo ""

# Export environment variables from agent's .env file
set -a
source "$AGENT_DIR/.env"
set +a

# Override AGENT_CHARACTER to ensure correct character loads
export AGENT_CHARACTER="$AGENT_NAME"

echo -e "${GREEN}Starting agent...${NC}"
echo ""

# Run the agent
npm run dev
