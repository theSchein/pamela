#!/bin/bash

# Phala TEE Deployment Script for Pamela Agent
# Supports both local development and cloud deployment
# Uses ElizaOS native TEE integration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - Can be overridden by environment variables
DOCKER_USERNAME="${DOCKER_USERNAME:-}"
DOCKER_IMAGE_NAME="${DOCKER_IMAGE_NAME:-pamela-agent}"
DOCKER_IMAGE_TAG="${DOCKER_IMAGE_TAG:-latest}"
AGENT_NAME="${TEE_AGENT_NAME:-pamela-tee-agent}"
ENV_FILE=".env"
COMPOSE_FILE="docker-compose.yml"
LOCAL_IMAGE_NAME="pamela-local"
MODE="${1:-cloud}"  # Default to cloud mode if not specified

# Validate Docker username is set
if [ -z "$DOCKER_USERNAME" ]; then
    echo -e "${RED}Error: DOCKER_USERNAME environment variable is not set${NC}"
    echo "Please export DOCKER_USERNAME=your-dockerhub-username"
    exit 1
fi

# Construct full image name
FULL_IMAGE_NAME="${DOCKER_USERNAME}/${DOCKER_IMAGE_NAME}"

# Function to display usage
show_usage() {
    echo "Usage: $0 [MODE]"
    echo ""
    echo "Modes:"
    echo "  local    - Deploy locally with TEE simulator for testing"
    echo "  cloud    - Deploy to Phala Cloud (default)"
    echo "  help     - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0               # Deploy to cloud (default)"
    echo "  $0 local         # Deploy locally for testing"
    echo "  $0 cloud         # Deploy to cloud explicitly"
    echo ""
    exit 0
}

# Check for help flag
if [[ "$MODE" == "help" ]] || [[ "$MODE" == "--help" ]] || [[ "$MODE" == "-h" ]]; then
    show_usage
fi

# Validate mode
if [[ "$MODE" != "local" ]] && [[ "$MODE" != "cloud" ]]; then
    echo -e "${RED}Error: Invalid mode '$MODE'. Use 'local' or 'cloud'.${NC}"
    show_usage
fi

echo -e "${BLUE}=== Phala TEE Deployment - ${MODE^^} MODE ===${NC}"
echo ""

