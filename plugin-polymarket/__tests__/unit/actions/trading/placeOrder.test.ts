import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { placeOrderAction } from '../../../../src/actions/placeOrder';
import { OrderSide, OrderType } from '../../../../src/types';
import type { IAgentRuntime, Memory, State, Content } from '@elizaos/core';
import * as llmHelpers from '../../../../src/utils/llmHelpers';
import * as clobClient from '../../../../src/utils/clobClient';
import * as balanceChecker from '../../../../src/utils/balanceChecker';

// Mock all dependencies
vi.mock('../../../../src/utils/llmHelpers', () => ({
  callLLMWithTimeout: vi.fn(),
}));

vi.mock('../../../../src/utils/clobClient', () => ({
  initializeClobClient: vi.fn(),
}));

vi.mock('../../../../src/utils/balanceChecker', () => ({
  checkPolymarketBalance: vi.fn(),
  checkUSDCBalance: vi.fn(),
  formatBalanceInfo: vi.fn(),
  getMaxPositionSize: vi.fn(),
}));

describe('placeOrderAction', () => {
  let mockRuntime: IAgentRuntime;
  let mockMessage: Memory;
  let mockState: State;
  let mockCallback: any;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRuntime = {
      getSetting: vi.fn((key: string) => {
        const settings: Record<string, string> = {
          CLOB_API_URL: 'https://clob.polymarket.com',
          WALLET_PRIVATE_KEY: '0x' + '0'.repeat(64),
          MAX_POSITION_SIZE: '100',
          MIN_CONFIDENCE_THRESHOLD: '0.7',
        };
        return settings[key];
      }),
    } as any;

    mockMessage = {
      content: {
        text: 'Buy 100 shares of token 123456 at $0.50 limit order',
      },
    } as Memory;

    mockState = {} as State;
    mockCallback = vi.fn();

    mockClient = {
      createOrder: vi.fn(),
      postOrder: vi.fn(),
    };

    vi.mocked(clobClient.initializeClobClient).mockResolvedValue(mockClient);
    
    // Default balance mock - has enough balance
    vi.mocked(balanceChecker.checkPolymarketBalance).mockResolvedValue({
      address: '0x1234567890123456789012345678901234567890',
      usdcBalance: '1000.00',
      usdcBalanceRaw: '1000000000',
      hasEnoughBalance: true,
      requiredAmount: '50.00',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Action Properties', () => {
    it('should have correct name and similes', () => {
      expect(placeOrderAction.name).toBe('PLACE_ORDER');
      expect(placeOrderAction.similes).toContain('CREATE_ORDER');
      expect(placeOrderAction.similes).toContain('BUY_TOKEN');
      expect(placeOrderAction.similes).toContain('SELL_TOKEN');
      expect(placeOrderAction.similes).toContain('LIMIT_ORDER');
      expect(placeOrderAction.similes).toContain('MARKET_ORDER');
    });

    it('should have proper description', () => {
      expect(placeOrderAction.description).toBe(
        'Create and place limit or market orders on Polymarket'
      );
    });

    it('should have examples', () => {
      expect(placeOrderAction.examples).toBeDefined();
      expect(placeOrderAction.examples?.length).toBeGreaterThan(0);
    });
  });

  describe('Validation', () => {
    it('should validate successfully with CLOB_API_URL', async () => {
      const result = await placeOrderAction.validate(mockRuntime, mockMessage, mockState);
      expect(result).toBe(true);
    });

    it('should fail validation without CLOB_API_URL', async () => {
      mockRuntime.getSetting = vi.fn(() => undefined);
      const result = await placeOrderAction.validate(mockRuntime, mockMessage, mockState);
      expect(result).toBe(false);
    });

    it('should validate with alternative CLOB_API_URL settings', async () => {
      mockRuntime.getSetting = vi.fn((key: string) => {
        if (key === 'POLYMARKET_CLOB_API_URL') return 'https://clob.polymarket.com';
        return undefined;
      });
      const result = await placeOrderAction.validate(mockRuntime, mockMessage, mockState);
      expect(result).toBe(true);
    });
  });

  describe('Successful Order Placement', () => {
    beforeEach(() => {
      vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
        tokenId: '123456',
        side: 'BUY',
        price: 0.5,
        size: 100,
        orderType: 'GTC',
        feeRateBps: '0',
      });

      mockClient.createOrder.mockResolvedValue({
        salt: 123456,
        maker: '0x1234567890123456789012345678901234567890',
        signer: '0x1234567890123456789012345678901234567890',
        taker: '0x0987654321098765432109876543210987654321',
        tokenId: '123456',
        makerAmount: '50',
        takerAmount: '100',
        expiration: '1234567890',
        nonce: '1234567890',
        feeRateBps: '0',
        side: '0',
        signatureType: 0,
        signature: '0x1234567890abcdef',
      });

      mockClient.postOrder.mockResolvedValue({
        success: true,
        orderId: 'order_123',
        status: 'matched',
        orderHashes: ['0xabcdef123456'],
      });
    });

    it('should place a successful limit buy order', async () => {
      const result = await placeOrderAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      ) as Content;

      // Verify balance was checked
      expect(balanceChecker.checkPolymarketBalance).toHaveBeenCalledWith(
        mockRuntime,
        '50' // Total value of order
      );

      expect(mockClient.createOrder).toHaveBeenCalledWith({
        tokenId: '123456',
        side: OrderSide.BUY,
        price: 0.5,
        size: 100,
        feeRateBps: '0',
      });

      expect(mockClient.postOrder).toHaveBeenCalledWith(expect.any(Object), 'GTC');

      expect(result.text).toContain('Order Placed Successfully');
      expect(result.text).toContain('limit buy order');
      expect(result.text).toContain('**Token ID**: 123456');
      expect(result.text).toContain('**Price**: $0.5000');
      expect(result.text).toContain('**Size**: 100 shares');
      expect(result.data?.success).toBe(true);
    });

    it('should place a successful market sell order', async () => {
      vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
        tokenId: '789012',
        side: 'SELL',
        price: 0.75,
        size: 50,
        orderType: 'FOK',
        feeRateBps: '10',
      });

      const result = await placeOrderAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      ) as Content;

      expect(mockClient.createOrder).toHaveBeenCalledWith({
        tokenId: '789012',
        side: OrderSide.SELL,
        price: 0.75,
        size: 50,
        feeRateBps: '10',
      });

      expect(mockClient.postOrder).toHaveBeenCalledWith(expect.any(Object), 'FOK');

      expect(result.text).toContain('Order Placed Successfully');
      expect(result.text).toContain('market sell order');
    });

    it('should handle delayed order status', async () => {
      mockClient.postOrder.mockResolvedValue({
        success: true,
        orderId: 'order_456',
        status: 'delayed',
      });

      const result = await placeOrderAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      ) as Content;

      expect(result.text).toContain('subject to a matching delay');
    });

    it('should handle unmatched order status', async () => {
      mockClient.postOrder.mockResolvedValue({
        success: true,
        orderId: 'order_789',
        status: 'unmatched',
      });

      const result = await placeOrderAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      ) as Content;

      expect(result.text).toContain('waiting to be matched');
    });
  });

  describe('Balance Verification', () => {
    it('should reject order when insufficient balance', async () => {
      vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
        tokenId: '123456',
        side: 'BUY',
        price: 0.5,
        size: 1000, // Large order
        orderType: 'GTC',
      });

      vi.mocked(balanceChecker.checkPolymarketBalance).mockResolvedValue({
        address: '0x123',
        usdcBalance: '100.00',
        usdcBalanceRaw: '100000000',
        hasEnoughBalance: false,
        requiredAmount: '500.00',
      });

      const result = await placeOrderAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      ) as Content;

      expect(result.success).toBe(false);
      expect(result.text).toContain('Insufficient balance');
      expect(mockClient.createOrder).not.toHaveBeenCalled();
    });

    it('should handle balance check errors', async () => {
      vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
        tokenId: '123456',
        side: 'BUY',
        price: 0.5,
        size: 100,
        orderType: 'GTC',
      });

      vi.mocked(balanceChecker.checkPolymarketBalance).mockRejectedValue(
        new Error('Failed to verify wallet balance')
      );

      const result = await placeOrderAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      ) as Content;

      expect(result.success).toBe(false);
      expect(result.text).toContain('Failed to verify wallet balance');
    });

    it('should calculate correct total value with fees', async () => {
      vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
        tokenId: '123456',
        side: 'BUY',
        price: 0.5,
        size: 100,
        orderType: 'GTC',
        feeRateBps: '10', // 0.1% fee
      });

      mockClient.createOrder.mockResolvedValue({} as any);
      mockClient.postOrder.mockResolvedValue({
        success: true,
        orderId: 'order_with_fee',
      });

      await placeOrderAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      // Total value should be 50 * 1.001 = 50.05
      expect(balanceChecker.checkPolymarketBalance).toHaveBeenCalledWith(
        mockRuntime,
        '50.05'
      );
    });
  });

  describe('LLM Parameter Extraction', () => {
    it('should extract parameters successfully from LLM', async () => {
      vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
        tokenId: '999999',
        side: 'BUY',
        price: 0.25,
        size: 200,
        orderType: 'GTD',
        feeRateBps: '5',
      });

      mockClient.createOrder.mockResolvedValue({} as any);
      mockClient.postOrder.mockResolvedValue({
        success: true,
        orderId: 'order_999',
      });

      await placeOrderAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockClient.createOrder).toHaveBeenCalledWith({
        tokenId: '999999',
        side: OrderSide.BUY,
        price: 0.25,
        size: 200,
        feeRateBps: '5',
      });
    });

    it('should handle LLM extraction failure with regex fallback', async () => {
      vi.mocked(llmHelpers.callLLMWithTimeout).mockRejectedValue(new Error('LLM failed'));

      mockMessage.content!.text = 'Buy 75 tokens of 555555 at price $0.80';

      mockClient.createOrder.mockResolvedValue({} as any);
      mockClient.postOrder.mockResolvedValue({
        success: true,
        orderId: 'order_555',
      });

      await placeOrderAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockClient.createOrder).toHaveBeenCalledWith({
        tokenId: '555555',
        side: OrderSide.BUY,
        price: 0.8,
        size: 75,
        feeRateBps: '0',
      });
    });

    it('should handle LLM error response', async () => {
      vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
        error: 'Required parameters missing',
      });

      mockMessage.content!.text = 'Invalid order request';

      const result = await placeOrderAction.handler(
        mockRuntime, 
        mockMessage, 
        mockState, 
        {}, 
        mockCallback
      ) as Content;
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Required order parameters not found');
    });
  });

  describe('Parameter Validation and Defaults', () => {
    beforeEach(() => {
      mockClient.createOrder.mockResolvedValue({} as any);
      mockClient.postOrder.mockResolvedValue({
        success: true,
        orderId: 'test_order',
      });
    });

    it('should convert percentage price to decimal', async () => {
      vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
        tokenId: '123456',
        side: 'BUY',
        price: 75, // 75% should become 0.75
        size: 100,
        orderType: 'GTC',
      });

      await placeOrderAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockClient.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          price: 0.75,
        })
      );
    });

    it('should default invalid side to BUY', async () => {
      vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
        tokenId: '123456',
        side: 'INVALID',
        price: 0.5,
        size: 100,
      });

      await placeOrderAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockClient.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          side: OrderSide.BUY,
        })
      );
    });

    it('should default invalid order type to GTC', async () => {
      vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
        tokenId: '123456',
        side: 'BUY',
        price: 0.5,
        size: 100,
        orderType: 'INVALID',
      });

      await placeOrderAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockClient.postOrder).toHaveBeenCalledWith(expect.any(Object), 'GTC');
    });

    it('should map limit to GTC and market to FOK', async () => {
      vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
        tokenId: '123456',
        side: 'BUY',
        price: 0.5,
        size: 100,
        orderType: 'limit',
      });

      await placeOrderAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockClient.postOrder).toHaveBeenCalledWith(expect.any(Object), 'GTC');
    });

    it('should validate price boundaries', async () => {
      // Test price too low
      vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
        tokenId: '123456',
        side: 'BUY',
        price: -0.5, // Invalid negative price
        size: 100,
      });

      const result = await placeOrderAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      ) as Content;

      expect(result.success).toBe(false);
      expect(result.text).toContain('Invalid price');
    });

    it('should validate size boundaries', async () => {
      // Test size too low
      vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
        tokenId: '123456',
        side: 'BUY',
        price: 0.5,
        size: 0, // Invalid zero size
      });

      const result = await placeOrderAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      ) as Content;

      expect(result.success).toBe(false);
      expect(result.text).toContain('Invalid size');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing CLOB_API_URL configuration', async () => {
      mockRuntime.getSetting = vi.fn(() => undefined);

      const result = await placeOrderAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      ) as Content;

      expect(result.success).toBe(false);
      expect(result.error).toContain('CLOB_API_URL is required');
    });

    it('should handle failed order placement', async () => {
      vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
        tokenId: '123456',
        side: 'BUY',
        price: 0.5,
        size: 100,
      });

      mockClient.createOrder.mockResolvedValue({} as any);
      mockClient.postOrder.mockResolvedValue({
        success: false,
        errorMsg: 'Market closed',
      });

      const result = await placeOrderAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      ) as Content;

      expect(result.text).toContain('Order Placement Failed');
      expect(result.text).toContain('Market closed');
      expect(result.data?.success).toBe(false);
    });

    it('should handle client initialization error', async () => {
      vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
        tokenId: '123456',
        side: 'BUY',
        price: 0.5,
        size: 100,
      });

      vi.mocked(clobClient.initializeClobClient).mockRejectedValue(new Error('Client init failed'));

      const result = await placeOrderAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      ) as Content;

      expect(result.success).toBe(false);
      expect(result.text).toContain('Client init failed');
    });

    it('should handle order creation error', async () => {
      vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
        tokenId: '123456',
        side: 'BUY',
        price: 0.5,
        size: 100,
      });

      mockClient.createOrder.mockRejectedValue(new Error('Order creation failed'));

      const result = await placeOrderAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      ) as Content;

      expect(result.success).toBe(false);
      expect(result.text).toContain('Order creation failed');
    });

    it('should handle network errors gracefully', async () => {
      vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
        tokenId: '123456',
        side: 'BUY',
        price: 0.5,
        size: 100,
      });

      mockClient.createOrder.mockResolvedValue({} as any);
      mockClient.postOrder.mockRejectedValue(new Error('Network request failed'));

      const result = await placeOrderAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      ) as Content;

      expect(result.success).toBe(false);
      expect(result.text).toContain('Network request failed');
    });

    it('should handle timeout errors', async () => {
      vi.mocked(llmHelpers.callLLMWithTimeout).mockRejectedValue(new Error('Request timeout'));

      const result = await placeOrderAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      ) as Content;

      expect(result.success).toBe(false);
      expect(result.text).toContain('timeout');
    });
  });

  describe('Regex Fallback Extraction', () => {
    beforeEach(() => {
      vi.mocked(llmHelpers.callLLMWithTimeout).mockRejectedValue(new Error('LLM failed'));
      mockClient.createOrder.mockResolvedValue({} as any);
      mockClient.postOrder.mockResolvedValue({
        success: true,
        orderId: 'regex_order',
      });
    });

    it('should extract sell order from regex', async () => {
      mockMessage.content!.text = 'Sell 25 shares of token 777888 at $0.60';

      await placeOrderAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockClient.createOrder).toHaveBeenCalledWith({
        tokenId: '777888',
        side: OrderSide.SELL,
        price: 0.6,
        size: 25,
        feeRateBps: '0',
      });
    });

    it('should extract market order type from regex', async () => {
      mockMessage.content!.text = 'Place market order to buy 50 tokens of 111222 at $0.75';

      await placeOrderAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

      expect(mockClient.postOrder).toHaveBeenCalledWith(expect.any(Object), 'FOK');
    });

    it('should fail when required parameters are missing', async () => {
      mockMessage.content!.text = 'I want to trade something';

      const result = await placeOrderAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      ) as Content;

      expect(result.success).toBe(false);
      expect(result.text).toContain('Please provide valid order parameters');
    });

    it('should handle various text formats', async () => {
      const testCases = [
        {
          text: 'buy 100 of 0x123abc at 0.5',
          expected: { tokenId: '0x123abc', side: OrderSide.BUY, price: 0.5, size: 100 }
        },
        {
          text: 'sell 50 shares token 999888 price $0.75',
          expected: { tokenId: '999888', side: OrderSide.SELL, price: 0.75, size: 50 }
        },
        {
          text: 'purchase 200 tokens ID 555666 @ $0.25',
          expected: { tokenId: '555666', side: OrderSide.BUY, price: 0.25, size: 200 }
        }
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        mockMessage.content!.text = testCase.text;
        
        await placeOrderAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);
        
        expect(mockClient.createOrder).toHaveBeenCalledWith(
          expect.objectContaining({
            tokenId: testCase.expected.tokenId,
            side: testCase.expected.side,
            price: testCase.expected.price,
            size: testCase.expected.size,
          })
        );
      }
    });
  });

  describe('Response Formatting', () => {
    beforeEach(() => {
      vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
        tokenId: '123456',
        side: 'BUY',
        price: 0.5,
        size: 100,
        orderType: 'GTC',
        feeRateBps: '10',
      });

      mockClient.createOrder.mockResolvedValue({} as any);
    });

    it('should format successful response with all details', async () => {
      mockClient.postOrder.mockResolvedValue({
        success: true,
        orderId: 'order_123',
        status: 'matched',
        orderHashes: ['0xabcdef123456', '0x789012345678'],
      });

      const result = await placeOrderAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      ) as Content;

      expect(result.text).toContain('**Order ID**: order_123');
      expect(result.text).toContain('**Status**: matched');
      expect(result.text).toContain('**Transaction Hash(es)**: 0xabcdef123456, 0x789012345678');
      expect(result.text).toContain('immediately matched and executed');
      expect(result.text).toContain('**Total Value**: $50.0500'); // With fee
      expect(result.text).toContain('**Fee Rate**: 10 bps');
    });

    it('should include proper data structure in response', async () => {
      mockClient.postOrder.mockResolvedValue({
        success: true,
        orderId: 'order_456',
      });

      const result = await placeOrderAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      ) as Content;

      expect(result.data).toEqual({
        success: true,
        orderDetails: {
          tokenId: '123456',
          side: 'BUY',
          price: 0.5,
          size: 100,
          orderType: 'GTC',
          feeRateBps: '10',
          totalValue: '50.0500',
        },
        orderResponse: {
          success: true,
          orderId: 'order_456',
        },
        timestamp: expect.any(String),
      });
    });

    it('should format error responses properly', async () => {
      mockClient.createOrder.mockRejectedValue(new Error('Invalid signature'));

      const result = await placeOrderAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      ) as Content;

      expect(result.success).toBe(false);
      expect(result.text).toContain('Error');
      expect(result.text).toContain('Invalid signature');
      expect(result.data).toEqual({});
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small order sizes', async () => {
      vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
        tokenId: '123456',
        side: 'BUY',
        price: 0.01,
        size: 1,
        orderType: 'GTC',
      });

      mockClient.createOrder.mockResolvedValue({} as any);
      mockClient.postOrder.mockResolvedValue({
        success: true,
        orderId: 'small_order',
      });

      const result = await placeOrderAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      ) as Content;

      expect(result.success).toBe(true);
      expect(balanceChecker.checkPolymarketBalance).toHaveBeenCalledWith(
        mockRuntime,
        '0.01'
      );
    });

    it('should handle very large order sizes', async () => {
      vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
        tokenId: '123456',
        side: 'BUY',
        price: 0.99,
        size: 10000,
        orderType: 'GTC',
      });

      // Simulate having enough balance for large order
      vi.mocked(balanceChecker.checkPolymarketBalance).mockResolvedValue({
        address: '0x123',
        usdcBalance: '15000.00',
        usdcBalanceRaw: '15000000000',
        hasEnoughBalance: true,
        requiredAmount: '9900.00',
      });

      mockClient.createOrder.mockResolvedValue({} as any);
      mockClient.postOrder.mockResolvedValue({
        success: true,
        orderId: 'large_order',
      });

      const result = await placeOrderAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      ) as Content;

      expect(result.success).toBe(true);
      expect(result.text).toContain('10000 shares');
    });

    it('should handle prices at boundaries (0 and 1)', async () => {
      // Test price at 1 (100%)
      vi.mocked(llmHelpers.callLLMWithTimeout).mockResolvedValue({
        tokenId: '123456',
        side: 'BUY',
        price: 1.0,
        size: 100,
        orderType: 'GTC',
      });

      mockClient.createOrder.mockResolvedValue({} as any);
      mockClient.postOrder.mockResolvedValue({
        success: true,
        orderId: 'boundary_order',
      });

      const result = await placeOrderAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      ) as Content;

      expect(result.success).toBe(true);
      expect(mockClient.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          price: 1.0,
        })
      );
    });

    it('should handle missing message content', async () => {
      mockMessage.content = undefined as any;

      const result = await placeOrderAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      ) as Content;

      expect(result.success).toBe(false);
      expect(result.text).toContain('No message content');
    });

    it('should handle empty message text', async () => {
      mockMessage.content!.text = '';

      const result = await placeOrderAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      ) as Content;

      expect(result.success).toBe(false);
      expect(result.text).toContain('order parameters');
    });
  });
});