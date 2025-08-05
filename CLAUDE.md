# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Pamela** is an autonomous prediction market trading agent built on ElizaOS that can execute trades on Polymarket using its own Polygon wallet. The project integrates with Polymarket's CLOB (Central Limit Order Book) API for real-time market data and trading operations.

## Project Structure

This is a monorepo with the following structure:
- **Root**: Contains Docker configurations and scripts for development/testing
- **apps/agent**: The main ElizaOS backend with Polymarket plugin integration
- **apps/web**: React frontend (optional, experimental)
- **packages/shared**: Shared TypeScript types (when needed)

## Development Commands

### Monorepo Commands (from root)
- `npm run dev` - Navigate to apps/agent and run development server
- `npm run build` - Build the agent application
- `npm start` - Start production agent (runs `cd apps/agent && npm start`)
- `npm test` - Run agent tests
- `npm run format` - Format all code in the monorepo
- `npm run format:check` - Check code formatting
- `npm run clean` - Remove all node_modules and dist directories

### Agent Commands (in apps/agent/)
- `npm start` - Start production with custom wrapper (`node src/start-production.mjs`)
- `elizaos start` or `bun run start:eliza` - Start with ElizaOS directly  
- `elizaos dev` or `bun run dev` - Development mode with hot reload
- `bun run build` - Build TypeScript and bundle (`tsc --noEmit && tsup`)

### Code Quality
- `bun run lint` - Format source code with Prettier (`prettier --write ./src`)
- `bun run format` - Same as lint
- `bun run format:check` - Check formatting without changes
- `bun run type-check` - TypeScript type checking without emit
- `bun run type-check:watch` - Watch mode type checking
- `bun run check-all` - Run type-check, format:check, and tests

### Testing
- `bun run test` - Run full test suite
- `bun run test:coverage` - Run tests with coverage report
- `bun run test:watch` - Run tests in watch mode
- `npm run check-all` - Run type-check, format:check, and tests

### Docker-Based Development (Recommended)
- `./scripts/test-local.sh` - Start full local environment with Docker
- `./scripts/test-production.sh` - Test production build locally
- `./scripts/test-simple.sh` - Run simplified Docker setup
- `docker-compose up` - Start all services
- `docker-compose down` - Stop all services
- `docker-compose logs -f [service]` - View logs (agent, web, etc.)

### Telegram Bot Development
- `./start-telegram.sh` - Quick start Telegram bot
- `docker-compose -f docker-compose.telegram.yml up` - Start Telegram bot with Docker

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

## Quick Start Guide

1. **Local Development with Docker** (Recommended):
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your API keys
   ./scripts/test-local.sh
   ```

2. **Manual Development**:
   ```bash
   cd apps/agent
   cp .env.example .env
   # Edit .env with your API keys
   npm install
   npm start
   ```

3. **Running Tests**:
   ```bash
   # From root
   npm test
   # Or from apps/agent
   bun run test
   ```

## Plugin Compatibility Notes

The Polymarket plugin required significant compatibility updates for current ElizaOS:
- Action handlers converted from `Content` to `ActionResult` format
- WebSocket types added (`@types/ws`)
- Market filtering enhanced to show only active, tradeable markets
- Fixed fake token ID generation in LLM templates

See `PLUGIN_COMPATIBILITY_NOTES.md` for detailed technical fixes.

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

## Frontend Integration

The custom frontend communicates with ElizaOS using Socket.IO. Key points:

- **Connection**: Frontend connects to `ws://localhost:3000` using Socket.IO client
- **Message Format**: Must use `message` field (not `text`) when sending
- **Channel Management**: Use persistent channel IDs for conversation history
- **Event Types**: ElizaOS uses numeric events (1=ROOM_JOINING, 2=SEND_MESSAGE)
- **Response Handling**: Listen for `messageBroadcast` events for agent responses

See `SOCKETIO_INTEGRATION.md` for detailed implementation guide.

## Testing Strategy

- **Unit Tests**: Individual component and service testing
- **Integration Tests**: Plugin interaction testing
- **E2E Tests**: Full workflow testing with real API calls
- **Cypress**: Component and user workflow testing

The project includes comprehensive test coverage for all trading operations and market data handling.

## Common Development Workflows

### Adding New Trading Actions
1. Create action file in `plugin-polymarket/src/actions/`
2. Follow existing action patterns (see `placeOrder.ts` as reference)
3. Update `plugin-polymarket/src/index.ts` to export the action
4. Add tests in `plugin-polymarket/__tests__/`

### Testing Trading Operations
```bash
# Test specific functionality
cd apps/agent
bun test plugin-polymarket/__tests__/direct-trading.test.ts

# Run integration tests
bun test plugin-polymarket/__tests__/integration.test.ts
```

### Debugging Tips
- Check logs: `docker-compose logs -f agent`
- Verify environment variables are loaded: Check `.env` in `apps/agent/`
- For WebSocket issues: Ensure port 3001 is available
- For database issues: Delete `.eliza/.elizadb` and restart