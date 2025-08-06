# Railway Deployment Guide for Discord Bot

Deploy your Pamela Discord bot to Railway for 24/7 operation.

## Prerequisites

- GitHub account with your repository
- Railway account (sign up at [railway.app](https://railway.app))
- Discord bot token
- OpenAI API key
- Polymarket wallet private key (optional for trading)

## Step 1: Push to GitHub

```bash
git add .
git commit -m "Add Railway deployment configuration for Discord bot"
git push origin master
```

## Step 2: Deploy to Railway

### Option A: Deploy from GitHub (Recommended)

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Connect your GitHub account and select your repository
5. Railway will auto-detect the configuration

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
CLOB_API_URL=https://clob.polymarket.com/
TRADING_ENABLED=true
MAX_POSITION_SIZE=100
MIN_CONFIDENCE_THRESHOLD=0.7
PGLITE_DATA_DIR=/app/.eliza/.elizadb
NODE_ENV=production
LOG_LEVEL=info
DISABLE_WEB_UI=true
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
1. Check Railway logs for errors
2. Verify DISCORD_API_TOKEN is correct
3. Ensure bot has proper permissions in Discord server

### Trading Not Working
1. Verify POLYMARKET_PRIVATE_KEY is set
2. Check wallet has MATIC for gas fees
3. Ensure TRADING_ENABLED=true

### High Memory Usage
1. Reduce market sync frequency
2. Adjust MAX_POSITION_SIZE
3. Consider upgrading Railway plan

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

## Support

- Railway Documentation: [docs.railway.app](https://docs.railway.app)
- Railway Discord: [discord.gg/railway](https://discord.gg/railway)
- ElizaOS Documentation: [elizaos.github.io](https://elizaos.github.io)

---

Your bot is now ready for 24/7 deployment on Railway! 🚀