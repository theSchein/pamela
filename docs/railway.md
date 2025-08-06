# Railway Deployment Guide for Pamela Agent

## Overview
This guide covers deploying the Pamela Polymarket trading agent to Railway for 24/7 operation.

## Prerequisites

### Railway Account Requirements
- **Hobby Plan or higher** (required for 8GB RAM)
  - Trial/Free plan has insufficient memory for syncing 3700+ markets
  - Hobby plan provides: 8GB RAM, 8 vCPU, 10GB ephemeral storage
- Railway CLI installed: `npm install -g @railway/cli`
- Authenticated with Railway: `railway login`

### Required Environment Variables
The following environment variables must be set in Railway:

```bash
# Core Wallet Configuration (REQUIRED)
WALLET_PRIVATE_KEY=your_polygon_private_key
PRIVATE_KEY=your_polygon_private_key  # Same as above
POLYMARKET_PRIVATE_KEY=your_polygon_private_key  # Same as above

# Discord Configuration (if using Discord)
DISCORD_API_TOKEN=your_discord_bot_token
DISCORD_APPLICATION_ID=your_discord_app_id

# LLM Provider (at least one required)
ANTHROPIC_API_KEY=your_anthropic_key
# OR
OPENAI_API_KEY=your_openai_key

# Memory Optimization (CRITICAL)
NODE_OPTIONS=--max-old-space-size=6144  # 6GB for Hobby plan
```

## Deployment Steps

### 1. Initialize Railway Project

```bash
# From the pamela directory
cd /path/to/pamela

# Initialize Railway project
railway init

# Link to existing project (if applicable)
railway link
```

### 2. Configure Railway Settings

Create/update `railway.json`:
```json
{
  "deploy": {
    "region": "europe-west1",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30
  }
}
```

Available regions:
- `us-west1` - US West (Oregon)
- `us-east4` - US East (Virginia)
- `europe-west1` - Europe West (Belgium)

### 3. Set Environment Variables

```bash
# Set all required variables
railway variables --set WALLET_PRIVATE_KEY=your_key
railway variables --set PRIVATE_KEY=your_key
railway variables --set POLYMARKET_PRIVATE_KEY=your_key
railway variables --set DISCORD_API_TOKEN=your_token
railway variables --set DISCORD_APPLICATION_ID=your_app_id
railway variables --set ANTHROPIC_API_KEY=your_key
railway variables --set NODE_OPTIONS=--max-old-space-size=6144
```

### 4. Deploy to Railway

```bash
# Deploy with detached mode
railway up --detach

# Monitor deployment
railway logs
```

## Memory Optimization

### Understanding Memory Requirements

The Pamela agent syncs 3700+ Polymarket markets on startup, requiring significant memory:
- **Minimum**: 4GB RAM (may experience occasional issues)
- **Recommended**: 6GB RAM (stable operation)
- **Optimal**: 8GB RAM (full headroom for growth)

### Memory Configuration

The memory is configured in three places:

1. **Dockerfile.railway**:
```dockerfile
ENV NODE_OPTIONS="--max-old-space-size=6144"
```

2. **src/start-railway.mjs**:
```javascript
const elizaProcess = spawn(bunPath, ['--max-old-space-size=6144', ...], {
  env: {
    ...process.env,
    NODE_OPTIONS: '--max-old-space-size=6144'
  }
});
```

3. **Railway Environment Variables**:
```bash
NODE_OPTIONS=--max-old-space-size=6144
```

### Memory Allocation by Plan

| Plan       | Total RAM | Recommended NODE_OPTIONS | Max Markets |
|------------|-----------|---------------------------|-------------|
| Trial/Free | 512MB     | Not supported             | N/A         |
| Hobby      | 8GB       | 6144 (6GB)                | 5000+       |
| Pro        | 32GB      | 24576 (24GB)              | Unlimited   |

## Troubleshooting

### SIGKILL Errors

**Symptom**: Process killed with SIGKILL after fetching markets
```
ElizaOS exited with code null and signal SIGKILL
Process was killed by signal: SIGKILL
```

**Solution**: Increase memory allocation
1. Upgrade to Hobby plan or higher
2. Set NODE_OPTIONS to 75% of available RAM
3. Redeploy with `railway up --detach`

### Health Check Failures

**Symptom**: 403 Forbidden on health checks
```
Failed to perform health check: 403 Forbidden
```

**Solution**: Ensure health server binds to all interfaces
```javascript
healthServer.listen(healthPort, '0.0.0.0', () => {
  console.log(`Health check server on port ${healthPort}`);
});
```

### Discord Connection Issues

**Symptom**: "Used disallowed intents" error
```
Failed to login to Discord: Used disallowed intents
```

**Solution**: 
1. Go to Discord Developer Portal
2. Enable "Message Content Intent" in Bot settings
3. Ensure Discord plugin is imported in `src/index.ts`

### Environment Variable Issues

**Symptom**: "No private key found" error

**Solution**: Set all three wallet variables to the same key:
```bash
railway variables --set WALLET_PRIVATE_KEY=0x...
railway variables --set PRIVATE_KEY=0x...
railway variables --set POLYMARKET_PRIVATE_KEY=0x...
```

## Monitoring

### View Logs
```bash
# Real-time logs
railway logs

# Last 100 lines
railway logs --lines 100
```

### Check Deployment Status
```bash
# View current deployment
railway status

# View all deployments
railway deployments
```

### Resource Usage
Monitor resource usage in Railway dashboard:
- Memory usage should stay below 75% of limit
- CPU usage spikes during market sync are normal
- Network usage increases during trading hours

## Performance Optimization

### Market Sync Strategy
The agent syncs markets with these optimizations:
- Fetches up to 5000 markets per sync
- Filters by minimum liquidity ($1000+)
- Orders by liquidity (most liquid first)
- Syncs every 12 hours automatically
- Logs progress every 10% during sync

### Database Optimization
- Uses PGLite embedded database
- Automatically cleans up markets older than 30 days
- Validates market dates to prevent stale data
- Batch inserts for better performance

## Deployment Checklist

Before deploying, ensure:
- [ ] Railway Hobby plan or higher activated
- [ ] All environment variables set correctly
- [ ] Discord bot token valid (if using Discord)
- [ ] Message Content Intent enabled in Discord
- [ ] Polygon wallet has sufficient MATIC for gas
- [ ] NODE_OPTIONS set to appropriate memory limit
- [ ] Health check endpoint configured
- [ ] Region selected in railway.json

## Quick Deploy Script

Create `scripts/deploy-railway.sh`:
```bash
#!/bin/bash
echo "Deploying Pamela to Railway..."

# Set memory optimization
railway variables --set NODE_OPTIONS=--max-old-space-size=6144

# Deploy
railway up --detach

# Show logs
sleep 5
railway logs --lines 50

echo "Deployment initiated. Monitor at: railway logs"
```

## Support

For issues:
1. Check Railway deployment logs: `railway logs`
2. Verify environment variables: `railway variables`
3. Ensure sufficient memory allocation
4. Review health check endpoint status
5. Check Discord bot permissions (if applicable)

For Railway-specific issues, consult:
- [Railway Documentation](https://docs.railway.com)
- [Railway Discord Community](https://discord.gg/railway)