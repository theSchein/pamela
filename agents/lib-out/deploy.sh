#!/bin/bash
# Quick deploy script for lib-out

set -e

echo "Deploying lib-out..."

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
