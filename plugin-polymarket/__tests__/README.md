# Polymarket Plugin Test Suite

## Test Framework: Bun Test

This test suite uses **Bun's built-in test framework** instead of Vitest. All test files have been migrated to use Bun's testing utilities.

## Migration from Vitest to Bun Test (Completed)

### Key Changes Made

#### 1. Import Statements
**Before (Vitest):**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
```

**After (Bun):**
```typescript
import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
```

#### 2. Mock Setup
**Before (Vitest):**
```typescript
vi.mock('../../../../src/utils/clobClient');
vi.mock('../../../../src/utils/llmHelpers');
```

**After (Bun):**
```typescript
// Create mock functions first
const mockInitializeClobClient = mock();
const mockCallLLMWithTimeout = mock();

// Then setup module mocks
mock.module('../../../../src/utils/clobClient', () => ({
  initializeClobClient: mockInitializeClobClient,
}));

mock.module('../../../../src/utils/llmHelpers', () => ({
  callLLMWithTimeout: mockCallLLMWithTimeout,
}));

// Import the module under test AFTER setting up mocks
import { explainMarketAction } from '../../../../src/actions/explainMarket';
```

#### 3. Mock Functions
**Before (Vitest):**
```typescript
const mockFunction = vi.fn();
vi.mocked(someFunction).mockReturnValue('value');
```

**After (Bun):**
```typescript
const mockFunction = mock();
(someFunction as any).mockReturnValue('value');
```

#### 4. Mock Lifecycle
**Before (Vitest):**
```typescript
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
```

**After (Bun):**
```typescript
beforeEach(() => {
  mockFunction.mockClear();
  // Clear each mock individually
});

afterEach(() => {
  mockFunction.mockReset();
  // Reset each mock individually
});
```

## Running Tests

### Basic Commands
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- plugin-polymarket/__tests__/unit/actions/market-data/explainMarket.test.ts

# Run tests matching a pattern
npm test -- plugin-polymarket/__tests__/unit/actions/
```

### Test Configuration
Test configuration is defined in `bunfig.toml`:
```toml
[test]
timeout = 60000
coverage = true

[test.env]
NODE_ENV = "test"
```

## Test Structure

```
plugin-polymarket/__tests__/
├── README.md                     # This file
├── COVERAGE_ANALYSIS.txt         # Detailed coverage analysis and testing strategy
├── unit/                         # Unit tests
│   └── actions/
│       ├── market-data/          # Market data action tests
│       │   ├── explainMarket.test.ts
│       │   ├── getOrderBookSummary.test.ts
│       │   ├── getPriceHistory.test.ts
│       │   ├── getSamplingMarkets.test.ts
│       │   ├── searchMarkets.test.ts
│       │   └── syncMarkets.test.ts
│       ├── portfolio/            # Portfolio action tests
│       │   ├── getPortfolioPositions.test.ts
│       │   └── getWalletBalance.test.ts
│       ├── trading/              # Trading action tests
│       │   ├── placeOrder.test.ts
│       │   └── sellOrder.test.ts
│       └── setup/                # Setup action tests
│           └── approveUSDC.test.ts
├── integration/                  # Integration tests
│   └── (to be created)
└── e2e/                         # End-to-end tests
    └── trading-workflow.test.ts

```

## Coverage Goals

Based on the COVERAGE_ANALYSIS.txt file:

### Priority 1: Critical Actions (Target: >90% coverage)
- **Trading Actions**: placeOrder, sellOrder, redeemWinnings
- **Portfolio Management**: getPortfolioPositions, getWalletBalance
- **Market Discovery**: searchMarkets, explainMarket

### Priority 2: Supporting Actions (Target: 70-80% coverage)
- **Market Data**: getMarketPrice, getOrderBookSummary, getPriceHistory
- **Setup/Configuration**: approveUSDC, setupTrading

