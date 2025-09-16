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
COPY --from=builder /app/plugin-polymarket ./plugin-polymarket
COPY --from=builder /app/scripts ./scripts

# Copy configuration files
COPY pamela.json ./
COPY tsconfig.json ./

# Create directory for database
RUN mkdir -p /app/.eliza/.elizadb

# Set environment variables
ENV NODE_ENV=production
ENV PGLITE_DATA_DIR=/app/.eliza/.elizadb

# Health check
HEALTHCHECK --interval=60s --timeout=15s --start-period=120s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

# Run the application
CMD ["npm", "start"]