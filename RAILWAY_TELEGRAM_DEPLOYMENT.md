# Railway Deployment Guide - Telegram Bot

This guide explains how to deploy Pamela as a Telegram bot on Railway.

## Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **Telegram Bot Token**: Created via @BotFather
3. **API Keys**: OpenAI and Polymarket credentials

## Deployment Steps

### 1. Create Railway Project

```bash
# Install Railway CLI (optional)
npm install -g @railway/cli

# Login to Railway
railway login

# Create new project
railway init
```

Or use the Railway dashboard to create a new project.

### 2. Connect GitHub Repository

1. In Railway dashboard, click "New Project"
2. Select "Deploy from GitHub repo"
3. Connect your GitHub account and select the Pamela repository
4. Select the `master` branch

### 3. Configure Service

1. **Service Name**: `pamela-telegram-bot`
2. **Root Directory**: `/` (repository root)
3. **Railway Config File**: `railway.telegram.json`

### 4. Environment Variables

Add these variables in Railway:

```env
# Required
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
OPENAI_API_KEY=your_openai_api_key
POLYMARKET_PRIVATE_KEY=your_polygon_private_key

# Optional but recommended
CLOB_API_URL=https://clob.polymarket.com/
TRADING_ENABLED=true
MAX_POSITION_SIZE=100
MIN_CONFIDENCE_THRESHOLD=0.7

# Fixed Agent ID (keep consistent)
AGENT_ID=df35947c-da83-0a0a-aa27-c4cc3ec722cd

# Database (Railway will auto-provision)
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

### 5. Add PostgreSQL Database

1. Click "New" in your Railway project
2. Select "Database" → "Add PostgreSQL"
3. Railway will automatically set the `DATABASE_URL`

### 6. Deploy

Railway will automatically:
1. Detect the `railway.telegram.json` configuration
2. Build using `Dockerfile.telegram`
3. Start the bot with health checks
4. Restart on failures

### 7. Monitor Deployment

Check the deployment logs:
- Look for "Connected to Telegram successfully"
- Verify "Health check server running on port 3001"
- Confirm "Pamela is ready to chat!"

### 8. Test Your Bot

1. Open Telegram
2. Search for your bot username
3. Send `/start`
4. Try commands like:
   - "What are the popular markets?"
   - "Show me election markets"
   - "What's the price of Bitcoin hitting 100k?"

## Deployment Configuration

The `railway.telegram.json` file configures:
- Docker build with `Dockerfile.telegram`
- Health checks on port 3001
- Automatic restarts on failure
- Proper start command

## Monitoring

### Logs
- View real-time logs in Railway dashboard
- Filter by service to see only bot logs

### Health Checks
- Railway monitors `/api/health` endpoint
- Automatic restarts if health check fails

### Metrics
- Monitor memory and CPU usage
- Set up alerts for high usage

## Troubleshooting

### Bot Not Responding
1. Check TELEGRAM_BOT_TOKEN is set correctly
2. Verify bot is running in logs
3. Ensure health checks are passing

### Database Connection Issues
1. Verify DATABASE_URL is set
2. Check PostgreSQL service is running
3. Look for connection errors in logs

### Trading Not Working
1. Confirm POLYMARKET_PRIVATE_KEY is valid
2. Check wallet has USDC balance
3. Verify TRADING_ENABLED=true

## Production Best Practices

1. **Set Up Domains**: Add custom domain for webhooks (optional)
2. **Enable Monitoring**: Use Railway's built-in metrics
3. **Set Resource Limits**: Configure memory/CPU limits
4. **Use Secrets**: Store sensitive data in Railway variables
5. **Enable Backups**: Set up database backups

## Scaling

Railway automatically handles:
- Container orchestration
- Load balancing (if multiple instances)
- Zero-downtime deployments
- Automatic SSL certificates

## Cost Estimation

- **Hobby Plan**: $5/month (includes $5 usage)
- **Telegram Bot**: ~$3-5/month (low resource usage)
- **PostgreSQL**: ~$5/month (starter size)
- **Total**: ~$10-15/month for production bot

## Next Steps

1. Set up monitoring alerts
2. Configure webhook mode for better performance
3. Add custom commands via BotFather
4. Implement user access controls
5. Set up automated backups