# Local deployment function
deploy_local() {
    echo -e "${YELLOW}Starting local deployment with TEE simulator...${NC}"
    
    # Docker username already validated at script start
    
    # The Phala CLI already prepends the username, so just use the base image name
    echo -e "${GREEN}Building image as: $DOCKER_USERNAME/$LOCAL_IMAGE_NAME:latest${NC}"
    
    # Start TEE Simulator
    echo -e "${YELLOW}Starting TEE simulator...${NC}"
    npx phala simulator start &
    SIMULATOR_PID=$!
    sleep 3
    echo -e "${GREEN}TEE simulator started (PID: $SIMULATOR_PID)${NC}"
    
    # Build Docker image locally - Phala CLI will add the username automatically
    echo -e "${YELLOW}Building Docker image for local testing...${NC}"
    npx phala docker build --image "$LOCAL_IMAGE_NAME" --tag "latest"
    
    # The built image will be named with the Docker username prepended
    FULL_LOCAL_IMAGE_NAME="$DOCKER_USERNAME/$LOCAL_IMAGE_NAME"
    
    # Create local env file
    LOCAL_ENV_FILE=".env.local"
    cp "$ENV_FILE" "$LOCAL_ENV_FILE"
    
    # Ensure TEE_MODE is set
    if ! grep -q "^TEE_MODE=" "$LOCAL_ENV_FILE"; then
        echo "TEE_MODE=true" >> "$LOCAL_ENV_FILE"
    fi
    
    # Add simulator flag
    if ! grep -q "^PHALA_SIMULATOR=" "$LOCAL_ENV_FILE"; then
        echo "PHALA_SIMULATOR=true" >> "$LOCAL_ENV_FILE"
    fi
    
    # Add local Ollama endpoint if needed
    if ! grep -q "^OLLAMA_API_ENDPOINT=" "$LOCAL_ENV_FILE"; then
        echo "OLLAMA_API_ENDPOINT=http://host.docker.internal:11434" >> "$LOCAL_ENV_FILE"
    fi
    
    echo -e "${GREEN}Local environment prepared${NC}"
    
    # Clean up any existing containers and free up port
    echo -e "${YELLOW}Cleaning up any existing containers and freeing port 3000...${NC}"
    
    # Stop any container using port 3000
    CONTAINER_ON_PORT=$(docker ps --format "table {{.Names}}" | grep -v NAMES | xargs -I {} sh -c 'docker port {} 2>/dev/null | grep -q "3000" && echo {}' | head -1)
    if [ ! -z "$CONTAINER_ON_PORT" ]; then
        echo -e "${YELLOW}Stopping container using port 3000: $CONTAINER_ON_PORT${NC}"
        docker stop "$CONTAINER_ON_PORT" 2>/dev/null || true
    fi
    
    # Also check for any process using port 3000 (like npm start)
    PORT_PID=$(lsof -ti:3000 2>/dev/null)
    if [ ! -z "$PORT_PID" ]; then
        echo -e "${YELLOW}Found process $PORT_PID using port 3000.${NC}"
        echo -e "${YELLOW}This might be the production agent running. Using port 3001 instead.${NC}"
        LOCAL_PORT=3001
    else
        LOCAL_PORT=3000
    fi
    
    # Clean up specific containers
    docker stop pamela-local-tee 2>/dev/null || true
    docker rm pamela-local-tee 2>/dev/null || true
    docker stop pamela-agent 2>/dev/null || true
    docker rm pamela-agent 2>/dev/null || true
    
    # Also clean up using docker-compose if a previous compose file exists
    if [ -f "docker-compose.local.yml" ]; then
        docker-compose -f docker-compose.local.yml down 2>/dev/null || true
    fi
    
    echo -e "${GREEN}Cleanup complete${NC}"
    
    # Create a local compose file for testing
    echo -e "${YELLOW}Creating local Docker Compose configuration...${NC}"
    cat > docker-compose.local.yml << EOF
version: '3.8'

services:
  pamela:
    image: ${FULL_LOCAL_IMAGE_NAME}:latest
    container_name: pamela-local-tee
    env_file:
      - ${LOCAL_ENV_FILE}
    environment:
      - TEE_MODE=true
      - PHALA_SIMULATOR=true
      - NODE_ENV=development
    volumes:
      - ./data:/app/data
      - ./.eliza:/app/.eliza
    ports:
      - "${LOCAL_PORT}:3000"
    restart: unless-stopped
    extra_hosts:
      - "host.docker.internal:host-gateway"
EOF
    
    echo -e "${GREEN}Docker Compose file created${NC}"
    
    # Run with docker-compose directly for local testing
    echo -e "${YELLOW}Starting container with Docker Compose...${NC}"
    docker-compose -f docker-compose.local.yml up -d --force-recreate
    
    # Wait for container to start
    echo -e "${YELLOW}Waiting for container to initialize...${NC}"
    sleep 5
    
    # Check if container is running
    if docker ps | grep -q "pamela-local-tee"; then
        echo -e "${GREEN}Container started successfully!${NC}"
        
        # Show initial logs
        echo ""
        echo -e "${YELLOW}Initial container logs:${NC}"
        docker logs pamela-local-tee 2>&1 | tail -20
    else
        echo -e "${RED}Container failed to start${NC}"
        echo "Checking docker-compose logs:"
        docker-compose -f docker-compose.local.yml logs
    fi
    
    echo ""
    echo -e "${GREEN}Local deployment completed!${NC}"
    echo ""
    echo -e "${BLUE}=== Local Testing Information ===${NC}"
    echo "Container: pamela-local-tee"
    echo "Simulator PID: $SIMULATOR_PID"
    echo "API Endpoint: http://localhost:${LOCAL_PORT}"
    echo ""
    echo -e "${BLUE}=== Useful Commands ===${NC}"
    echo "View logs:        docker logs -f pamela-local-tee"
    echo "Check status:     docker ps | grep pamela-local"
    echo "Stop container:   docker-compose -f docker-compose.local.yml down"
    echo "Stop simulator:   kill $SIMULATOR_PID"
    echo "Test API:         curl http://localhost:${LOCAL_PORT}/health"
    echo ""
    echo -e "${YELLOW}The TEE simulator provides a local testing environment${NC}"
    echo -e "${YELLOW}Monitor logs to ensure the agent starts correctly${NC}"
    echo ""
    exit 0
}

