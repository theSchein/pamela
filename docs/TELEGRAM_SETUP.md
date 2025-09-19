# Telegram Bot Setup Guide

This guide will help you set up your Polymarket trading bot on Telegram.

## Prerequisites
- Telegram account
- Node.js 20+ installed
- Polymarket wallet with USDC

## Step 1: Create Your Telegram Bot

1. **Open Telegram and find BotFather**
   - Search for `@BotFather` in Telegram
   - Start a conversation with BotFather

2. **Create a new bot**
   ```
   /newbot
   ```
   
3. **Choose a name for your bot**
   - Example: "My Polymarket Trader"
   - This is the display name users will see

4. **Choose a username for your bot**
   - Must end with 'bot'
   - Example: `mypolymarket_bot`
   - This will be your bot's @username

5. **Save your bot token**
   - BotFather will give you a token like:
   ```
   7123456789:ABCdefGHIjklMNOpqrsTUVwxyz123456789
   ```
   - Keep this token secret!

## Step 2: Configure Your Bot

1. **Set up environment variables**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   ```

2. **Edit `.env` and add your Telegram token**
   ```env
   # Telegram Bot Integration
   TELEGRAM_BOT_TOKEN=7123456789:ABCdefGHIjklMNOpqrsTUVwxyz123456789
   
   # Required: Polymarket configuration
   POLYMARKET_PRIVATE_KEY=0x_your_wallet_private_key
   WALLET_PRIVATE_KEY=0x_your_wallet_private_key
   PRIVATE_KEY=0x_your_wallet_private_key
   CLOB_API_URL=https://clob.polymarket.com/
   
   # Required: AI model (at least one)
   OPENAI_API_KEY=your_openai_key
   # or
   ANTHROPIC_API_KEY=your_anthropic_key
   ```

3. **Configure bot settings (optional)**
   - Return to BotFather to customize:
   ```
   /mybots
   Select your bot → Edit Bot → Edit Commands
   ```
   
   Add these commands:
   ```
   start - Start interacting with the bot
   help - Get help on using the bot
   markets - Show trending prediction markets
   portfolio - View your current positions
   balance - Check your wallet balance
   ```

## Step 3: Run Your Bot

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start the bot**
   ```bash
   npm start
   ```

3. **Verify the bot is running**
   - You should see:
   ```
   Telegram bot started successfully
   Bot username: @mypolymarket_bot
   ```

## Step 4: Interact with Your Bot

1. **Open Telegram and find your bot**
   - Search for your bot's username (e.g., @mypolymarket_bot)
   - Or use the direct link: `https://t.me/mypolymarket_bot`

2. **Start a conversation**
   ```
   /start
   ```

3. **Try some commands**
   - "Show me trending markets"
   - "What's the price of [market name]?"
   - "Buy $10 YES on [market]"
   - "What's my portfolio worth?"

## Trading Examples

### Searching Markets
```
You: Show me election markets
Bot: Here are trending election markets:
1. "Will Trump win the 2028 primary?" - YES: $0.45, NO: $0.55
2. "Democrats win House 2026?" - YES: $0.62, NO: $0.38
...
```

### Placing Orders
```
You: Buy $25 YES on Trump 2028
Bot: Placing order... 
✅ Bought 55.5 YES shares at $0.45 each
Total spent: $25.00
```

### Checking Positions
```
You: Show my positions
Bot: Your current positions:
- "Trump 2028 primary": 55.5 YES shares (current value: $27.75)
- "BTC above $100k": 100 NO shares (current value: $42.00)
Total portfolio value: $69.75
```

## Advanced Configuration

### Group Chat Support
Your bot can work in group chats:

1. Add the bot to a group
2. Make the bot an admin (required for it to see messages)
3. Users can interact using commands or mentions:
   ```
   @mypolymarket_bot what's the price of BTC 100k market?
   ```

### Privacy Settings
In BotFather, configure privacy:
```
/mybots → Your Bot → Bot Settings → Group Privacy
```
- **Disabled**: Bot sees all messages (recommended for trading groups)
- **Enabled**: Bot only sees commands and mentions

### Rate Limiting
The bot includes built-in rate limiting to prevent abuse:
- Max 10 trades per minute per user
- Max 50 messages per minute per user

## Security Best Practices

1. **Never share your bot token**
   - Treat it like a password
   - If compromised, regenerate it in BotFather: `/revoke`

2. **Use a dedicated trading wallet**
   - Don't use your main wallet
   - Only fund it with what you're willing to trade

3. **Set trading limits in .env**
   ```env
   MAX_POSITION_SIZE=100
   MIN_CONFIDENCE_THRESHOLD=0.7
   ```

4. **Monitor your bot**
   - Check logs regularly: `npm run logs`
   - Set up alerts for large trades

## Troubleshooting

### Bot not responding
1. Check your token is correct
2. Ensure bot is running: `npm start`
3. Check logs for errors

### "Unauthorized" error
- Your token is incorrect or has been revoked
- Generate a new token in BotFather

### Bot can't see messages in groups
- Make sure bot is an admin
- Check privacy settings in BotFather

### Trading errors
- Verify wallet has USDC on Polygon
- Check CLOB_API_URL is correct
- Ensure private keys match

## Updating Your Bot

To update to the latest version:
```bash
git pull
npm install
npm start
```

## Getting Help

- Check logs: Look for error messages in the console
- GitHub Issues: Report bugs or request features
- BotFather: Use `/help` for Telegram-specific issues

## Next Steps

- Customize your bot's personality in `src/character.ts`
- Add custom trading strategies
- Integrate additional data sources (weather, news, etc.)
- Set up monitoring and alerts