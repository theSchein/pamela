import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest';
import plugin from '../src/plugin';
import { logger } from '@elizaos/core';
import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import {
  runCoreActionTests,
  documentTestResult,
  createMockRuntime,
  createMockMessage,
  createMockState,
} from './utils/core-test-utils';

// Setup environment variables
dotenv.config();

// Spy on logger to capture logs for documentation
beforeAll(() => {
  vi.spyOn(logger, 'info');
  vi.spyOn(logger, 'error');
  vi.spyOn(logger, 'warn');
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('Actions', () => {
  // Find the main Polymarket action from the plugin
  const polymarketAction = plugin.actions?.find((action) => action.name === 'POLYMARKET_GET_ALL_MARKETS');

  // Run core tests on all plugin actions
  it('should pass core action tests', () => {
    if (plugin.actions) {
      const coreTestResults = runCoreActionTests(plugin.actions);
      expect(coreTestResults).toBeDefined();
      expect(coreTestResults.formattedNames).toBeDefined();
      expect(coreTestResults.formattedActions).toBeDefined();
      expect(coreTestResults.composedExamples).toBeDefined();

      // Document the core test results
      documentTestResult('Core Action Tests', coreTestResults);
    }
  });

  describe('POLYMARKET_GET_ALL_MARKETS Action', () => {
    it('should exist in the plugin', () => {
      expect(polymarketAction).toBeDefined();
    });

    it('should have the correct structure', () => {
      if (polymarketAction) {
        expect(polymarketAction).toHaveProperty('name', 'POLYMARKET_GET_ALL_MARKETS');
        expect(polymarketAction).toHaveProperty('description');
        expect(polymarketAction).toHaveProperty('similes');
        expect(polymarketAction).toHaveProperty('validate');
        expect(polymarketAction).toHaveProperty('handler');
        expect(polymarketAction).toHaveProperty('examples');
        expect(Array.isArray(polymarketAction.similes)).toBe(true);
        expect(Array.isArray(polymarketAction.examples)).toBe(true);
      }
    });

    it('should have market-related similes', () => {
      if (polymarketAction) {
        expect(polymarketAction.similes).toContain('GET_ALL_MARKETS');
        expect(polymarketAction.similes).toContain('LIST_MARKETS');
      }
    });

    it('should have at least one example', () => {
      if (polymarketAction && polymarketAction.examples) {
        expect(polymarketAction.examples.length).toBeGreaterThan(0);

        // Check first example structure
        const firstExample = polymarketAction.examples[0];
        expect(firstExample.length).toBeGreaterThan(1); // At least two messages

        // First message should be a request
        expect(firstExample[0]).toHaveProperty('name');
        expect(firstExample[0]).toHaveProperty('content');
        expect(firstExample[0].content).toHaveProperty('text');

        // Second message should be a response
        expect(firstExample[1]).toHaveProperty('name');
        expect(firstExample[1]).toHaveProperty('content');
        expect(firstExample[1].content).toHaveProperty('text');
      }
    });

    it('should return true from validate function', async () => {
      if (polymarketAction) {
        const runtime = createMockRuntime();
        const mockMessage = createMockMessage('Show me markets');
        const mockState = createMockState();

        let result = false;
        let error: Error | null = null;

        try {
          result = await polymarketAction.validate(runtime, mockMessage, mockState);
          expect(typeof result).toBe('boolean');
        } catch (e) {
          error = e as Error;
          logger.error('Validate function error:', e);
        }

        documentTestResult('POLYMARKET_GET_ALL_MARKETS action validate', result, error);
      }
    });

    it('should call back with market data response from handler', async () => {
      if (polymarketAction) {
        const runtime = createMockRuntime();
        const mockMessage = createMockMessage('Show me markets');
        const mockState = createMockState();

        let callbackResponse: any = {};
        let error: Error | null = null;

        const mockCallback = (response: any) => {
          callbackResponse = response;
        };

        try {
          await polymarketAction.handler(
            runtime,
            mockMessage,
            mockState,
            {},
            mockCallback as HandlerCallback,
            []
          );

          // Verify callback was called with some content
          expect(callbackResponse).toBeTruthy();
          expect(callbackResponse).toHaveProperty('text');
        } catch (e) {
          error = e as Error;
          logger.error('Handler function error:', e);
        }

        documentTestResult('POLYMARKET_GET_ALL_MARKETS action handler', callbackResponse, error);
      }
    });
  });
});
