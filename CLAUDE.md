# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Pamela** is an autonomous prediction market trading agent built on ElizaOS that can execute trades on Polymarket using its own Polygon wallet. The project integrates with Polymarket's CLOB (Central Limit Order Book) API for real-time market data and trading operations.

## Development Commands

### Core Development
- `bun run dev` - Start development server with hot reload
- `bun run build` - Build both TypeScript and Vite frontend (`tsc --noEmit && vite build && tsup`)
- `bun run start` - Start production agent with ElizaOS (`elizaos start`)

### Code Quality
- `bun run lint` - Format source code with Prettier (`prettier --write ./src`)
- `bun run format` - Same as lint
- `bun run format:check` - Check formatting without changes
- `bun run type-check` - TypeScript type checking without emit
- `bun run type-check:watch` - Watch mode type checking
- `bun run check-all` - Run type-check, format:check, and tests

### Testing
- `bun run test` - Run full test suite (component + e2e)
- `bun run test:component` - Run component tests only
- `bun run test:e2e` - Run end-to-end tests only
- `bun run test:coverage` - Run tests with coverage report
- `bun run test:watch` - Run tests in watch mode

### Cypress Testing
- `bun run cy:open` - Open Cypress test runner
- `bun run cypress:component` - Run component tests headless
- `bun run cypress:e2e` - Run e2e tests headless

**Important**: Tests require `bun run test:install` to set up dependencies first.

## Architecture

### Plugin-Based Architecture
The project follows ElizaOS's plugin architecture with three main plugins:

1. **Bootstrap Plugin** (`@elizaos/plugin-bootstrap`) - Required for message handling
2. **Starter Plugin** (`src/plugin.ts`) - Basic conversational capabilities  
3. **Polymarket Plugin** (`plugin-polymarket/`) - Core Polymarket integration

### Key Components

**Character Configuration** (`src/character.ts`):
- Defines Pamela's personality, capabilities, and conversation style
- Conditionally loads plugins based on available API keys
- Configured for prediction market trading focus

**Plugin Structure** (`plugin-polymarket/`):
- **Actions**: Market data retrieval, price checking, order placement
- **Services**: Market sync, detail processing, background monitoring
- **Providers**: Real-time data feeds via WebSocket
- **Utils**: Database initialization, CLOB client, LLM helpers

### Database Integration
- Uses PGLite for local storage via `@elizaos/plugin-sql`
- Market data synchronization service keeps local cache updated
- Database schema defined in plugin for market and trading data

## Environment Configuration

### Required Variables
```env
# Polymarket Trading
POLYMARKET_PRIVATE_KEY=your_polygon_private_key
CLOB_API_URL=https://clob.polymarket.com/

# ElizaOS Core
OPENAI_API_KEY=your_openai_api_key
PGLITE_DATA_DIR=./.eliza/.elizadb

# Trading Configuration  
TRADING_ENABLED=true
MAX_POSITION_SIZE=100
MIN_CONFIDENCE_THRESHOLD=0.7
```

### Optional Integrations
- `TAVILY_API_KEY` - Web search capabilities
- `NEWS_API_KEY` - News monitoring
- `TWITTER_*` - Social media analysis
- `DISCORD_*`, `TELEGRAM_*` - Platform integrations

## Runtime Requirements

**✅ Working**: `npm start` - Full functionality with PGLite database
**❌ Issue**: `bun run start` - PGLite compatibility issues with Bun runtime

Use Node.js runtime for production deployment.

## Plugin Compatibility Notes

The Polymarket plugin required significant compatibility updates for current ElizaOS:
- Action handlers converted from `Content` to `ActionResult` format
- WebSocket types added (`@types/ws`)
- Market filtering enhanced to show only active, tradeable markets
- Fixed fake token ID generation in LLM templates

## Key Trading Actions

- `retrieveAllMarkets` - Get all available prediction markets
- `getMarketDetails` - Detailed market information with prices
- `getBestPrice` - Best available bid/ask prices
- `getSpread` - Price spread calculations
- `placeOrder` - Execute trades (limit and market orders)
- `getSimplifiedMarkets` - Simplified market data view

## Build System

- **TypeScript**: ESNext target with module preservation
- **Vite**: Frontend build system for React components
- **TSUP**: Library bundling for plugin distribution  
- **Tailwind CSS**: Styling framework
- **Path Aliases**: `@elizaos/core` mapped to `../../core/src`

## Testing Strategy

- **Unit Tests**: Individual component and service testing
- **Integration Tests**: Plugin interaction testing
- **E2E Tests**: Full workflow testing with real API calls
- **Cypress**: Component and user workflow testing

The project includes comprehensive test coverage for all trading operations and market data handling.

## Frontend/Backend Separation Strategy

### Current State
- Three branches (master, frontend, backend) - which is messy
- Basic Railway configuration for monolithic deployment
- Custom React frontend in `src/frontend/`
- Vite configuration proxying API calls to localhost:3000

### Recommended Architecture: Monorepo with Separate Services

Keep everything in one repository but deploy as separate services:

```
pamela/
├── apps/
│   ├── agent/           # ElizaOS agent backend
│   │   ├── src/
│   │   ├── package.json
│   │   └── railway.json  # Backend-specific Railway config
│   └── web/             # Custom React frontend
│       ├── src/
│       ├── package.json
│       └── railway.json  # Frontend-specific Railway config
├── packages/
│   └── shared/          # Shared types, utilities
└── package.json         # Root workspace config
```

### Implementation Steps

1. **Restructure Repository**:
   - Move backend files to `apps/agent/`
   - Move frontend files to `apps/web/`
   - Create shared packages directory

2. **Backend Service** (`apps/agent`):
   - ElizaOS agent with API routes
   - Handles WebSocket connections
   - Manages Polymarket trading operations

3. **Frontend Service** (`apps/web`):
   - Custom React frontend
   - Connects to backend API
   - Real-time updates via WebSocket

4. **API Integration**:
   - Frontend uses environment variable for API URL
   - Backend exposes REST endpoints + WebSocket
   - Clear separation of concerns

5. **Deployment**:
   - Two separate Railway services
   - Independent scaling and deployment
   - Shared environment variables where needed

### Alternative Deployment Options

- **Vercel + Railway**: Frontend on Vercel, backend on Railway
- **Docker Compose**: Multi-container deployment
- **Fly.io**: Better WebSocket support

### Key Benefits

- Clean separation of frontend and backend
- Independent deployment and scaling
- Technology flexibility
- Better CI/CD practices
- Team autonomy