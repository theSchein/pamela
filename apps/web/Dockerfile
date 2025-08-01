# Development Dockerfile for Web
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm install

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Build shared package
WORKDIR /app/packages/shared
RUN npm run build || true

# Back to web directory
WORKDIR /app/apps/web

# Expose port
EXPOSE 5173

# Start development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]