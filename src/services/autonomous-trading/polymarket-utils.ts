/**
 * Polymarket Utility Wrappers
 * 
 * This module provides utility functions that wrap the Polymarket plugin actions
 * to maintain compatibility with the autonomous trading service.
 */

import { IAgentRuntime, Memory, State, HandlerCallback, Content, stringToUuid } from "@elizaos/core";
import { getWalletBalanceAction, depositUSDCAction } from "@theschein/plugin-polymarket";

/**
 * Check Polymarket balance using the getWalletBalance action
 */
export async function checkPolymarketBalance(
  runtime: IAgentRuntime,
  requiredAmount: string = "0"
): Promise<{ hasEnoughBalance: boolean; usdcBalance: string; error?: string }> {
  try {
    // Create a mock message and state for the action
    const userId = stringToUuid("user-" + Date.now());
    const roomId = stringToUuid("room-" + Date.now());
    const mockMessage: Memory = {
      id: stringToUuid("msg-" + Date.now()),
      agentId: runtime.agentId,
      roomId: roomId,
      content: { text: "check balance", source: "internal" },
      createdAt: Date.now(),
    } as Memory;

    const mockState: State = {
      agentId: runtime.agentId,
      userId: userId,
      roomId: roomId,
      text: "check balance",
      values: {},
      data: {}
    } as State;

    // Create a promise to capture the callback result
    const result = await new Promise<string>((resolve, reject) => {
      const callback: HandlerCallback = async (response: Content): Promise<Memory[]> => {
        if (response.error) {
          reject(new Error(response.error as string));
        } else {
          resolve(response.text || "");
        }
        return [];
      };

      // Execute the action
      getWalletBalanceAction.handler(mockMessage, runtime, mockState, {}, callback);
    });

    // Parse the balance from the response text
    const balanceMatch = result.match(/\$?([\d,]+\.?\d*)\s*USDC/i);
    const balance = balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, "")) : 0;
    const required = parseFloat(requiredAmount);

    return {
      hasEnoughBalance: balance >= required,
      usdcBalance: balance.toString(),
    };
  } catch (error) {
    return {
      hasEnoughBalance: false,
      usdcBalance: "0",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Deposit USDC to Polymarket L2 using the depositUSDC action
 */
export async function depositUSDC(
  runtime: IAgentRuntime,
  amount: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    // Create a mock message for the deposit action
    const userId = stringToUuid("user-" + Date.now());
    const roomId = stringToUuid("room-" + Date.now());
    const mockMessage: Memory = {
      id: stringToUuid("msg-" + Date.now()),
      agentId: runtime.agentId,
      roomId: roomId,
      content: { 
        text: `deposit ${amount} USDC to polymarket`,
        source: "internal" 
      },
      createdAt: Date.now(),
    } as Memory;

    const mockState: State = {
      agentId: runtime.agentId,
      userId: userId,
      roomId: roomId,
      text: `deposit ${amount} USDC to polymarket`,
      values: {},
      data: {}
    } as State;

    // Create a promise to capture the callback result
    const result = await new Promise<string>((resolve, reject) => {
      const callback: HandlerCallback = async (response: Content): Promise<Memory[]> => {
        if (response.error) {
          reject(new Error(response.error as string));
        } else {
          resolve(response.text || "");
        }
        return [];
      };

      // Execute the action
      depositUSDCAction.handler(mockMessage, runtime, mockState, {}, callback);
    });

    // Parse transaction hash from the response
    const txHashMatch = result.match(/0x[a-fA-F0-9]{64}/);
    
    return {
      success: true,
      txHash: txHashMatch ? txHashMatch[0] : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}