# Cloud deployment - original logic
deploy_cloud() {
    # Clean up any existing CVMs
    echo -e "${YELLOW}Checking for existing CVMs...${NC}"
    
    # Try to delete by name first
    if npx phala cvms get "$AGENT_NAME" &>/dev/null; then
        echo -e "${YELLOW}Found existing CVM by name. Deleting...${NC}"
        npx phala cvms delete "$AGENT_NAME" -y 2>/dev/null || true
        sleep 5
    fi
    
    # Also check and delete by listing all CVMs
    EXISTING_CVMS=$(npx phala cvms list 2>/dev/null | grep "$AGENT_NAME" | grep "App ID" | awk '{print $4}' || true)
    if [ ! -z "$EXISTING_CVMS" ]; then
        for CVM_ID in $EXISTING_CVMS; do
            echo -e "${YELLOW}Found CVM with ID $CVM_ID. Deleting...${NC}"
            npx phala cvms delete "$CVM_ID" -y 2>/dev/null || true
        done
        sleep 5
    fi
    
    echo -e "${GREEN}Cleanup complete${NC}"
    echo -e "${GREEN}Using docker-compose.yml and .env from current directory${NC}"
}

# Route to appropriate deployment mode early
if [[ "$MODE" == "local" ]]; then
    # Check prerequisites for local mode
    echo -e "${YELLOW}Checking prerequisites for local deployment...${NC}"
    
    if ! command -v npx &> /dev/null; then
        echo -e "${RED}Error: npx not found. Please install Node.js and npm first.${NC}"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker not found. Please install Docker first.${NC}"
        exit 1
    fi
    
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${RED}Error: $ENV_FILE not found.${NC}"
        exit 1
    fi
    
    if ! grep -q "^POLYMARKET_PRIVATE_KEY=" "$ENV_FILE" || grep -q "^POLYMARKET_PRIVATE_KEY=$" "$ENV_FILE"; then
        echo -e "${RED}Error: Please configure your POLYMARKET_PRIVATE_KEY in $ENV_FILE${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Prerequisites check passed!${NC}"
    deploy_local
    exit 0
fi

# Continue with cloud deployment prerequisites
echo -e "${YELLOW}Checking prerequisites for cloud deployment...${NC}"

# Check if phala CLI is available
if ! command -v npx &> /dev/null; then
    echo -e "${RED}Error: npx not found. Please install Node.js and npm first.${NC}"
    exit 1
fi

# Check if phala CLI works
if ! npx phala --version &> /dev/null; then
    echo -e "${YELLOW}Phala CLI will be installed when first used via npx${NC}"
fi

# Check if env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: $ENV_FILE not found. Please ensure .env file exists in the parent directory.${NC}"
    exit 1
fi

# Check if required variables are set in env file
if ! grep -q "^POLYMARKET_PRIVATE_KEY=" "$ENV_FILE" || grep -q "^POLYMARKET_PRIVATE_KEY=$" "$ENV_FILE"; then
    echo -e "${RED}Error: Please configure your POLYMARKET_PRIVATE_KEY in $ENV_FILE${NC}"
    exit 1
fi

# Check for at least one news source
if ! grep -q "^NEWS_API_KEY=." "$ENV_FILE" && ! grep -q "^TAVILY_API_KEY=." "$ENV_FILE"; then
    echo -e "${RED}Error: Please configure at least one news source API key (NEWS_API_KEY or TAVILY_API_KEY) in $ENV_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}Prerequisites check passed!${NC}"
echo ""

# Phala Authentication
echo -e "${YELLOW}Checking Phala Authentication...${NC}"

# First check if already authenticated using direct phala CLI
if npx phala auth status &>/dev/null; then
    echo -e "${GREEN}Already authenticated with Phala Cloud${NC}"
    npx phala auth status | grep "Logged in as" || true
