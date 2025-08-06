# Railway Deployment Guide for Pamela Agent

Deploy your Pamela Discord bot with Polymarket trading capabilities to Railway for 24/7 operation.

## Prerequisites

- GitHub account with your repository
- Railway account (sign up at [railway.app](https://railway.app))
- Discord bot token
- OpenAI API key
- Polymarket wallet private key (optional for trading)

## Quick Start

### Using the Deployment Script

```bash
# Run the interactive deployment helper
./scripts/deploy-railway.sh
```

This script will guide you through:
- Setting environment variables from your .env file
- Deploying to Railway
- Checking deployment status
- Viewing logs

## Step 1: Prepare Your Code

```bash
# Ensure all changes are committed
git add .
git commit -m "Prepare for Railway deployment"
git push origin master
```

## Step 2: Deploy to Railway

### Option A: Deploy from GitHub (Recommended)

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Connect your GitHub account and select your repository
5. Railway will automatically detect the `railway.json` and `Dockerfile.railway` configuration

### Option B: Deploy via CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Deploy
railway up
```

## Step 3: Configure Environment Variables

In Railway dashboard:

1. Click on your project
2. Go to **Variables** tab
3. Add the following variables:

### Required Variables
```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
DISCORD_API_TOKEN=MTQwMjM2NTc0MjM4ODYwOTAyNA.Gb_YqH.xxxxxxxxxxxxx
POLYMARKET_PRIVATE_KEY=0xxxxxxxxxxxxxxxxxxx
```

### Configuration Variables
```env
# API Configuration
CLOB_API_URL=https://clob.polymarket.com/
CLOB_API_KEY=optional_api_key_for_higher_limits

# Trading Settings
TRADING_ENABLED=true
MAX_POSITION_SIZE=100
MIN_CONFIDENCE_THRESHOLD=0.7
SLIPPAGE_TOLERANCE=0.02

# System Configuration
NODE_ENV=production
BUN_INSTALL=/usr/local
PATH=/usr/local/bin:$PATH
PGLITE_DATA_DIR=/app/.eliza/.elizadb
LOG_LEVEL=info
```

### Optional Variables
```env
TAVILY_API_KEY=your_key_here
NEWS_API_KEY=your_key_here
SLIPPAGE_TOLERANCE=0.02
ORDER_TIMEOUT_MS=30000
MARKET_DATA_REFRESH_INTERVAL=43200000
```

## Step 4: Deploy

1. After adding environment variables, Railway will automatically redeploy
2. Check the deployment logs in the Railway dashboard
3. Look for: `"Discord client ready!"`

## Step 5: Verify Deployment

### Check Health Endpoint
```bash
curl https://your-app.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "pamela-agent",
  "timestamp": "2025-08-06T12:00:00.000Z",
  "uptime": 3600
}
```

### Check Discord Bot Status
- Your bot should appear online in Discord
- Send a test message: `@Pamela hello`

## Monitoring & Logs

### View Logs
- In Railway dashboard, click on your deployment
- Select **"Logs"** tab
- Filter by log level if needed

### Set Up Alerts
1. Go to project settings
2. Configure health check alerts
3. Set up Discord/email notifications

## Scaling & Performance

### Resource Limits
Railway provides:
- **Starter Plan**: $5/month, 8GB RAM, 8 vCPUs
- **Pro Plan**: $20/month, 32GB RAM, 32 vCPUs
- Auto-scaling available on Pro plan

### Optimization Tips
- The bot uses PGLite (embedded database) - no external database needed
- Market sync runs every 12 hours automatically
- Health checks ensure automatic restarts on failure

## Troubleshooting

### Bot Not Responding
1. Check Railway logs for errors:
   ```bash
   railway logs --tail 100
   ```
2. Verify DISCORD_API_TOKEN is correct
3. Ensure "Message Content Intent" is enabled in Discord Developer Portal
4. Check bot has proper permissions in Discord server

### Bun Installation Issues
The Railway deployment uses `Dockerfile.railway` which automatically installs Bun. If you see Bun-related errors:
1. The bot will automatically attempt to use Bun from `/usr/local/bin/bun`
2. As a fallback, it will use Node.js to run ElizaOS
3. Check that Railway is using `Dockerfile.railway` (not the standard Dockerfile)

### Trading Not Working
1. Verify POLYMARKET_PRIVATE_KEY is set correctly
2. Check wallet has MATIC for gas fees on Polygon network
3. Ensure TRADING_ENABLED=true
4. Verify wallet has USDC for trading
5. Check logs for specific error messages:
   ```bash
   railway logs --tail 50 | grep -i error
   ```

### High Memory Usage
1. Set memory limits in environment:
   ```env
   NODE_OPTIONS=--max-old-space-size=512
   ```
2. Reduce market sync frequency
3. Adjust MAX_POSITION_SIZE
4. Consider upgrading Railway plan

### Health Check Failures
If Railway reports health check failures:
1. Verify the health endpoint is responding:
   ```bash
   curl https://your-app.railway.app/health
   ```
2. Check that port 3001 is configured correctly
3. Review logs for startup errors

## Cost Estimation

- **Railway Starter**: ~$5/month
- **OpenAI API**: ~$10-50/month (depends on usage)
- **Total**: ~$15-55/month for 24/7 operation

## Update Deployment

### Via GitHub
```bash
git add .
git commit -m "Update bot features"
git push origin master
# Railway auto-deploys on push
```

### Via CLI
```bash
railway up
```

## Rollback

If something goes wrong:
1. Go to Railway dashboard
2. Click on deployment history
3. Select previous working deployment
4. Click "Rollback"

## Security Notes

- Never commit API keys to GitHub
- Use Railway's environment variables for all secrets
- Enable 2FA on Railway account
- Regularly rotate API keys
- Monitor wallet balance for trading

## Advanced Configuration

### Using Railway's PostgreSQL (Optional)
By default, the bot uses PGLite (embedded database). For production scale, you can use Railway's PostgreSQL:

1. Add PostgreSQL to your Railway project:
   - Click "New" → "Database" → "PostgreSQL"
   - Railway automatically sets `DATABASE_URL`

2. The bot will automatically detect and use the PostgreSQL database

### Custom Domain
1. Go to Settings → Domains in Railway dashboard
2. Add your custom domain
3. Configure DNS as instructed by Railway

### Monitoring & Alerts
1. Set up health check alerts in project settings
2. Configure Discord webhook for deployment notifications
3. Use Railway's metrics dashboard to monitor resource usage

## Important Files

- `railway.json` - Railway configuration
- `Dockerfile.railway` - Optimized Docker configuration for Railway
- `src/start-railway.mjs` - Railway-specific startup script
- `scripts/deploy-railway.sh` - Interactive deployment helper

## Support

- Railway Documentation: [docs.railway.app](https://docs.railway.app)
- Railway Discord: [discord.gg/railway](https://discord.gg/railway)
- ElizaOS Documentation: [elizaos.github.io](https://elizaos.github.io)
- GitHub Issues: Report bugs in this repository

---

Your Pamela agent is now ready for 24/7 deployment on Railway! 🚀