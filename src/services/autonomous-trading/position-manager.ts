/**
 * Position Manager Module
 * 
 * Tracks and manages the portfolio of open positions across Polymarket markets.
 * This module maintains an up-to-date view of all holdings and provides
 * portfolio analytics.
 * 
 * Capabilities:
 * - Load existing positions from wallet on startup
 * - Track positions by market condition ID
 * - Calculate total portfolio exposure
 * - Generate position summaries with P&L
 * - Prevent duplicate positions in the same market
 * - Refresh positions after trades
 * 
 * The position manager is crucial for risk management as it ensures we don't
 * exceed position limits and helps track overall portfolio performance.
 */

import { elizaLogger, IAgentRuntime, Memory, UUID, Content, HandlerCallback, State } from "@elizaos/core";
import { getPortfolioPositionsAction } from "../../../plugin-polymarket/src/actions/getPortfolioPositions.js";
import { PositionData } from "./types.js";

export class PositionManager {
  private runtime: IAgentRuntime;
  private openPositions: Map<string, PositionData> = new Map();

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
  }

  async loadExistingPositions(): Promise<void> {
    try {
      // Use the getPortfolioPositions action to load positions
      const message = {
        id: crypto.randomUUID() as UUID,
        userId: this.runtime.agentId as UUID,
        agentId: this.runtime.agentId as UUID,
        roomId: this.runtime.agentId as UUID,
        content: { text: "get my positions" },
        createdAt: Date.now(),
        entityId: null,
      } as unknown as Memory;

      const callback: HandlerCallback = async (content: Content) => {
        const data = content as any;
        if (data?.data?.positions) {
          this.openPositions.clear();
          data.data.positions.forEach((pos: any) => {
            const positionData: PositionData = {
              marketConditionId: pos.marketConditionId,
              tokenId: pos.tokenId,
              outcome: pos.outcome,
              size: pos.size,
              avgPrice: pos.avgPrice,
              currentPrice: pos.currentPrice,
              pnl: pos.pnl,
            };
            this.openPositions.set(
              pos.marketConditionId || pos.tokenId,
              positionData
            );
          });
        }
        return [];
      };

      const state: State = {
        recentMessagesData: [
          {
            userId: this.runtime.agentId,
            username: "autonomous-trader",
            content: { text: "get my positions" },
          },
        ],
        values: {},
        data: {},
        text: "get my positions",
      } as State;

      await getPortfolioPositionsAction.handler(
        this.runtime,
        message,
        state,
        undefined,
        callback
      );

      elizaLogger.info(
        `Loaded ${this.openPositions.size} open positions from wallet`
      );
    } catch (error) {
      elizaLogger.error("Failed to load existing positions: " + error);
    }
  }

  getOpenPositions(): Map<string, PositionData> {
    return this.openPositions;
  }

  hasPosition(marketId: string): boolean {
    return this.openPositions.has(marketId);
  }

  getPositionCount(): number {
    return this.openPositions.size;
  }

  async refreshPositions(): Promise<void> {
    await this.loadExistingPositions();
  }

  getPosition(marketId: string): PositionData | undefined {
    return this.openPositions.get(marketId);
  }

  calculateTotalExposure(): number {
    let totalExposure = 0;
    this.openPositions.forEach((position) => {
      totalExposure += position.size * position.avgPrice;
    });
    return totalExposure;
  }

  getPositionSummary(): string {
    const positions = Array.from(this.openPositions.values());
    const totalExposure = this.calculateTotalExposure();
    const totalPnL = positions.reduce((sum, pos) => sum + (pos.pnl || 0), 0);

    return `
📊 Position Summary:
- Open Positions: ${this.openPositions.size}
- Total Exposure: $${totalExposure.toFixed(2)}
- Total P&L: ${totalPnL >= 0 ? "+" : ""}$${totalPnL.toFixed(2)}
    `.trim();
  }
}