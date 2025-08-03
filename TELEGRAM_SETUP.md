# Telegram Bot Setup for Pamela

## 1. Create Your Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Start a conversation with BotFather
3. Send `/newbot` command
4. Choose a name for your bot (e.g., "Pamela Trading Agent")
5. Choose a username for your bot (must end in 'bot', e.g., `PamelaTradingBot`)
6. BotFather will give you a token like: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

## 2. Configure Your Bot Settings (Optional)

With BotFather, you can:
- `/setdescription` - Set bot description
- `/setabouttext` - Set about text
- `/setuserpic` - Set bot profile picture
- `/setcommands` - Set bot commands

Suggested commands:
```
help - Get help using Pamela
markets - Show popular prediction markets
search - Search for specific markets
portfolio - View your trading positions
trade - Execute a trade
```

## 3. Environment Configuration

### Local Development (.env)
```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Keep your existing Polymarket and AI configurations
OPENAI_API_KEY=your_key
POLYMARKET_PRIVATE_KEY=your_key
CLOB_API_URL=https://clob.polymarket.com/
```

### Railway Configuration
Add the TELEGRAM_BOT_TOKEN to your Railway environment variables:
1. Go to your Railway project
2. Select the agent service
3. Go to Variables tab
4. Add `TELEGRAM_BOT_TOKEN` with your bot token

## 4. Test Your Bot Locally

```bash
# Start the agent with Telegram support
npm start

# Or with Docker
docker-compose up agent
```

## 5. Interact with Your Bot

1. Find your bot on Telegram (search for the username you created)
2. Start a conversation with `/start`
3. Try commands like:
   - "What are the popular markets?"
   - "Show me election markets"
   - "What's the price of Trump winning?"
   - "Place a buy order for 100 shares"

## 6. Telegram-Specific Features

The Telegram plugin automatically handles:
- Direct messages
- Group chats (add bot to groups)
- Inline queries (if enabled)
- Command parsing
- Rich message formatting
- File/image sharing

## 7. Security Notes

- Never share your bot token publicly
- The token in your `.env` file should not be committed to git
- Use Railway's secure environment variables for production
- Consider setting up allowed user lists for trading functions

## 8. Monitoring

You can monitor your bot's activity through:
- Railway logs
- ElizaOS console output
- Telegram's @BotFather statistics

## 9. Advanced Configuration

For production, consider:
- Setting up webhook mode instead of polling (better performance)
- Implementing rate limiting
- Adding user authentication for trading
- Setting up alerts and notifications