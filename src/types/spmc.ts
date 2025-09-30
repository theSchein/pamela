/**
 * TypeScript interfaces for SPMC API responses and data structures
 */

export interface SPMCMarket {
    id: string;
    title: string;
    description?: string;
    outcome?: 'YES' | 'NO';
    probability?: number;
    volume?: number;
    liquidity?: number;
    createdAt?: string;
    endDate?: string;
}

export interface SPMCIndexMember {
    marketId: string;
    weight: number;
    market?: SPMCMarket;
}

export interface SPMCIndex {
    id: string;
    name: string;
    description?: string;
    members: SPMCIndexMember[];
    lastUpdated?: string;
    totalWeight?: number;
}

export interface SPMCIndexResponse {
    success: boolean;
    index?: SPMCIndex;
    error?: string;
    message?: string;
}

export interface SPMCAllocation {
    marketId: string;
    targetWeight: number;
    currentWeight?: number;
    targetAmount: number;
    currentAmount?: number;
    delta: number;
    action: 'BUY' | 'SELL' | 'HOLD';
}

export interface SPMCRebalanceRequest {
    indexId: string;
    totalBalance: number;
    currentPositions: Map<string, number>;
    minPositionSize?: number;
    maxSlippage?: number;
}

export interface SPMCRebalanceResponse {
    success: boolean;
    allocations?: SPMCAllocation[];
    error?: string;
    totalValue?: number;
    rebalanceRequired?: boolean;
}