### Priority 3: Nice-to-Have (Target: 50-60% coverage)
- showFavoriteMarkets, syncMarkets, getDepositAddress, etc.

## Current Test Status

### ✅ Converted to Bun Test
All test files have been successfully converted from Vitest to Bun's testing framework:

1. `explainMarket.test.ts` - Market explanation tests
2. `getOrderBookSummary.test.ts` - Order book retrieval tests
3. `getPriceHistory.test.ts` - Price history tests
4. `getSamplingMarkets.test.ts` - Market sampling tests
5. `syncMarkets.test.ts` - Market synchronization tests
6. `getPortfolioPositions.test.ts` - Portfolio position tests

### Known Issues

Some tests are currently failing due to:
1. **Action Behavior Mismatch**: Actions return error Content objects instead of throwing exceptions
2. **Property Name Differences**: Some action names and properties differ from test expectations
3. **Mock Setup**: Some mocks need adjustment to match actual API calls

These are not framework conversion issues but test logic issues that need to be addressed.

## Writing New Tests

When writing new tests with Bun:

### Example Test Template
```typescript
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { IAgentRuntime, Memory, State } from '@elizaos/core';

// Setup mocks BEFORE imports
const mockFunction = mock();
mock.module('path/to/module', () => ({
  exportedFunction: mockFunction,
}));

// Import after mocks
import { actionToTest } from '../src/actions/actionToTest';

describe('actionToTest', () => {
  let mockRuntime: IAgentRuntime;
  let mockMessage: Memory;
  let mockState: State;

  beforeEach(() => {
    // Clear mocks
    mockFunction.mockClear();
    
    // Setup test data
    mockRuntime = {
      getSetting: mock(),
    } as unknown as IAgentRuntime;
    
    // ... setup other mocks
  });

  it('should handle success case', async () => {
    mockFunction.mockResolvedValue({ success: true });
    
    const result = await actionToTest.handler(mockRuntime, mockMessage, mockState);
    
    expect(result).toBeDefined();
    expect(mockFunction).toHaveBeenCalledTimes(1);
  });

  it('should handle error case', async () => {
    mockFunction.mockRejectedValue(new Error('Test error'));
    
    // Note: Many actions return error Content instead of throwing
    const result = await actionToTest.handler(mockRuntime, mockMessage, mockState);
    
    expect(result.text).toContain('Error');
  });
});
```

## Best Practices

1. **Mock Module Order**: Always set up `mock.module()` calls BEFORE importing the module under test
2. **Individual Mock Management**: Clear/reset mocks individually in lifecycle hooks
3. **Type Assertions**: Use `as any` for mock type assertions when needed
4. **Error Handling**: Remember that many actions return error Content objects instead of throwing
5. **Async Testing**: Always use `async/await` for asynchronous tests
6. **Mock Data**: Create realistic mock data that matches actual API responses

## Troubleshooting

### Common Issues and Solutions

1. **"vi is not defined" error**
   - Solution: Replace all `vi` references with Bun's `mock` function

2. **Module not mocked properly**
   - Solution: Ensure `mock.module()` is called BEFORE importing the module

3. **Mock not resetting between tests**
   - Solution: Call `mockFunction.mockClear()` in `beforeEach()`

4. **Type errors with mocks**
   - Solution: Use type casting `(mockFunction as any).mockReturnValue(...)`

5. **Tests timing out**
   - Solution: Check async operations and ensure promises resolve/reject
   - Timeout is configured to 60000ms in bunfig.toml

## Contributing

When adding new tests:
1. Follow the Bun test patterns established in existing tests
2. Maintain the folder structure
3. Update coverage goals in COVERAGE_ANALYSIS.txt
4. Ensure critical money-handling paths have >90% coverage
5. Add both success and error cases for each action

## Resources

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [Bun Mock API](https://bun.sh/docs/test/mocks)
- [Migration Guide from Vitest](https://bun.sh/guides/test/migrate-from-vitest)