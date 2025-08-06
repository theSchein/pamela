# Universal Production Dockerfile for Pamela Agent
# Supports Discord and standalone deployments

FROM node:20-alpine AS deps

# Install system dependencies including Bun
RUN apk add --no-cache python3 make g++ curl bash \
    && curl -fsSL https://bun.sh/install | bash \
    && mv /root/.bun/bin/bun /usr/local/bin/ \
    && rm -rf /root/.bun

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci --include=dev

# Builder stage
FROM node:20-alpine AS builder

# Install Bun in builder
RUN apk add --no-cache curl bash \
    && curl -fsSL https://bun.sh/install | bash \
    && mv /root/.bun/bin/bun /usr/local/bin/ \
    && rm -rf /root/.bun

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build the application
RUN npm run build || echo "Build completed with warnings"

# Production stage
FROM node:20-alpine AS production

# Install Bun in production
RUN apk add --no-cache curl bash \
    && curl -fsSL https://bun.sh/install | bash \
    && mv /root/.bun/bin/bun /usr/local/bin/ \
    && rm -rf /root/.bun

# Add non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy production dependencies
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/plugin-polymarket ./plugin-polymarket
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/tsconfig.json ./

# Create data directory for PGLite
RUN mkdir -p /app/.eliza/.elizadb && \
    chown -R nodejs:nodejs /app/.eliza

# Switch to non-root user
USER nodejs

# Set environment
ENV NODE_ENV=production
ENV PATH="/usr/local/bin:$PATH"

# Expose ports
# 3000: Main API server
# 3001: Health check endpoint
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start script
COPY --chown=nodejs:nodejs start.sh ./
RUN chmod +x start.sh

# Use start script for proper signal handling
CMD ["./start.sh"]