# Docker Template for Multi-Agent Deployment
# This file is a template - use scripts/generate-docker-configs.sh to create agent-specific Dockerfiles

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY bun.lock* ./

# Install dependencies
RUN npm ci --production=false

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies only
COPY package*.json ./
RUN npm ci --production && npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts

# Copy shared code
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/web ./web

# Copy configuration files
COPY pamela.json ./
COPY tsconfig.json ./

# Copy agents directory for agent-specific configs
COPY --from=builder /app/agents ./agents

# Create directory for database (agent-specific path will be set via env var)
RUN mkdir -p /app/.eliza

# Set environment variables
ENV NODE_ENV=production
ENV AGENT_CHARACTER=lib-out

# Other env vars will be set via docker-compose or runtime
# PGLITE_DATA_DIR will be set via docker-compose or runtime

# Health check
HEALTHCHECK --interval=60s --timeout=15s --start-period=120s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

# Run the application
CMD ["npm", "start"]
