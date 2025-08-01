# Local Testing Guide

This guide explains how to test the Pamela monorepo locally before deploying to Railway.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 20+ (for non-Docker development)
- Your Polymarket private key and OpenAI API key

## Quick Start

1. **Copy environment file**:
   ```bash
   cp .env.local.example .env.local
   ```

2. **Edit `.env.local`** with your actual keys:
   - `OPENAI_API_KEY` - Required for AI functionality
   - `POLYMARKET_PRIVATE_KEY` - Required for trading (use a test wallet!)
   - Set `TRADING_ENABLED=false` for safe testing

3. **Run local development**:
   ```bash
   ./scripts/test-local.sh
   ```

4. **Access the application**:
   - Frontend: http://localhost:5173
   - API: http://localhost:3000
   - WebSocket: ws://localhost:3001

## Testing Scenarios

### 1. Development Mode (Hot Reload)

```bash
# Using Docker
./scripts/test-local.sh

# OR using npm directly
npm install
npm run dev
```

### 2. Production Build

```bash
# Test production build locally
./scripts/test-production.sh
```

This builds optimized images and runs them as they would in production.

### 3. Individual Service Testing

```bash
# Test only the agent
cd apps/agent
npm install
npm run dev

# Test only the frontend
cd apps/web
npm install
npm run dev
```

### 4. API Testing

Test the API endpoints:

```bash
# Health check
curl http://localhost:3000/api/health

# Get markets
curl http://localhost:3000/api/markets

# Test chat (requires valid API key)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello Pamela"}'
```

### 5. WebSocket Testing

```javascript
// In browser console
const ws = new WebSocket('ws://localhost:3001/ws');
ws.onmessage = (event) => console.log('Message:', event.data);
ws.send(JSON.stringify({ type: 'portfolio:subscribe', payload: {} }));
```

## Common Issues

### Port Conflicts

If ports are already in use:

```bash
# Check what's using the ports
lsof -i :3000
lsof -i :5173
lsof -i :5432

# Stop conflicting services or change ports in docker-compose.yml
```

### Database Issues

```bash
# Reset database
docker-compose down -v
docker-compose up -d postgres
```

### Build Failures

```bash
# Clean everything and rebuild
docker-compose down
docker system prune -f
docker-compose build --no-cache
docker-compose up
```

## Testing Checklist

Before deploying, ensure:

- [ ] Frontend loads at http://localhost:5173
- [ ] Chat interface connects and responds
- [ ] Portfolio section shows (even if empty)
- [ ] API health check returns success
- [ ] No errors in Docker logs
- [ ] WebSocket connects successfully

## Security Notes

1. **Never use your main Polymarket wallet for testing**
2. Start with `TRADING_ENABLED=false`
3. Use small `MAX_POSITION_SIZE` values
4. Test with Polygon testnet if possible

## Monitoring

View logs:

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f agent
docker-compose logs -f web
docker-compose logs -f postgres

# Production logs
docker-compose -f docker-compose.prod.yml logs -f
```

## Next Steps

Once local testing is successful:

1. Commit all changes
2. Push to your repository
3. Deploy to Railway using the individual `railway.json` files
4. Configure environment variables in Railway dashboard
5. Monitor deployment logs

## Troubleshooting

### Agent won't start
- Check OpenAI API key is valid
- Verify Polymarket private key format (must start with 0x)
- Check database connection

### Frontend can't connect to API
- Ensure agent is running and healthy
- Check VITE_API_URL in frontend environment
- Verify CORS settings if deploying separately

### WebSocket connection fails
- Check firewall/proxy settings
- Ensure port 3001 is accessible
- Verify WebSocket upgrade headers