else
    echo -e "${YELLOW}Not authenticated. Need to login to Phala Cloud.${NC}"
    
    # Check if PHALA_API_KEY is in env file
    if grep -q "^PHALA_API_KEY=." "$ENV_FILE"; then
        PHALA_API_KEY=$(grep "^PHALA_API_KEY=" "$ENV_FILE" | cut -d'=' -f2-)
        echo -e "${GREEN}Using PHALA_API_KEY from .env file${NC}"
    else
        echo ""
        echo -e "${BLUE}Please enter your Phala Cloud API key${NC}"
        echo -e "${YELLOW}Get it from: https://cloud.phala.network/account/api-keys${NC}"
        echo -n "API Key: "
        read -s PHALA_API_KEY
        echo ""
        
        # Optionally save to .env file
        echo ""
        read -p "Save API key to .env file for future use? (y/n): " SAVE_KEY
        if [[ "$SAVE_KEY" =~ ^[Yy]$ ]]; then
            echo "PHALA_API_KEY=$PHALA_API_KEY" >> "$ENV_FILE"
            echo -e "${GREEN}API key saved to .env file${NC}"
        fi
    fi
    
    # Login to Phala using direct CLI
    echo -e "${YELLOW}Logging in to Phala Cloud...${NC}"
    echo "$PHALA_API_KEY" | npx phala auth login
    
    if ! npx phala auth status &>/dev/null; then
        echo -e "${RED}Failed to authenticate with Phala Cloud${NC}"
        echo "Please check your API key and try again"
        exit 1
    fi
fi

echo -e "${GREEN}Successfully authenticated with Phala Cloud!${NC}"

echo ""
echo -e "${YELLOW}Checking account status...${NC}"

# Simple billing reminder without blocking
echo -e "${YELLOW}Note: Ensure billing is set up at https://cloud.phala.network/billing${NC}"

echo ""
echo -e "${YELLOW}Checking Docker login...${NC}"
# Make sure we're logged into Docker Hub
if ! docker info 2>/dev/null | grep -q "Username"; then
    echo -e "${YELLOW}Please login to Docker Hub:${NC}"
    docker login
fi

# Docker username already validated at script start

echo -e "${GREEN}Using Docker Hub username: $DOCKER_USERNAME${NC}"

echo ""
echo -e "${YELLOW}Building Docker image...${NC}"

# Build and tag the Docker image for Docker Hub
# FULL_IMAGE_NAME already set at the top of script
echo -e "${GREEN}Building image: $FULL_IMAGE_NAME:latest${NC}"
docker build -t "$FULL_IMAGE_NAME:latest" -f Dockerfile .

echo ""
echo -e "${YELLOW}Pushing Docker image to registry...${NC}"

# Push the image to Docker Hub
docker push "$FULL_IMAGE_NAME:latest"

echo -e "${GREEN}Docker image pushed successfully to Docker Hub${NC}"

echo ""
echo -e "${YELLOW}Deploying to Phala TEE...${NC}"

# Deploy to Phala Cloud
echo -e "${YELLOW}Attempting deployment...${NC}"

# Note: Resource allocation is handled automatically by Phala Cloud
echo ""
echo -e "${YELLOW}Phala Cloud will automatically allocate resources based on your account tier${NC}"

# For Phala deployment, we need to prepare a clean env file
echo -e "${YELLOW}Preparing environment configuration for TEE...${NC}"

# Create a cleaned version of the .env file for TEE deployment
# Some env vars might have special characters that break TEE parsing
DEPLOYMENT_ENV_FILE=".env.tee"

echo -e "${YELLOW}Creating TEE-compatible environment file...${NC}"
# Filter and clean the environment variables
# Remove comments, empty lines, and ensure proper formatting
# Include variables with empty values (e.g., ANTHROPIC_API_KEY=)
grep -E "^[A-Z_]+=" "$ENV_FILE" | sed 's/[[:space:]]*$//' > "$DEPLOYMENT_ENV_FILE"

# Verify critical environment variables are present
echo -e "${YELLOW}Verifying critical environment variables...${NC}"
MISSING_VARS=""

# Check for critical variables
for VAR in POLYMARKET_PRIVATE_KEY CLOB_API_URL TELEGRAM_BOT_TOKEN; do
    if ! grep -q "^$VAR=" "$DEPLOYMENT_ENV_FILE"; then
        MISSING_VARS="$MISSING_VARS $VAR"
    fi
done

if [ ! -z "$MISSING_VARS" ]; then
    echo -e "${RED}Warning: Missing critical variables:$MISSING_VARS${NC}"
    echo -e "${YELLOW}Deployment may not work correctly without these variables${NC}"
