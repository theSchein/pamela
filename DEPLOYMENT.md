# Deployment Guide for Pamela Trading Agent

This guide covers deploying the Pamela prediction market trading agent to Railway or other cloud platforms.

## Architecture Overview

The application consists of two main services:
1. **Agent Service** - ElizaOS agent with Polymarket integration (port 3000)
2. **Web Frontend** - React UI for interacting with Pamela (port 80 in production)

## Deployment to Railway

### Prerequisites

1. Railway account (https://railway.app)
2. GitHub repository with your Pamela code
3. API keys ready:
   - OpenAI API key
   - Polymarket private key (Polygon wallet)
   - Optional: Tavily, NewsAPI, social media credentials

### Step 1: Create Railway Project

1. Log in to Railway
2. Click "New Project"
3. Choose "Deploy from GitHub repo"
4. Select your repository

### Step 2: Set Up Services

Railway will detect the monorepo structure. You need to create two services:

#### Agent Service

1. Click "New Service" → "GitHub Repo"
2. Configure:
   - **Service Name**: `pamela-agent`
   - **Root Directory**: `/`
   - **Build Command**: `cd apps/agent && npm ci && npm run build`
   - **Start Command**: `cd apps/agent && npm start`
   - **Dockerfile Path**: `apps/agent/Dockerfile.production`

3. Add environment variables:
   ```env
   NODE_ENV=production
   PORT=3000
   OPENAI_API_KEY=your_key_here
   POLYMARKET_PRIVATE_KEY=your_polygon_private_key
   CLOB_API_URL=https://clob.polymarket.com/
   TRADING_ENABLED=true
   MAX_POSITION_SIZE=100
   MIN_CONFIDENCE_THRESHOLD=0.7
   ```

4. Add PostgreSQL database:
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway will automatically inject `DATABASE_URL`

#### Frontend Service

1. Click "New Service" → "GitHub Repo"
2. Configure:
   - **Service Name**: `pamela-web`
   - **Root Directory**: `/`
   - **Build Command**: `cd apps/web && npm ci && npm run build`
   - **Dockerfile Path**: `apps/web/Dockerfile.production`

3. Add environment variables:
   ```env
   VITE_API_URL=https://pamela-agent.railway.app
   ```
   (Replace with your actual agent service URL)

### Step 3: Configure Custom Domains (Optional)

1. Go to service settings
2. Click "Custom Domain"
3. Add your domain and follow DNS instructions

### Step 4: Deploy

1. Push your code to GitHub
2. Railway will automatically build and deploy
3. Monitor logs for any issues

## Alternative Deployment Options

### Docker Compose (VPS/Cloud VM)

1. Copy `.env.production.example` to `.env`
2. Fill in your API keys
3. Run:
   ```bash
   docker-compose -f docker-compose.production.yml up -d
   ```

### Kubernetes

See `k8s/` directory for Kubernetes manifests (if needed, we can create these).

### Heroku

1. Create two Heroku apps (agent and web)
2. Add Heroku Postgres to agent app
3. Set buildpacks:
   ```bash
   heroku buildpacks:set heroku/nodejs -a pamela-agent
   heroku buildpacks:add --index 1 https://github.com/lstoll/heroku-buildpack-monorepo -a pamela-agent
   ```
4. Configure environment variables
5. Deploy via Git

## Environment Variables Reference

### Required for Agent

- `NODE_ENV` - Set to "production"
- `PORT` - Server port (default: 3000)
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - For AI responses
- `POLYMARKET_PRIVATE_KEY` - Polygon wallet private key
- `CLOB_API_URL` - Polymarket API endpoint

### Optional Integrations

- `TAVILY_API_KEY` - Web search capabilities
- `NEWS_API_KEY` - News monitoring
- `TWITTER_USERNAME/PASSWORD/EMAIL` - Twitter integration
- `DISCORD_BOT_TOKEN` - Discord bot
- `TELEGRAM_BOT_TOKEN` - Telegram bot

### Frontend Configuration

- `VITE_API_URL` - Backend API URL (include protocol)

## Production Considerations

### Security

1. **API Keys**: Use environment variables, never commit keys
2. **CORS**: Backend configured to accept frontend origin
3. **HTTPS**: Use SSL certificates (Railway provides automatically)
4. **Rate Limiting**: Consider adding rate limiting for public APIs

### Database

1. **Backups**: Enable automatic backups in Railway
2. **Connection Pooling**: PGLite handles this automatically
3. **Migrations**: Run on deployment if schema changes

### Monitoring

1. **Health Checks**: Both services have `/health` endpoints
2. **Logs**: Available in Railway dashboard
3. **Metrics**: Consider adding application monitoring (Sentry, etc.)

### Scaling

1. **Horizontal Scaling**: Increase replicas in Railway
2. **Vertical Scaling**: Upgrade Railway plan for more resources
3. **Caching**: Consider Redis for session/data caching

## Troubleshooting

### Agent Won't Start

1. Check logs: `railway logs -s pamela-agent`
2. Verify all required environment variables are set
3. Ensure DATABASE_URL is properly configured
4. Check Node.js version (requires >= 20)

### Frontend Can't Connect to Agent

1. Verify `VITE_API_URL` is set correctly
2. Check CORS settings in agent
3. Ensure WebSocket upgrade is allowed
4. Test Socket.IO connection directly

### Database Issues

1. Check DATABASE_URL format
2. Verify PostgreSQL is running
3. Check for migration errors
4. Review connection pool settings

### Trading Not Working

1. Verify POLYMARKET_PRIVATE_KEY is correct
2. Check wallet has MATIC for gas
3. Ensure TRADING_ENABLED=true
4. Review Polymarket API status

## Deployment Checklist

- [ ] All environment variables configured
- [ ] Database provisioned and connected
- [ ] API keys tested locally
- [ ] Frontend API URL updated
- [ ] Health checks passing
- [ ] Logs monitored during first deploy
- [ ] Custom domains configured (if needed)
- [ ] SSL certificates active
- [ ] Backup strategy in place
- [ ] Monitoring configured

## Quick Deploy Script

For Railway CLI users:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy agent service
railway up -s pamela-agent

# Deploy frontend service  
railway up -s pamela-web

# View logs
railway logs -s pamela-agent
```

## Support

For deployment issues:
1. Check Railway documentation: https://docs.railway.app
2. Review ElizaOS docs: https://elizaos.github.io/eliza/
3. Check logs for specific error messages
4. Ensure all dependencies are properly installed

Remember to keep your private keys secure and never commit them to version control!