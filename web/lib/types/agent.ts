export interface AgentStatus {
  isRunning: boolean;
  lastHeartbeat: string;
  uptime: number;
  mode: 'supervised' | 'unsupervised';
  currentTask?: string;
}

export interface AgentMessage {
  id: string;
  timestamp: string;
  type: 'info' | 'trade' | 'error' | 'analysis';
  content: string;
  metadata?: Record<string, any>;
}

export interface AgentConfig {
  tradingEnabled: boolean;
  maxPositionSize: number;
  minConfidenceThreshold: number;
  unsupervisedMode: boolean;
  maxDailyTrades: number;
  maxOpenPositions: number;
  riskLimitPerTrade: number;
}