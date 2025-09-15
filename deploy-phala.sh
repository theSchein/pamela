#!/bin/bash

# Phala TEE Deployment Script for Pamela Agent
# Uses ElizaOS native TEE integration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AGENT_NAME="pamela-tee-agent"
ENV_FILE=".env"
COMPOSE_FILE="docker-compose.yml"

# Check if CVM already exists and clean it up
echo -e "${YELLOW}Checking for existing CVM...${NC}"
if elizaos tee phala cvms get "$AGENT_NAME" &>/dev/null; then
    echo -e "${YELLOW}Found existing CVM. Deleting...${NC}"
    elizaos tee phala cvms delete "$AGENT_NAME" 2>/dev/null || true
    sleep 5
fi

echo -e "${GREEN}Using docker-compose.yml and .env from current directory${NC}"

echo -e "${BLUE}=== Phala TEE Deployment for Pamela Agent ===${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check if elizaos CLI is installed
if ! command -v elizaos &> /dev/null; then
    echo -e "${RED}Error: ElizaOS CLI not found. Please install it first:${NC}"
    echo "npm install -g @elizaos/cli"
    exit 1
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

# Phala API Key check
echo -e "${YELLOW}Phala Authentication${NC}"

# Check if PHALA_API_KEY is in env file
if grep -q "^PHALA_API_KEY=." "$ENV_FILE"; then
    PHALA_API_KEY=$(grep "^PHALA_API_KEY=" "$ENV_FILE" | cut -d'=' -f2-)
    echo -e "${GREEN}Using PHALA_API_KEY from .env file${NC}"
else
    echo "Please enter your Phala Cloud API key (get it from https://cloud.phala.network):"
    read -s PHALA_API_KEY
    echo ""
fi

# Login to Phala
echo -e "${YELLOW}Logging in to Phala Cloud...${NC}"
elizaos tee phala auth login "$PHALA_API_KEY"

# Check auth status
elizaos tee phala auth status

echo ""
echo -e "${YELLOW}Checking account status...${NC}"

# Simple billing reminder without blocking
echo -e "${YELLOW}Note: Ensure billing is set up at https://cloud.phala.network/billing${NC}"

echo ""
echo -e "${YELLOW}Logging in to Docker...${NC}"
# Docker login for Phala registry
elizaos tee phala docker login

# Get Docker username from the elizaos docker login output or config
# Check if we can get it from phala Docker config first
DOCKER_USERNAME=$(cat ~/.phala-cloud/docker-credentials.json 2>/dev/null | grep '"username"' | cut -d'"' -f4)

if [ -z "$DOCKER_USERNAME" ]; then
    # Try getting from docker info
    DOCKER_USERNAME=$(docker info 2>/dev/null | grep "Username" | awk '{print $2}')
fi

if [ -z "$DOCKER_USERNAME" ]; then
    echo -e "${YELLOW}Note: Docker username will be requested by elizaos docker login${NC}"
else
    echo -e "${GREEN}Using Docker Hub username: $DOCKER_USERNAME${NC}"
fi

export DOCKER_USERNAME

echo ""
echo -e "${YELLOW}Building Docker image...${NC}"

# Build the Docker image using ElizaOS TEE builder
# We're already in the root directory
elizaos tee phala docker build \
  --file Dockerfile \
  --image "$AGENT_NAME" \
  --tag latest

# Get the full image name after build
# Read from phala config to ensure we have the correct username
DOCKER_USERNAME=$(cat ~/.phala-cloud/docker-credentials.json 2>/dev/null | grep '"username"' | cut -d'"' -f4)
if [ -z "$DOCKER_USERNAME" ]; then
    echo -e "${RED}Error: Could not determine Docker username${NC}"
    exit 1
fi

FULL_IMAGE_NAME="$DOCKER_USERNAME/$AGENT_NAME"
echo -e "${GREEN}Full image name: $FULL_IMAGE_NAME:latest${NC}"

echo ""
echo -e "${YELLOW}Pushing Docker image to registry...${NC}"

# Push the image to Docker Hub
docker push "$FULL_IMAGE_NAME:latest"

echo ""
echo -e "${YELLOW}Deploying to Phala TEE...${NC}"

