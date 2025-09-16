#!/bin/bash

echo "=== TEE Deployment Verification ==="
echo ""

APP_ID="app_292adf7fd9fde6a04d1b2e7642c207fe02ca6681"

# Check CVM status
echo "1. Checking CVM Status..."
npx phala cvms get $APP_ID
echo ""

# Test Telegram bot
echo "2. Testing Telegram Bot..."
TOKEN=$(grep "^TELEGRAM_BOT_TOKEN=" .env.tee.backup | cut -d= -f2)
if [ ! -z "$TOKEN" ]; then
    echo "   Testing Telegram API with deployed token..."
    RESPONSE=$(curl -s "https://api.telegram.org/bot${TOKEN}/getMe")
    if echo "$RESPONSE" | jq -e '.ok' > /dev/null 2>&1; then
        echo "   ✓ Telegram bot token is valid"
        echo "$RESPONSE" | jq '.result | {id, username, first_name}'
    else
        echo "   ✗ Telegram bot token test failed"
        echo "$RESPONSE" | jq '.'
    fi
else
    echo "   ✗ No Telegram token found in deployment"
fi
echo ""

# Check critical environment variables
echo "3. Environment Variables Check:"
echo "   Variables sent to TEE:"
echo "   - Total variables: $(grep -c "^[A-Z_]+=" .env.tee.backup)"
echo "   - Has TELEGRAM_BOT_TOKEN: $(grep -q "^TELEGRAM_BOT_TOKEN=" .env.tee.backup && echo "✓ Yes" || echo "✗ No")"
echo "   - Has POLYMARKET_PRIVATE_KEY: $(grep -q "^POLYMARKET_PRIVATE_KEY=" .env.tee.backup && echo "✓ Yes" || echo "✗ No")"
echo "   - Has OPENAI_API_KEY: $(grep -q "^OPENAI_API_KEY=" .env.tee.backup && echo "✓ Yes" || echo "✗ No")"
echo "   - Has ANTHROPIC_API_KEY: $(grep -q "^ANTHROPIC_API_KEY=.+" .env.tee.backup && echo "✓ Yes (with value)" || echo "✗ No/Empty")"
echo ""

# Provide guidance based on findings
echo "4. Troubleshooting Guide:"
echo ""

# Check if ANTHROPIC_API_KEY is empty
if ! grep -q "^ANTHROPIC_API_KEY=.+" .env.tee.backup; then
    echo "   ⚠ ANTHROPIC_API_KEY is empty or missing"
    echo "   This might cause issues if the agent tries to use Claude"
    echo "   Solution: Add the key to .env and redeploy"
    echo ""
fi

echo "5. Testing TEE Telegram Integration:"
echo "   a) Wait 2-3 minutes for agent to fully initialize"
echo "   b) Send '/help' to @pamela_pm_bot on Telegram"
echo "   c) If no response after 5 minutes, check:"
echo "      - Dashboard logs: https://cloud.phala.network/dashboard/cvms/$APP_ID"
echo "      - Try: npx phala cvms restart $APP_ID"
echo ""

echo "6. Alternative Testing:"
echo "   If Telegram doesn't work due to TEE network restrictions:"
echo "   - The agent should still be trading autonomously"
echo "   - Check the dashboard for activity logs"
echo "   - Consider running a local Telegram bridge"
echo ""

echo "7. Quick Actions:"
echo "   Restart CVM: npx phala cvms restart $APP_ID"
echo "   Delete CVM:  npx phala cvms delete $APP_ID -y"
echo "   Redeploy:    ./deploy-phala.sh"
echo ""