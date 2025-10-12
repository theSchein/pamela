#!/bin/bash

# generate-docker-configs.sh - Generate Docker configuration files from templates
# Usage: ./scripts/generate-docker-configs.sh <agent-name> [port]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if agent name provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Agent name required${NC}"
    echo "Usage: $0 <agent-name> [port]"
    echo ""
    echo "Example: $0 agent1 3001"
    echo ""
    echo "Available agents:"
    ls -1 agents/ 2>/dev/null | grep -v "^\." || echo "  (no agents configured yet)"
    exit 1
fi

AGENT_NAME="$1"
AGENT_DIR="agents/$AGENT_NAME"

# Check if agent directory exists
if [ ! -d "$AGENT_DIR" ]; then
    echo -e "${RED}Error: Agent directory '$AGENT_DIR' does not exist${NC}"
    echo ""
    echo "Available agents:"
    ls -1 agents/ 2>/dev/null | grep -v "^\." || echo "  (no agents configured yet)"
    echo ""
    echo "Create a new agent with: ./scripts/setup-agent-monorepo.sh"
    exit 1
fi

# Check if .env file exists
if [ ! -f "$AGENT_DIR/.env" ]; then
    echo -e "${RED}Error: Agent .env file not found: $AGENT_DIR/.env${NC}"
    exit 1
fi

# Determine port (use provided port or auto-assign based on existing agents)
if [ -n "$2" ]; then
    PORT="$2"
else
    # Auto-assign port starting from 3001
    EXISTING_PORTS=$(grep -h "^      - \"[0-9]*:3000\"" agents/*/docker-compose.yml 2>/dev/null | sed 's/.*"\([0-9]*\):.*/\1/' | sort -n || echo "")
    if [ -z "$EXISTING_PORTS" ]; then
        PORT="3001"
    else
        LAST_PORT=$(echo "$EXISTING_PORTS" | tail -1)
        PORT=$((LAST_PORT + 1))
    fi
    echo -e "${YELLOW}Auto-assigning port: $PORT${NC}"
fi

echo "==========================================="
echo "  Generating Docker Configs for $AGENT_NAME"
echo "==========================================="
echo ""
echo "Agent: $AGENT_NAME"
echo "Port: $PORT"
echo "Output Directory: $AGENT_DIR"
echo ""

# Generate Dockerfile
echo "Generating Dockerfile..."
cp docker/agent.Dockerfile.template "$AGENT_DIR/Dockerfile"
# Note: The template doesn't have placeholders that need substitution
# All agent-specific config comes from .env and runtime environment variables
echo -e "${GREEN}✅ Created $AGENT_DIR/Dockerfile${NC}"

# Generate docker-compose.yml
echo "Generating docker-compose.yml..."
sed -e "s/{{AGENT_NAME}}/$AGENT_NAME/g" \
    -e "s/{{PORT}}/$PORT/g" \
    docker/docker-compose.template.yml > "$AGENT_DIR/docker-compose.yml"
echo -e "${GREEN}✅ Created $AGENT_DIR/docker-compose.yml${NC}"

# Create .dockerignore if it doesn't exist in agent directory
if [ ! -f "$AGENT_DIR/.dockerignore" ]; then
    echo "Creating .dockerignore..."
    cat > "$AGENT_DIR/.dockerignore" << 'EOF'
# Dependencies
node_modules/
npm-debug.log
yarn-error.log

# Build output
dist/
build/
.next/

# Environment files (will be loaded via docker-compose)
.env
.env.*
!.env.example

# Database files
.eliza/

# Git
.git/
.gitignore

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Testing
coverage/
.nyc_output/

# Temporary files
tmp/
temp/
*.tmp
EOF
    echo -e "${GREEN}✅ Created $AGENT_DIR/.dockerignore${NC}"
fi

# Update agent README with Docker instructions
echo ""
echo "Updating $AGENT_DIR/README.md with Docker instructions..."
if [ -f "$AGENT_DIR/README.md" ]; then
    # Check if Docker section already exists
    if ! grep -q "## Docker Deployment" "$AGENT_DIR/README.md"; then
        cat >> "$AGENT_DIR/README.md" << EOF

## Docker Deployment

### Build and Run

\`\`\`bash
# Build the image
cd agents/$AGENT_NAME
docker-compose build

# Start the agent
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the agent
docker-compose down
\`\`\`

### Configuration

- **Port:** $PORT (mapped to container port 3000)
- **Image:** \${DOCKER_USERNAME}/$AGENT_NAME:latest
- **Container:** $AGENT_NAME-agent

### Management Commands

\`\`\`bash
# Rebuild after code changes
docker-compose build --no-cache

# Restart agent
docker-compose restart

# View status
docker-compose ps

# Execute commands inside container
docker-compose exec $AGENT_NAME-agent sh
\`\`\`

### Volumes

- \`agent_${AGENT_NAME}_data\`: Persistent database storage
- \`agent_${AGENT_NAME}_logs\`: Application logs

### Environment Variables

All environment variables are loaded from \`agents/$AGENT_NAME/.env\`.
Make sure to set:
- LLM API keys (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
- Wallet private key (POLYMARKET_PRIVATE_KEY)
- Telegram bot token (TELEGRAM_BOT_TOKEN)
EOF
        echo -e "${GREEN}✅ Updated $AGENT_DIR/README.md with Docker instructions${NC}"
    else
        echo -e "${YELLOW}⚠️  Docker section already exists in README.md${NC}"
    fi
fi

# Create a simple deploy script for this agent
echo ""
echo "Creating deploy script..."
cat > "$AGENT_DIR/deploy.sh" << EOF
#!/bin/bash
# Quick deploy script for $AGENT_NAME

set -e

echo "Deploying $AGENT_NAME..."

# Build the image
echo "Building Docker image..."
docker-compose build

# Start the container
echo "Starting container..."
docker-compose up -d

# Show logs
echo ""
echo "Agent deployed! Viewing logs (Ctrl+C to exit)..."
docker-compose logs -f
EOF

chmod +x "$AGENT_DIR/deploy.sh"
echo -e "${GREEN}✅ Created $AGENT_DIR/deploy.sh${NC}"

# Summary
echo ""
echo "==========================================="
echo "  Docker Configuration Complete!"
echo "==========================================="
echo ""
echo "Generated files:"
echo "  - $AGENT_DIR/Dockerfile"
echo "  - $AGENT_DIR/docker-compose.yml"
echo "  - $AGENT_DIR/.dockerignore"
echo "  - $AGENT_DIR/deploy.sh"
echo ""
echo "Next steps:"
echo "1. Review and customize $AGENT_DIR/docker-compose.yml if needed"
echo "2. Ensure $AGENT_DIR/.env has all required API keys and wallet"
echo "3. Deploy with: cd $AGENT_DIR && docker-compose up -d"
echo "   Or use: ./$AGENT_DIR/deploy.sh"
echo ""
echo "The agent will be accessible on port $PORT"
echo ""
