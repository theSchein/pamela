# Railway Deployment Guide for Pamela

This guide explains how to deploy Pamela with your custom frontend on Railway.

## Architecture Overview

The deployment consists of two separate Railway services:
1. **Agent Service** (Backend) - Runs ElizaOS + Express API server
2. **Web Service** (Frontend) - Your custom React frontend

## How It Works

### Local Development
- **Port 3000**: ElizaOS agent (ignore the default UI)
- **Port 3001**: Express API server (handles frontend requests)
- **Port 5173**: Custom React frontend

### Production on Railway
- **Agent Service**: Exposes API on Railway's assigned URL
- **Web Service**: Connects to Agent Service via environment variable

## Step-by-Step Deployment

### 1. Deploy Agent Service First

1. Create a new Railway project
2. Add a new service from GitHub (select the `pamela` repo)
3. Set the root directory to `/apps/agent`
4. Configure environment variables:

```env
# Required
OPENAI_API_KEY=your-openai-key
POLYMARKET_PRIVATE_KEY=your-polygon-wallet-private-key

# Optional but recommended
CLOB_API_URL=https://clob.polymarket.com/
TRADING_ENABLED=true
MAX_POSITION_SIZE=100
MIN_CONFIDENCE_THRESHOLD=0.7
API_PORT=3001
CORS_ORIGIN=https://your-frontend-domain.railway.app
DISABLE_WEB_UI=true

# Database (Railway provides this automatically)
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

5. Deploy and wait for it to be ready
6. Copy the Railway-provided URL (e.g., `https://pamela-agent.railway.app`)

### 2. Deploy Web Service

1. In the same Railway project, add another service
2. Select the same GitHub repo
3. Set the root directory to `/apps/web`
4. Configure environment variables:

```env
VITE_API_URL=https://pamela-agent.railway.app
PORT=80
```

5. Deploy the web service

### 3. Verify Connection

1. Visit your web service URL
2. Check the browser console for any CORS errors
3. Test the chat functionality

## How Frontend Talks to Pamela

### API Endpoints

The Express API server (port 3001) provides these endpoints:

- `POST /api/chat` - Send messages to Pamela
- `GET /api/portfolio` - Get current portfolio
- `GET /api/markets` - List available markets
- `GET /api/markets/:id` - Get market details
- `POST /api/orders` - Place trading orders
- `POST /api/orders/:id/cancel` - Cancel orders

### WebSocket Connection

Real-time updates via Socket.io:
- Portfolio updates
- Market price changes
- Order status updates

### Example Frontend Code

```javascript
// Chat with Pamela
const response = await fetch(`${VITE_API_URL}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello Pamela!' })
});

// Connect WebSocket
const socket = io(VITE_API_URL);
socket.on('portfolio:update', (data) => {
  console.log('Portfolio updated:', data);
});
```

## Current Implementation Status

### ✅ Working
- Express API server with all endpoints
- Mock responses for testing
- WebSocket support
- CORS configuration

### 🚧 TODO for Full Integration
1. Connect Express API to ElizaOS agent runtime
2. Implement real Polymarket trading via plugin
3. Add authentication/API keys
4. Replace mock data with real market data

## Troubleshooting

### CORS Issues
- Ensure `CORS_ORIGIN` in agent service matches your frontend URL
- For development, use `CORS_ORIGIN=*`

### Connection Refused
- Check that both services are running
- Verify `VITE_API_URL` is set correctly
- Look at Railway logs for startup errors

### API Not Responding
- The API server starts 3 seconds after ElizaOS
- Check logs: `railway logs -s agent-service-name`
- Ensure all required environment variables are set

## Alternative Deployment Options

### Single Service Deployment
If you prefer a simpler setup:
1. Use the root `railway.json`
2. Serve frontend from ElizaOS
3. Configure nginx to proxy API requests

### Separate Projects
For better isolation:
1. Create two separate Railway projects
2. Use public URLs for communication
3. Configure CORS appropriately

## Security Considerations

1. **API Keys**: Never expose private keys in frontend
2. **CORS**: Restrict to your frontend domain in production
3. **Rate Limiting**: Add rate limiting to API endpoints
4. **Authentication**: Implement user authentication before production
5. **HTTPS**: Railway provides HTTPS by default

## Next Steps

1. Test the deployment with mock data
2. Implement ElizaOS integration in `api-server.mjs`
3. Add Polymarket plugin functionality
4. Implement proper error handling
5. Add monitoring and logging

## Support

- Railway Discord: https://discord.gg/railway
- ElizaOS Docs: https://elizaos.github.io/eliza/
- Polymarket API: https://docs.polymarket.com/