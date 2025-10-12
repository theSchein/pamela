#!/bin/bash

###############################################################################
# Create Deployment Tag Script
#
# Creates an annotated git tag for SPMC deployment
#
# Usage:
#   ./scripts/create-deployment-tag.sh <agent-name> <version>
#
# Examples:
#   ./scripts/create-deployment-tag.sh pamela v0.1.0
#   ./scripts/create-deployment-tag.sh lib-out v0.2.0
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check arguments
if [ $# -lt 2 ]; then
    echo -e "${RED}Error: Missing required arguments${NC}"
    echo ""
    echo "Usage: $0 <agent-name> <version>"
    echo ""
    echo "Examples:"
    echo "  $0 pamela v0.1.0"
    echo "  $0 lib-out v0.2.0"
    echo "  $0 chalk-eater v1.0.0"
    echo ""
    exit 1
fi

AGENT_NAME=$1
VERSION=$2

# Remove 'v' prefix if present for tag name consistency
VERSION_CLEAN=$(echo "$VERSION" | sed 's/^v//')

# Tag format: agent-name-vX.Y.Z
TAG="${AGENT_NAME}-v${VERSION_CLEAN}"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Creating Deployment Tag${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Check if git repo
if [ ! -d ".git" ]; then
    echo -e "${RED}✗ Error: Not a git repository${NC}"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠ Warning: You have uncommitted changes${NC}"
    echo ""
    git status --short
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Aborted${NC}"
        exit 1
    fi
fi

# Check if tag already exists
if git rev-parse "$TAG" >/dev/null 2>&1; then
    echo -e "${RED}✗ Error: Tag '$TAG' already exists${NC}"
    echo ""
    echo "Existing tag info:"
    git show "$TAG" --no-patch
    echo ""
    echo "To delete the existing tag:"
    echo "  git tag -d $TAG"
    echo "  git push origin :refs/tags/$TAG"
    exit 1
fi

# Get current commit SHA
COMMIT_SHA=$(git rev-parse HEAD)
COMMIT_SHORT=$(git rev-parse --short HEAD)

echo -e "${GREEN}Tag Details:${NC}"
echo "  Agent:  $AGENT_NAME"
echo "  Tag:    $TAG"
echo "  Commit: $COMMIT_SHORT"
echo ""

# Prompt for tag message
echo -e "${BLUE}Enter deployment tag message (or press Enter for default):${NC}"
DEFAULT_MESSAGE="Deploy $AGENT_NAME $VERSION"
read -p "> " TAG_MESSAGE
TAG_MESSAGE=${TAG_MESSAGE:-$DEFAULT_MESSAGE}

echo ""
echo -e "${BLUE}Creating annotated git tag...${NC}"

# Create annotated tag
if git tag -a "$TAG" -m "$TAG_MESSAGE"; then
    echo -e "${GREEN}✓ Tag created successfully${NC}"
else
    echo -e "${RED}✗ Failed to create tag${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Push tag to remote?${NC}"
read -p "(Y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo -e "${YELLOW}⚠ Tag created locally but not pushed${NC}"
    echo ""
    echo "To push later, run:"
    echo "  git push origin $TAG"
else
    echo -e "${BLUE}Pushing tag to origin...${NC}"
    if git push origin "$TAG"; then
        echo -e "${GREEN}✓ Tag pushed successfully${NC}"
    else
        echo -e "${RED}✗ Failed to push tag${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Deployment Tag Created${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Tag:    $TAG"
echo "Commit: $COMMIT_SHA"
echo ""
echo -e "${GREEN}SPMC can now deploy from this tag${NC}"
echo ""
echo "Deployment command (for SPMC):"
echo "  git clone --branch $TAG --depth 1 <repo-url>"
echo ""
echo "Docker build command:"
echo "  docker build \\"
echo "    --build-arg AGENT_CHARACTER=$AGENT_NAME \\"
echo "    --build-arg GIT_TAG=$TAG \\"
echo "    --build-arg GIT_COMMIT_SHA=$COMMIT_SHORT \\"
echo "    -t trading-agent:$AGENT_NAME \\"
echo "    ."
echo ""