fi

# Count variables (including those with empty values)
VAR_COUNT=$(grep -c "^[A-Z_]+=" "$DEPLOYMENT_ENV_FILE" || echo "0")
echo -e "${GREEN}Prepared $VAR_COUNT environment variables for TEE${NC}"
echo -e "${GREEN}Using environment file: $DEPLOYMENT_ENV_FILE${NC}"
echo -e "${BLUE}Note: Environment variables will be encrypted by Phala Cloud${NC}"

# Verify docker-compose.yml exists
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}Error: docker-compose.yml not found!${NC}"
    exit 1
fi
echo -e "${GREEN}Docker compose file found: $COMPOSE_FILE${NC}"

# Check Docker image exists locally
if docker images | grep -q "$FULL_IMAGE_NAME"; then
    echo -e "${GREEN}Docker image exists locally: $FULL_IMAGE_NAME:latest${NC}"
else
    echo -e "${YELLOW}Warning: Docker image not found locally. Make sure it's pushed to Docker Hub.${NC}"
fi

# Verify we're authenticated
echo -e "${YELLOW}Verifying Phala authentication...${NC}"
if npx phala auth status; then
    echo -e "${GREEN}Authentication verified${NC}"
else
    echo -e "${RED}Not authenticated with Phala!${NC}"
    exit 1
fi

# Deploy with all parameters specified
echo -e "${YELLOW}Starting deployment...${NC}"
echo "Using configuration:"
echo "  - Name: $AGENT_NAME"
echo "  - Docker Image: $FULL_IMAGE_NAME:latest"
echo "  - Docker Compose: $COMPOSE_FILE"
echo "  - Environment File: $DEPLOYMENT_ENV_FILE"

echo ""
echo -e "${YELLOW}Ensuring .env file is in place for docker-compose...${NC}"
# Make sure .env exists for docker-compose to read
if [ ! -f ".env" ]; then
    echo -e "${RED}Error: .env file not found in current directory${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Creating TEE-specific docker-compose with environment variables...${NC}"

# Create a docker-compose file with environment variables inline
# This is more reliable than --env-file for Phala TEE
COMPOSE_TEE_FILE="docker-compose.tee-deploy.yml"

cat > "$COMPOSE_TEE_FILE" << EOF
version: '3.8'

services:
  pamela:
    image: ${FULL_IMAGE_NAME}:${DOCKER_IMAGE_TAG}
    container_name: pamela-agent
    ports:
      - "3000:3000"
    volumes:
      - agent_data:/app/.eliza
    restart: unless-stopped
    environment:
EOF

