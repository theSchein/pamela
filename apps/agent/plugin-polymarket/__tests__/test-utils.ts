import { vi } from 'vitest';
import { Content, IAgentRuntime, Memory, State, logger } from '@elizaos/core';
import {
  createMockRuntime as createCoreMockRuntime,
  createMockMessage as createCoreMockMessage,
  createMockState as createCoreMockState,
  documentTestResult,
  runCoreActionTests,
} from './utils/core-test-utils';
import { character } from '../src/index';
import plugin from '../src/plugin';

/**
 * Creates an enhanced mock runtime for testing that includes the project's
 * character and plugin
 *
 * @param overrides - Optional overrides for the default mock methods and properties
 * @returns A mock runtime for testing
 */
export function createMockRuntime(overrides: Partial<IAgentRuntime> = {}): IAgentRuntime {
  // Create base mock runtime with default core utilities
  const baseRuntime = createCoreMockRuntime();

  // Enhance with project-specific configuration
  const mockRuntime = {
    ...baseRuntime,
    character: character,
    plugins: [plugin],
    registerPlugin: vi.fn(),
    initialize: vi.fn(),
    getService: vi.fn(),
    getSetting: vi.fn().mockReturnValue(null),
    useModel: vi.fn().mockRejectedValue(new Error('LLM calls disabled - use direct API actions')),
    getProviderResults: vi.fn().mockResolvedValue([]),
    evaluateProviders: vi.fn().mockResolvedValue([]),
    evaluate: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as IAgentRuntime;

  return mockRuntime;
}

/**
 * Creates a mock Message object for testing
 *
 * @param text - The message text
 * @param overrides - Optional overrides for the default memory properties
 * @returns A mock memory object
 */
export function createMockMessage(text: string, overrides: Partial<Memory> = {}): Memory {
  const baseMessage = createCoreMockMessage(text);
  return {
    ...baseMessage,
    ...overrides,
  };
}

/**
 * Creates a mock State object for testing
 *
 * @param overrides - Optional overrides for the default state properties
 * @returns A mock state object
 */
export function createMockState(overrides: Partial<State> = {}): State {
  const baseState = createCoreMockState();
  return {
    ...baseState,
    ...overrides,
  };
}

/**
 * Creates a standardized setup for testing with consistent mock objects
 *
 * @param overrides - Optional overrides for default mock implementations
 * @returns An object containing mockRuntime, mockMessage, mockState, and callbackFn
 */
export function setupTest(
  options: {
    messageText?: string;
    messageOverrides?: Partial<Memory>;
    runtimeOverrides?: Partial<IAgentRuntime>;
    stateOverrides?: Partial<State>;
  } = {}
) {
  // Create mock callback function
  const callbackFn = vi.fn();

  // Create a message
  const mockMessage = createMockMessage(
    options.messageText || 'Test message',
    options.messageOverrides || {}
  );

  // Create a state object
  const mockState = createMockState(options.stateOverrides || {});

  // Create a mock runtime
  const mockRuntime = createMockRuntime(options.runtimeOverrides || {});

  return {
    mockRuntime,
    mockMessage,
    mockState,
    callbackFn,
  };
}

// Export other utility functions
export { documentTestResult, runCoreActionTests };

// Add spy on logger for common usage in tests
export function setupLoggerSpies() {
  vi.spyOn(logger, 'info').mockImplementation(() => {});
  vi.spyOn(logger, 'error').mockImplementation(() => {});
  vi.spyOn(logger, 'warn').mockImplementation(() => {});
  vi.spyOn(logger, 'debug').mockImplementation(() => {});

  // allow tests to restore originals
  return () => vi.restoreAllMocks();
}

/**
 * Creates a real runtime for live testing (not mocked)
 * 
 * @param envOverrides - Environment variable overrides for testing
 * @returns A real runtime instance for live testing
 */
export async function createTestRuntime(envOverrides: Record<string, string> = {}): Promise<IAgentRuntime> {
  // This is a simplified implementation for live testing
  // In a real implementation, this would initialize the full ElizaOS runtime
  const testRuntime = {
    character,
    plugins: [plugin],
    databaseAdapter: null,
    tokenProvider: null,
    modelProvider: null,
    cacheManager: null,
    composeState: async () => ({}),
    updateRecentMessageState: async () => ({}),
    evaluate: async () => [],
    getProviderResults: async () => [],
    getSetting: (key: string) => {
      const value = envOverrides[key] || process.env[key] || null;
      console.log(`[test-utils] getSetting(${key}) = ${value ? 'FOUND' : 'NOT_FOUND'}`);
      return value;
    },
    setSetting: async (key: string, value: string) => {
      envOverrides[key] = value;
    },
    actions: [],
    providers: [],
    services: new Map(),
    registerPlugin: async () => {},
    initialize: async () => {},
    useModel: async (request: any) => {
      throw new Error('LLM disabled in test runtime - use directPlaceOrderAction instead');
    },
    getService: () => null,
  } as unknown as IAgentRuntime;

  return testRuntime;
}

/**
 * Creates a test memory object for live testing
 * 
 * @param options - Memory configuration options
 * @returns A memory object for testing
 */
export function createTestMemory(options: {
  content: { text: string };
  userId: string;
  roomId: string;
}): Memory {
  return {
    id: crypto.randomUUID() as `${string}-${string}-${string}-${string}-${string}`,
    userId: options.userId as `${string}-${string}-${string}-${string}-${string}`,
    agentId: crypto.randomUUID() as `${string}-${string}-${string}-${string}-${string}`,
    roomId: options.roomId as `${string}-${string}-${string}-${string}-${string}`,
    content: options.content,
    createdAt: Date.now(),
    embedding: new Float32Array(0),
    unique: true,
  };
}
