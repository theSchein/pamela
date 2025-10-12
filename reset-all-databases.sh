#!/bin/bash

echo "🧹 Complete Database Reset for Trading Agents"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}This will remove ALL ElizaOS databases to fix entity creation errors${NC}"
echo "Press Ctrl+C to cancel, or wait 3 seconds to continue..."
sleep 3

# Main database directory
if [ -d ".eliza/.elizadb" ]; then
    echo -e "${YELLOW}Removing main database: .eliza/.elizadb${NC}"
    rm -rf .eliza/.elizadb
    echo -e "${GREEN}✓ Removed${NC}"
fi

# Agent-specific database for pamela
if [ -d ".eliza/.elizadb-pamela" ]; then
    echo -e "${YELLOW}Removing pamela database: .eliza/.elizadb-pamela${NC}"
    rm -rf .eliza/.elizadb-pamela
    echo -e "${GREEN}✓ Removed${NC}"
fi

# Check for any other elizadb directories
echo -e "${YELLOW}Checking for other database directories...${NC}"
for db in .eliza/.elizadb-*; do
    if [ -d "$db" ]; then
        echo -e "${YELLOW}Removing: $db${NC}"
        rm -rf "$db"
        echo -e "${GREEN}✓ Removed${NC}"
    fi
done

# Also clear any agent-specific databases in agents/ directory
for agent_dir in agents/*/; do
    if [ -d "$agent_dir/.eliza" ]; then
        echo -e "${YELLOW}Removing agent database: $agent_dir/.eliza${NC}"
        rm -rf "$agent_dir/.eliza"
        echo -e "${GREEN}✓ Removed${NC}"
    fi
done

# Ensure .eliza directory exists
mkdir -p .eliza
echo -e "${GREEN}✓ Created fresh .eliza directory${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ All databases have been reset!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Make sure AGENT_CHARACTER is set: export AGENT_CHARACTER=pamela"
echo "2. Run the agent: npm run dev"
echo ""
echo "The agent will create a fresh database on startup."