# Add each environment variable from .env.tee to the docker-compose
echo -e "${YELLOW}Injecting environment variables into docker-compose...${NC}"
while IFS='=' read -r key value; do
    # Skip empty lines and comments
    if [[ -n "$key" && ! "$key" =~ ^# ]]; then
        # Escape special characters in value
        escaped_value=$(echo "$value" | sed 's/"/\\"/g')
        echo "      - $key=$escaped_value" >> "$COMPOSE_TEE_FILE"
    fi
done < "$DEPLOYMENT_ENV_FILE"

# Complete the docker-compose file
cat >> "$COMPOSE_TEE_FILE" << 'EOF'
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/health"]
      interval: 60s
      timeout: 15s
      retries: 3
      start_period: 120s
    command: ["npm", "start"]

volumes:
  agent_data:
EOF

echo -e "${GREEN}Created $COMPOSE_TEE_FILE with embedded environment variables${NC}"
echo -e "${YELLOW}Variable count: $(grep -c "      - " "$COMPOSE_TEE_FILE")${NC}"

echo ""
echo -e "${YELLOW}Running deployment command...${NC}"
echo "Command: npx phala cvms create --name \"$AGENT_NAME\" --compose \"$COMPOSE_TEE_FILE\""
echo ""
echo -e "${BLUE}Note: Environment variables are now embedded in docker-compose for reliable injection${NC}"

# Deploy using the TEE-specific compose file
npx phala cvms create \
  --name "$AGENT_NAME" \
  --compose "$COMPOSE_TEE_FILE" || {
    echo ""
    echo -e "${RED}Deployment failed!${NC}"
    
    # Check if it's a compose file issue
    echo ""
    echo -e "${YELLOW}Debugging information:${NC}"
    echo "- Current directory: $(pwd)"
    echo "- Compose file exists: $([ -f "$COMPOSE_FILE" ] && echo "Yes" || echo "No")"
    echo "- Env file exists: $([ -f "$TEMP_ENV_FILE" ] && echo "Yes" || echo "No")"
    
    # Try to get more info about the failure
    echo ""
    echo -e "${YELLOW}Checking Phala CVMs status...${NC}"
    npx phala cvms list || echo "Failed to list CVMs"
    
    echo ""
    echo -e "${RED}Common issues:${NC}"
    echo "1. No billing/payment method set up"
    echo "2. Insufficient account balance"
    echo "3. Environment variables not properly loaded - check $DEPLOYMENT_ENV_FILE"
    echo ""
    echo -e "${YELLOW}To debug environment variables:${NC}"
    echo "cat $DEPLOYMENT_ENV_FILE | head -5"
    
    echo "4. docker-compose.yml has both env_file and environment sections (use only volumes/ports/command)"
    echo "5. Docker image not pushed to Docker Hub"
    echo "6. Environment variables not properly formatted in .env"
    
    # Clean up temp env file on failure
    if [ -f "$DEPLOYMENT_ENV_FILE" ] && [ "$DEPLOYMENT_ENV_FILE" != ".env" ]; then
        echo -e "${YELLOW}Keeping $DEPLOYMENT_ENV_FILE for debugging${NC}"
    fi
    echo ""
    echo "Please check:"
    echo "- Your billing at: https://cloud.phala.network/billing"
    echo "- Your account balance and limits"
    echo "- Docker image is pushed: docker push $FULL_IMAGE_NAME:latest"
    echo "- Try with smaller resource allocation"
    exit 1
}

echo ""
echo -e "${GREEN}Deployment initiated!${NC}"
echo ""

# Get deployment info
echo -e "${YELLOW}Getting deployment info...${NC}"
npx phala cvms get "$AGENT_NAME" 2>/dev/null || echo -e "${GREEN}Check dashboard for status${NC}"

echo ""
echo -e "${BLUE}=== Deployment Information ===${NC}"
echo "Agent Name: $AGENT_NAME"
echo "TEE Provider: Phala Cloud"
echo "Resources: 4 vCPUs, 8GB RAM, 50GB Disk"
echo "Estimated Cost: ~\$58/month"
echo ""

echo -e "${BLUE}=== Next Steps ===${NC}"
echo "1. Check dashboard: https://cloud.phala.network/dashboard/cvms"
echo "2. View logs: npx phala cvms logs $AGENT_NAME"
echo "3. List CVMs: npx phala cvms list"
echo "4. Monitor trading: ./monitor-phala.sh"
echo ""
echo -e "${YELLOW}Note: The container may need environment variables configured in the dashboard${NC}"
echo ""

# Clean up temporary files after successful deployment
if [ -f "$DEPLOYMENT_ENV_FILE" ] && [ "$DEPLOYMENT_ENV_FILE" != ".env" ]; then
    echo -e "${YELLOW}Cleaning up temporary files...${NC}"
    # Keep a backup for debugging
    cp "$DEPLOYMENT_ENV_FILE" "$DEPLOYMENT_ENV_FILE.backup"
    rm -f "$DEPLOYMENT_ENV_FILE"
    echo -e "${GREEN}Backup saved to $DEPLOYMENT_ENV_FILE.backup for reference${NC}"
fi

# Also keep the TEE compose file for reference
if [ -f "$COMPOSE_TEE_FILE" ]; then
    cp "$COMPOSE_TEE_FILE" "$COMPOSE_TEE_FILE.backup"
    echo -e "${GREEN}Docker compose saved to $COMPOSE_TEE_FILE.backup for debugging${NC}"
fi

echo -e "${GREEN}Deployment script completed!${NC}"
echo -e "${YELLOW}Note: It may take 5-10 minutes for the agent to fully initialize.${NC}"
echo ""
echo -e "${BLUE}To test Telegram bot after deployment:${NC}"
echo "1. Wait for agent to fully initialize (check logs)"
echo "2. Send a message to @pamela_pm_bot on Telegram"
echo "3. If bot doesn't respond, check: npx phala cvms get $AGENT_NAME"