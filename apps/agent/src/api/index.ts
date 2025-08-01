import { Plugin, type IAgentRuntime, logger } from "@elizaos/core";

// Simple API plugin with placeholder endpoints
export const apiPlugin: Plugin = {
  name: "api",
  description: "REST API endpoints for frontend communication",
  
  routes: [
    // Health check
    {
      path: "/api/health",
      type: "GET",
      handler: async (_req: any, res: any) => {
        res.json({
          success: true,
          status: "healthy",
          timestamp: new Date().toISOString(),
        });
      },
    },
    
    // Chat endpoint
    {
      path: "/api/chat",
      type: "POST",
      handler: async (req: any, res: any) => {
        const { message } = req.body;
        
        // Placeholder response
        res.json({
          success: true,
          data: {
            id: Date.now().toString(),
            role: "assistant",
            content: `I received your message: "${message}". The full Polymarket integration is being set up!`,
            timestamp: new Date(),
          },
        });
      },
    },
    
    // Portfolio endpoint
    {
      path: "/api/portfolio",
      type: "GET",
      handler: async (_req: any, res: any) => {
        // Placeholder portfolio data
        res.json({
          success: true,
          data: {
            totalValue: 1000.00,
            availableBalance: 500.00,
            totalPnl: -0.30,
            totalPnlPercent: -0.03,
            positions: [
              {
                id: "1",
                marketId: "placeholder-market-1",
                marketTitle: "Will BTC reach $100k by end of 2025?",
                outcome: "YES",
                shares: 10,
                avgPrice: 0.65,
                currentPrice: 0.72,
                value: 7.20,
                pnl: 0.70,
                pnlPercent: 10.77,
              },
              {
                id: "2",
                marketId: "placeholder-market-2",
                marketTitle: "Will ETH flip BTC market cap in 2025?",
                outcome: "NO",
                shares: 20,
                avgPrice: 0.80,
                currentPrice: 0.75,
                value: 15.00,
                pnl: -1.00,
                pnlPercent: -6.25,
              },
            ],
            stats: {
              totalTrades: 15,
              winRate: 0.67,
              avgReturn: 0.08,
            },
            openOrders: [],
          },
        });
      },
    },
    
    // Markets endpoint
    {
      path: "/api/markets",
      type: "GET",
      handler: async (_req: any, res: any) => {
        // Placeholder markets data
        res.json({
          success: true,
          data: [
            {
              id: "market-1",
              title: "Will BTC reach $100k by end of 2025?",
              endDate: "2025-12-31T23:59:59Z",
              volume: 2500000,
              liquidity: 500000,
              outcomes: [
                { id: "yes", name: "YES", price: 0.72 },
                { id: "no", name: "NO", price: 0.28 },
              ],
            },
            {
              id: "market-2",
              title: "Will ETH flip BTC market cap in 2025?",
              endDate: "2025-12-31T23:59:59Z",
              volume: 1500000,
              liquidity: 300000,
              outcomes: [
                { id: "yes", name: "YES", price: 0.25 },
                { id: "no", name: "NO", price: 0.75 },
              ],
            },
          ],
        });
      },
    },
  ],
};