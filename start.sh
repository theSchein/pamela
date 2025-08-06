#!/bin/sh

# Ensure Bun is in PATH
export PATH="/usr/local/bin:$PATH"

# Verify Bun is available
if ! command -v bun &> /dev/null; then
    echo "Bun not found in PATH, attempting to locate..."
    export PATH="/usr/local/bin:/root/.bun/bin:$PATH"
fi

# Start the application
exec node src/start-production.mjs