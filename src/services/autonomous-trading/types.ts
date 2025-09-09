/**
 * Type Definitions for Autonomous Trading Service
 * 
 * This file contains all shared TypeScript interfaces and types used across
 * the autonomous trading service modules. These types ensure type safety
 * and consistency across the different components.
 */

export interface MarketOpportunity {
  marketId: string;
  question: string;
  outcome: "YES" | "NO";
  currentPrice: number;
  predictedProbability: number;
  confidence: number;
  expectedValue: number;
  newsSignals: string[];
  riskScore: number;
}

export interface TradingDecision {
  shouldTrade: boolean;
  marketId: string;
  outcome: "YES" | "NO";
  size: number;
  price: number;
  confidence: number;
  reasoning: string;
}

export interface BalanceInfo {
  hasEnoughBalance: boolean;
  usdcBalance: string;
  error?: string;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
  transactionHash?: string;
}

export interface MarketData {
  id: string;
  conditionId: string;
  question: string;
  active: boolean;
  outcomes: string;
  clobTokenIds: string;
  outcomePrices?: string;
  marketMakerData?: string;
  bestBid?: string;
  bestAsk?: string;
  volume?: number;
  endDate?: string;
}

export interface PositionData {
  marketConditionId?: string;
  tokenId?: string;
  outcome: string;
  size: number;
  avgPrice: number;
  currentPrice?: number;
  pnl?: number;
}

export interface DirectOrderParams {
  tokenId: string;
  side: "BUY" | "SELL";
  price: number;
  size: number;
  orderType?: string;
}