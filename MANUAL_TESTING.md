# Manual Agent Testing Guide

## Current Status ✅

**SUCCESS**: Pamela trading agent is running successfully with:
- Polymarket plugin fully loaded
- CLOB client connected to wallet: `0x516F82432606705cEf5fA86dD4Ff79DDe6b082C0`
- Market sync service active and fetching markets
- Web UI available for testing

## Manual Testing Workflow

### Step 1: Access Web UI
- Open your browser to: http://localhost:3000
- You should see the Pamela agent interface

### Step 2: Test Trading Workflow

**Goal**: Test the complete user conversation → trading workflow

#### Phase 1: Market Discovery
1. **User**: "Show me some active prediction markets I can trade on"
2. **Expected**: Agent shows current Polymarket markets with details
3. **Actions that should trigger**: 
   - `GET_SAMPLING_MARKETS` or `RETRIEVE_ALL_MARKETS`
   - Market data display with prices, liquidity

#### Phase 2: Trading Decision  
1. **User**: "Pick an interesting market and buy $5 worth of shares based on your analysis"
2. **Expected**: Agent analyzes markets and places a buy order
3. **Actions that should trigger**:
   - `GET_MARKET_PRICE` for price discovery
   - `DIRECT_PLACE_ORDER` or `PLACE_ORDER` for execution
   - Order confirmation with details

#### Phase 3: Portfolio Check
1. **User**: "Show me my current portfolio and positions"  
2. **Expected**: Agent displays current holdings and positions
3. **Actions that should trigger**:
   - `GET_PORTFOLIO_POSITIONS`
   - `GET_WALLET_BALANCE` 
   - Portfolio summary with values

#### Phase 4: Selling
1. **User**: "Sell one of my positions - pick whichever looks best to sell"
2. **Expected**: Agent analyzes portfolio and executes sell order
3. **Actions that should trigger**:
   - Portfolio analysis
   - `DIRECT_SELL_ORDER` or `SELL_ORDER`
   - Sell confirmation with proceeds

## Testing Results

### ✅ What's Working
- Agent startup and initialization
- Polymarket plugin loading
- CLOB client connection
- Market sync service
- Database migrations
- Web UI availability

### 🔄 Next Testing Steps
1. Access web UI and test conversation flow
2. Verify natural language → action conversion
3. Test each trading action in sequence
4. Confirm error handling and edge cases
5. Validate complete workflow end-to-end

## Key Features to Validate

### Action Discovery
- Agent should recognize trading requests in natural language  
- Should trigger appropriate Polymarket actions automatically
- Should provide clear feedback on what actions are being taken

### Trading Functionality
- Market data retrieval and display
- Price discovery and orderbook analysis  
- Order placement with proper parameters
- Portfolio tracking and position management
- Sell order execution with profit/loss calculation

### Error Handling
- Invalid requests handled gracefully
- API failures communicated clearly
- Insufficient balance scenarios
- Market unavailable conditions

## Troubleshooting

If issues arise during testing:

1. **Check logs** in the console for detailed error messages
2. **Verify credentials** - wallet private key and API access
3. **Check market availability** - some markets may be closed
4. **Validate order parameters** - minimum sizes, price ranges
5. **Monitor gas and balance** - ensure sufficient USDC for trading

## Expected Agent Behavior

Pamela should:
- Be conversational and explain her trading decisions
- Show market analysis and reasoning
- Provide clear order confirmations
- Display portfolio changes after trades
- Handle errors gracefully with helpful messages
- Maintain context across the conversation

The agent is **READY FOR TESTING** - proceed with manual workflow validation through the web UI.