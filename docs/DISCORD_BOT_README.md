# Pamela Discord Bot - Quick Setup Guide

A Polymarket trading bot for Discord powered by ElizaOS.

## Quick Start

### 1. Prerequisites
- Node.js 20+
- Discord account
- OpenAI API key
- Polymarket wallet (optional for trading)

### 2. Setup Discord Bot

1. Create bot at [Discord Developer Portal](https://discord.com/developers/applications)
2. Go to Bot section → Reset Token → Copy token
3. Enable **Privileged Gateway Intents**:
   - ✅ MESSAGE CONTENT INTENT (Required!)
   - ✅ SERVER MEMBERS INTENT
   - ✅ PRESENCE INTENT

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your keys:
# - DISCORD_API_TOKEN=your_bot_token
# - OPENAI_API_KEY=your_openai_key
# - POLYMARKET_PRIVATE_KEY=your_wallet_key (optional)
```

### 4. Install & Run

```bash
# Install dependencies
cd apps/agent && npm install && cd ../..

# Start bot
./start-discord.sh
```

### 5. Add Bot to Server

Use this link (replace CLIENT_ID with your bot's application ID):
```
https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&permissions=277025508352&scope=bot%20applications.commands
```

## Commands

Talk to the bot by @mentioning it or via DM:
- `@Pamela what markets are trending?`
- `@Pamela check price of [market]`
- `@Pamela buy 10 USDC of YES on [market]`
- `@Pamela what's my portfolio?`

## Deploy to Railway (24/7 Operation)

1. Push to GitHub
2. Deploy on [Railway](https://railway.app)
3. Add environment variables
4. Bot runs 24/7 for ~$5/month

See `RAILWAY_DEPLOYMENT.md` for detailed deployment instructions.

## Troubleshooting

**Bot not responding?**
- Enable MESSAGE CONTENT INTENT in Discord Developer Portal
- Check bot has Send Messages permission in your server
- Verify DISCORD_API_TOKEN is correct in .env

**Trading not working?**
- Ensure POLYMARKET_PRIVATE_KEY is set
- Wallet needs MATIC for gas fees
- Set TRADING_ENABLED=true

## Support

- [Discord Setup Guide](DISCORD_SETUP.md)
- [Railway Deployment](RAILWAY_DEPLOYMENT.md)
- [ElizaOS Docs](https://elizaos.github.io)