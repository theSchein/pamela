# Pamela Trading Guide

## 🚀 Ready to Trade!

Your Pamela agent is fully configured and ready for order execution. Here's how to test and use the trading features.

### ✅ Current Status

**Wallet**: `0x93c7c3f9394dEf62D2Ad0658c1c9b49919C13Ac5`
**USDC Balance**: `$3.975316` ✅
**MATIC Balance**: `0.0 MATIC` ⚠️ **NEEDS GAS**

### 🔧 Setup Required

**Add MATIC for Gas Fees:**
1. Send `0.01 MATIC` to: `0x93c7c3f9394dEf62D2Ad0658c1c9b49919C13Ac5`
2. You can get MATIC from:
   - Polygon faucet (for testnet)
   - Centralized exchange (Coinbase, Binance)
   - Bridge from Ethereum

### 🎯 Test Trading Commands

Once you have MATIC, try these commands with your agent:

#### 1. Check Balance
```
"What's my wallet balance?"
"Show me my trading limits"
"How much USDC do I have?"
```

#### 2. Browse Markets
```
"Show me open markets"
"What markets are available for trading?"
"Find markets about NFL"
```

#### 3. Get Market Details
```
"Tell me about the Chiefs vs Raiders market"
"What's the price for Chiefs winning?"
```

#### 4. Place Test Order
```
"Buy 1 share of YES in token 14270523446080509320829200481895961480205553513304203367521919818541658424782 at $0.10"
```

### 🛡️ Safety Features Active

**Balance Verification**: ✅ Orders check USDC balance before execution
**Position Limits**: ✅ Max $100 per trade (configurable)
**Market Validation**: ✅ Verifies token IDs exist and markets are active
**Error Handling**: ✅ Clear error messages and guidance

### 📊 Available Actions

1. **`getWalletBalance`** - Check USDC balance and trading limits
2. **`getPopularMarkets`** - Browse active prediction markets
3. **`getEnhancedMarketInfo`** - Get detailed market information
4. **`placeOrder`** - Execute buy/sell orders with safety checks

### 🧪 Testing Workflow

1. **Start Agent**: `bun run start` or `npm start`
2. **Check Balance**: "What's my wallet balance?"
3. **Browse Markets**: "Show me open markets"
4. **Place Small Order**: "Buy 1 share of YES in token [ID] at $0.10"
5. **Monitor Order**: Check agent response for order status

### 🔍 Current Test Market

**Market**: "NFL Saturday: Chiefs vs. Raiders"
**Market ID**: `0x9deb0baac40648821f96f01339229a422e2f5c877de55dc4dbf981f95a1e709c`

**Tokens:**
- **YES Token**: `14270523446080509320829200481895961480205553513304203367521919818541658424782`
- **NO Token**: `93110170397161149119544349457822484949376809039410140245101963942162463626903`

**Test Command:**
```
"Buy 1 share of YES in token 14270523446080509320829200481895961480205553513304203367521919818541658424782 at $0.10"
```

### 📋 Expected Order Flow

1. **User Request**: "Buy 1 share at $0.10"
2. **Balance Check**: Agent verifies $3.98 USDC available ✅
3. **Position Limit**: $0.10 order under $100 limit ✅
4. **Market Validation**: Token ID validated ✅
5. **Order Creation**: CLOB client creates signed order
6. **Order Submission**: Order posted to Polymarket
7. **Confirmation**: Agent reports order status and ID

### 🚨 Troubleshooting

**Common Issues:**

1. **"Invalid private key"** - Fixed ✅
2. **"Insufficient balance"** - Check USDC balance
3. **"No gas for transaction"** - Add MATIC to wallet
4. **"Token not found"** - Use valid token ID from market data
5. **"Order failed"** - Check market is active and has liquidity

### 🎉 Success Indicators

- ✅ Agent starts without errors
- ✅ Balance checking works
- ✅ Markets display correctly
- ✅ Orders execute successfully
- ✅ Order status reported

### 💡 Pro Tips

1. **Start Small**: Test with $0.10 orders first
2. **Check Prices**: Use market data to set competitive prices  
3. **Monitor Orders**: Check order book for execution
4. **Track Positions**: Keep record of open positions
5. **Set Limits**: Configure MAX_POSITION_SIZE for safety

---

**Once you add MATIC for gas, you'll be ready to execute your first autonomous prediction market trade!** 🚀