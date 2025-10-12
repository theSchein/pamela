/**
 * API Server Types
 *
 * Type definitions for HTTP API endpoints
 */

export interface HealthResponse {
  status: "healthy" | "unhealthy";
  agent_id?: string;
  agent_name?: string;
  version?: string;
  uptime_seconds?: number;
  wallet_generated?: boolean;
  wallet_address?: string;
  telegram_connected?: boolean;
  last_trade?: string;
  git_tag?: string;
  git_commit?: string;
  error?: string;
}

export interface WalletResponse {
  wallet_address: string;
  generated_at: string;
  balance?: {
    matic?: string;
    usdc?: string;
  };
}

export interface WalletErrorResponse {
  error: string;
  status: "initializing" | "error";
}

export interface ApiServerConfig {
  port: number;
  version?: string;
  gitTag?: string;
  gitCommit?: string;
}
