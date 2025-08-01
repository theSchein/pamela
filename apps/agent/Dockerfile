# Development Dockerfile for Agent
FROM node:20-alpine

WORKDIR /app

# Install dependencies for building native modules
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package*.json ./
COPY apps/agent/package*.json ./apps/agent/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm install

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/agent ./apps/agent

# Build shared package
WORKDIR /app/packages/shared
RUN npm run build || true

# Back to agent directory
WORKDIR /app/apps/agent

# Expose ports
EXPOSE 3000 3001

# Start development server
CMD ["npm", "run", "dev"]