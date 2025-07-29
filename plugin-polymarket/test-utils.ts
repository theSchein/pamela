/**
 * Test utilities for Polymarket plugin testing
 * Provides mock runtime, memory, and helper functions
 */

import type { IAgentRuntime, Memory, State } from '@elizaos/core';

// Mock runtime for testing
export function createTestRuntime(settings: Record<string, string> = {}): IAgentRuntime {
  const defaultSettings = {
    CLOB_API_URL: 'https://clob.polymarket.com/',
    TRADING_ENABLED: 'true',
    MAX_POSITION_SIZE: '100',
    MIN_CONFIDENCE_THRESHOLD: '0.7',
    PGLITE_DATA_DIR: './test-db',
    ...settings
  };

  return {
    getSetting: (key: string) => defaultSettings[key] || '',
    setSetting: async (key: string, value: string) => {
      defaultSettings[key] = value;
    },
    databaseAdapter: {
      db: null as any,
    },
    character: {
      name: 'TestPamela',
      username: 'testpamela',
      plugins: [],
      clients: [],
      modelProvider: 'openai',
      settings: {
        secrets: {},
        voice: {},
        model: 'gpt-4',
        embeddingModel: 'text-embedding-3-small',
      },
      system: 'Test trading agent',
      bio: 'Test Pamela for trading',
      lore: [],
      messageExamples: [[]],
      postExamples: [],
      people: [],
      topics: [],
      adjectives: [],
      knowledge: [],
      clients: [],
      plugins: [],
      style: {
        all: [],
        chat: [],
        post: [],
      },
      twitterProfile: {
        username: 'testpamela',
        screenName: 'Test Pamela',
        bio: 'Test trading agent',
        nicknames: [],
      },
    },
    providers: [],
    actions: [],
    evaluators: [],
    getProvider: () => null,
    getAction: () => null,
    getEvaluator: () => null,
    registerAction: () => {},
    processActions: async () => ({ responseMessages: [], callback: null }),
    evaluate: async () => [],
    ensureConnection: async () => ({ userId: 'test', userName: 'test' }),
    composeState: async () => ({
      userId: 'test-user',
      agentId: 'test-agent', 
      bio: 'Test agent',
      lore: [],
      messageDirections: 'Test directions',
      postDirections: 'Test post directions',
      roomId: '00000000-0000-0000-0000-000000000000',
      actors: '',
      goals: 'Test goals',
      recentMessages: '',
      recentMessagesData: [],
      actionNames: '',
      actions: '',
      evaluatorNames: '',
      evaluators: '',
      providers: '',
    }),
    updateRecentMessageState: async () => ({
      userId: 'test-user',
      agentId: 'test-agent',
      bio: 'Test agent', 
      lore: [],
      messageDirections: 'Test directions',
      postDirections: 'Test post directions',
      roomId: '00000000-0000-0000-0000-000000000000',
      actors: '',
      goals: 'Test goals',
      recentMessages: '',
      recentMessagesData: [],
      actionNames: '',
      actions: '',
      evaluatorNames: '',
      evaluators: '',
      providers: '',
    }),
  } as unknown as IAgentRuntime;
}

// Create test memory object
export function createTestMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 'test-memory-' + Math.random().toString(36).substr(2, 9),
    userId: 'test-user',
    agentId: 'test-agent',
    roomId: '00000000-0000-0000-0000-000000000000',
    content: { text: 'Test message' },
    createdAt: Date.now(),
    embedding: null,
    unique: true,
    similarity: 1.0,
    ...overrides,
  } as Memory;
}

// Create test state object  
export function createTestState(overrides: Partial<State> = {}): State {
  return {
    userId: 'test-user',
    agentId: 'test-agent',
    bio: 'Test agent bio',
    lore: [],
    messageDirections: 'Test message directions', 
    postDirections: 'Test post directions',
    roomId: '00000000-0000-0000-0000-000000000000',
    actors: '',
    goals: 'Test goals',
    recentMessages: '',
    recentMessagesData: [],
    actionNames: '',
    actions: '',
    evaluatorNames: '',
    evaluators: '',
    providers: '',
    ...overrides,
  } as State;
}

// Test helper functions
export const testHelpers = {
  // Wait for async operations
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Check if test should run based on environment
  shouldRunLiveTests: () => process.env.LIVE_TESTING === 'true',
  
  // Get test configuration
  getTestConfig: () => ({
    SMALL_ORDER_SIZE: parseFloat(process.env.TEST_ORDER_SIZE || '1'),
    MAX_TIMEOUT: parseInt(process.env.TEST_TIMEOUT || '30000'),
    TEST_PRIVATE_KEY: process.env.POLYMARKET_PRIVATE_KEY || '0x' + '1'.repeat(64),
    CLOB_API_URL: process.env.CLOB_API_URL || 'https://clob.polymarket.com/',
  }),
  
  // Validate action result structure
  validateActionResult: (result: any) => {
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect(result).toHaveProperty('success');
    if (result.success === false) {
      expect(result).toHaveProperty('data');
    }
    return result;
  },
  
  // Extract numeric value from currency strings
  parseCurrency: (value: string): number => {
    return parseFloat(value.replace(/[$,]/g, ''));
  },
  
  // Format test output
  logTestResult: (testName: string, result: any, success: boolean = true) => {
    const status = success ? '✅' : '❌';
    console.log(`${status} ${testName}`);
    if (result?.data) {
      console.log(`   Data: ${JSON.stringify(result.data, null, 2)}`);
    }
  },
};

// Mock market data for testing
export const mockMarketData = {
  markets: [
    {
      id: 'test-market-1',
      question: 'Will Trump win the 2024 election?',
      tokens: [
        { token_id: 'test-token-yes-1', outcome: 'YES', price: 0.55 },
        { token_id: 'test-token-no-1', outcome: 'NO', price: 0.45 },
      ],
      active: true,
      volume: 1000000,
    },
    {
      id: 'test-market-2', 
      question: 'Will Bitcoin reach $100k in 2025?',
      tokens: [
        { token_id: 'test-token-yes-2', outcome: 'YES', price: 0.35 },
        { token_id: 'test-token-no-2', outcome: 'NO', price: 0.65 },
      ],
      active: true,
      volume: 500000,
    },
  ],
  
  orders: [
    {
      id: 'test-order-1',
      market: 'test-market-1',
      side: 'BUY',
      price: 0.50,
      size: 100,
      status: 'open',
    },
  ],
  
  balanceInfo: {
    address: '0x93c7c3f9394dEf62D2Ad0658c1c9b49919C13Ac5',
    usdcBalance: '50.00',
    hasEnoughBalance: true,
  },
};