# Deploy to Phala Cloud
echo -e "${YELLOW}Attempting deployment...${NC}"

# Resource selection for cost optimization
echo ""
echo -e "${YELLOW}Select resource allocation:${NC}"
echo "1) Minimal (1 vCPU, 1GB RAM, 10GB disk) - ~$10/month - Testing only"
echo "2) Small (1 vCPU, 2GB RAM, 20GB disk) - ~$15/month"
echo "3) Medium (2 vCPUs, 4GB RAM, 30GB disk) - ~$30/month"
echo "4) Large (4 vCPUs, 8GB RAM, 50GB disk) - ~$58/month - Production"
read -p "Enter choice (1-4): " RESOURCE_SIZE

case $RESOURCE_SIZE in
    1)
        VCPU_COUNT=1
        MEMORY_SIZE="1G"
        DISK_SIZE="10G"
        echo -e "${GREEN}Using minimal resources for testing${NC}"
        ;;
    2)
        VCPU_COUNT=1
        MEMORY_SIZE="2G"
        DISK_SIZE="20G"
        echo -e "${GREEN}Using small resources${NC}"
        ;;
    3)
        VCPU_COUNT=2
        MEMORY_SIZE="4G"
        DISK_SIZE="30G"
        echo -e "${GREEN}Using medium resources${NC}"
        ;;
    *)
        VCPU_COUNT=4
        MEMORY_SIZE="8G"
        DISK_SIZE="50G"
        echo -e "${GREEN}Using large resources for production${NC}"
        ;;
esac

echo ""
echo -e "${BLUE}Deploying with: ${VCPU_COUNT} vCPU, ${MEMORY_SIZE} RAM, ${DISK_SIZE} disk${NC}"

# Deploy without interactive mode - all config embedded in compose file
echo -e "${YELLOW}Starting deployment...${NC}"

# Get node and image info first
echo "Using default node: prod8 (US-WEST-1)"
echo "Using image: dstack-dev-0.3.6"

# Deploy with all parameters specified
# The .env file is in the same directory as docker-compose.yml
echo "Note: When prompted for env file, enter: .env"
elizaos tee phala deploy \
  --interactive \
  --name "$AGENT_NAME" \
  --vcpu "$VCPU_COUNT" \
  --memory "$MEMORY_SIZE" \
  --disk-size "$DISK_SIZE" \
  --compose "$COMPOSE_FILE" || {
    echo ""
    echo -e "${RED}Deployment failed. Common issues:${NC}"
    echo "1. No billing/payment method set up"
    echo "2. Insufficient account balance"
    echo "3. Resource limits exceeded"
    echo "4. Invalid configuration"
    echo ""
    echo "Please check:"
    echo "- Your billing at: https://cloud.phala.network/billing"
    echo "- Your account balance and limits"
    echo "- Try with smaller resource allocation"
    exit 1
}

echo ""
echo -e "${GREEN}Deployment initiated!${NC}"
echo ""

# Get deployment info
echo -e "${YELLOW}Getting deployment info...${NC}"
elizaos tee phala cvms get "$AGENT_NAME" 2>/dev/null || echo -e "${GREEN}Check dashboard for status${NC}"

echo ""
echo -e "${BLUE}=== Deployment Information ===${NC}"
echo "Agent Name: $AGENT_NAME"
echo "TEE Provider: Phala Cloud"
echo "Resources: 4 vCPUs, 8GB RAM, 50GB Disk"
echo "Estimated Cost: ~\$58/month"
echo ""

echo -e "${BLUE}=== Next Steps ===${NC}"
echo "1. Check dashboard: https://cloud.phala.network/dashboard/cvms"
echo "2. View logs: elizaos tee phala cvms logs $AGENT_NAME"
echo "3. List CVMs: elizaos tee phala cvms list"
echo "4. Monitor trading: ./monitor-phala-tee.sh"
echo ""
echo -e "${YELLOW}Note: The container may need environment variables configured in the dashboard${NC}"
echo ""

echo -e "${GREEN}Deployment script completed!${NC}"
echo -e "${YELLOW}Note: It may take 5-10 minutes for the agent to fully initialize.${NC}"