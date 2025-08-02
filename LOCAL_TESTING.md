# Local Testing Guide - Pamela Frontend Integration

## Quick Start

### 1. Start All Services

```bash
# Using Docker Compose (recommended)
docker-compose -f docker-compose.simple.yml up -d

# Or manually:
cd apps/agent && npm run dev:all  # Starts both ElizaOS and API server
cd apps/web && npm run dev         # In another terminal
```

### 2. Verify Services Are Running

- **Frontend**: http://localhost:5173
- **API Server**: http://localhost:3001/api/health
- **ElizaOS**: http://localhost:3000 (ignore this, just for agent)

### 3. Test API Endpoints

```bash
# Health check
curl http://localhost:3001/api/health

# Chat with Pamela
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello Pamela!"}'

# Get portfolio
curl http://localhost:3001/api/portfolio

# Get markets
curl http://localhost:3001/api/markets
```

## How It Works

```
Your Frontend (5173) → API Server (3001) → Mock Responses
                           ↓
                    ElizaOS (3000) [Future integration]
```

Currently, the API server returns mock responses. In the future, it will communicate with ElizaOS to get real AI responses from Pamela.

## Testing in Your Browser

1. Open http://localhost:5173 in your browser
2. You should see your custom OkayBet frontend
3. Try the chat feature - you'll get responses from the API server
4. Check the portfolio and markets sections

## Test Integration Page

We've created a test page at `test-integration.html` that you can open to test all API endpoints:

```bash
# Open in browser
file:///home/dov/Documents/okay-bet/ai-trader/pamela/test-integration.html
```

## Current Status

### ✅ Working
- Frontend can send chat messages
- Portfolio data is displayed (mock data)
- Markets list is available (mock data)
- WebSocket connection for real-time updates
- CORS is properly configured

### 🚧 TODO
- Connect API server to ElizaOS agent for real AI responses
- Implement actual Polymarket data fetching
- Add user authentication
- Replace mock data with real trading data

## Troubleshooting

### CORS Issues
If you see CORS errors in the browser console:
1. Make sure the API server is running on port 3001
2. Check that CORS is enabled in the API server (it is by default)

### Connection Refused
1. Check all services are running: `docker ps`
2. Verify ports: `netstat -tlnp | grep -E "3000|3001|5173"`
3. Check Docker logs: `docker logs pamela_agent_1`

### API Not Responding
1. The API server might not have started properly
2. Manually start it: `docker exec pamela_agent_1 node src/api-server.mjs &`
3. Check logs: `docker exec pamela_agent_1 cat /tmp/api.log`

## Next Steps

1. **Test the Chat**: Send messages through your frontend and verify responses
2. **Check Real-time Updates**: Open browser console to see WebSocket messages
3. **Integrate with ElizaOS**: Modify `api-server.mjs` to communicate with the actual Pamela agent
4. **Add Polymarket Integration**: Connect the Polymarket plugin for real market data