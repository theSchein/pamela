#!/bin/bash
# Quick deploy script for trumped-up

set -e

echo "Deploying trumped-up..."

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
