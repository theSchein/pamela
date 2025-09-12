declare module "@theschein/plugin-polymarket" {
  import { IPlugin, IAction } from "@elizaos/core";
  import { ClobClient } from "@polymarket/clob-client";
  
  export const polymarketPlugin: IPlugin;
  export default polymarketPlugin;
  
  // Actions
  export const approveUSDCAction: IAction;
  export const depositUSDCAction: IAction;
  export const explainMarketAction: IAction;
  export const getAccountAccessStatusAction: IAction;
  export const getDepositAddressAction: IAction;
  export const getMarketPriceAction: IAction;
  export const getOrderBookSummaryAction: IAction;
  export const getPortfolioPositionsAction: IAction;
  export const getWalletBalanceAction: IAction;
  export const placeOrderAction: IAction;
  export const redeemWinningsAction: IAction;
  export const searchMarketsAction: IAction;
  export const sellOrderAction: IAction;
  export const setupTradingAction: IAction;
  export const syncMarketsAction: IAction;
  
  // Utilities
  export function initializeClobClient(runtime: any): Promise<ClobClient>;
  export function initializeReadOnlyClobClient(runtime: any): Promise<ClobClient>;
  
  // Services
  export class MarketDetailService {
    constructor(runtime: any);
    start(): Promise<void>;
    stop(): Promise<void>;
  }
  
  export class PolymarketService {
    constructor(runtime: any);
    start(): Promise<void>;
    stop(): Promise<void>;
  }
  
  // Other exports
  export const callLLMWithTimeout: any;
  export const character: any;
  export const project: any;
  export const projectAgent: any;
}