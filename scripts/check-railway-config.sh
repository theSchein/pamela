#!/bin/bash

# Check Railway configuration and environment variables

echo "🔍 Railway Configuration Check"
echo "=============================="
echo ""

# Check if logged in
echo "✅ Railway CLI Status:"
railway whoami || {
    echo "❌ Not logged in to Railway"
    echo "Run: railway login"
    exit 1
}
echo ""

# Check project status
echo "📋 Project Status:"
railway status || echo "No project linked"
echo ""

# Check variables
echo "🔐 Environment Variables:"
railway variables || echo "No variables set"
echo ""

# Check required variables
echo "📝 Variable Status:"
echo ""

check_var() {
    local var_name=$1
    local required=$2
    
    if railway variables | grep -q "$var_name"; then
        echo "✅ $var_name is set"
    else
        if [ "$required" = "required" ]; then
            echo "❌ $var_name is MISSING (Required)"
        else
            echo "⚠️  $var_name is not set (Optional)"
        fi
    fi
}

# Check all important variables
echo "Required Variables:"
check_var "OPENAI_API_KEY" "required"
check_var "DISCORD_API_TOKEN" "required"
check_var "WALLET_PRIVATE_KEY" "required"
echo ""

echo "Trading Configuration:"
check_var "POLYMARKET_PRIVATE_KEY" "optional"
check_var "PRIVATE_KEY" "optional"
check_var "CLOB_API_URL" "optional"
check_var "CLOB_API_KEY" "optional"
check_var "TRADING_ENABLED" "optional"
check_var "MAX_POSITION_SIZE" "optional"
check_var "MIN_CONFIDENCE_THRESHOLD" "optional"
echo ""

echo "System Configuration:"
check_var "NODE_ENV" "optional"
check_var "BUN_INSTALL" "optional"
check_var "PGLITE_DATA_DIR" "optional"
echo ""

# Show deployment URL if available
echo "🌐 Deployment Info:"
railway open --json 2>/dev/null | grep -o '"url":"[^"]*' | cut -d'"' -f4 || echo "No deployment URL available"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📚 Quick Commands:"
echo "  railway up                  # Deploy/Redeploy"
echo "  railway logs                # View logs"
echo "  railway open                # Open dashboard"
echo "  railway variables --set KEY=VALUE  # Set variable"
echo ""