import { Plugin, type IAgentRuntime, logger } from "@elizaos/core";
import { z } from "zod";
import type { 
  ChatMessage, 
  Market, 
  Portfolio, 
  Order, 
  ApiResponse,
  WsMessage 
} from "@pamela/shared";
import { WebSocketServer } from "ws";
import { createServer } from "http";

// Request validation schemas
const chatRequestSchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
});

const orderRequestSchema = z.object({
  marketId: z.string(),
  outcomeId: z.string(),
  side: z.enum(["buy", "sell"]),
  type: z.enum(["limit", "market"]),
  amount: z.number().positive(),
  price: z.number().positive().optional(),
});

export const apiPlugin: Plugin = {
  name: "api",
  description: "REST API and WebSocket endpoints for frontend communication",
  
  routes: [
    // Chat endpoint
    {
      path: "/api/chat",
      method: "POST",
      handler: async (req: any, res: any, runtime: IAgentRuntime) => {
        try {
          const body = await chatRequestSchema.parseAsync(req.body);
          
          // Process chat message through the agent
          const response = await runtime.processMessage({
            userId: req.session?.userId || "anonymous",
            content: { text: body.message },
            roomId: body.conversationId || "default",
          });
          
          const apiResponse: ApiResponse<ChatMessage> = {
            success: true,
            data: {
              id: response.id,
              role: "assistant",
              content: response.content.text || "I couldn't process that message.",
              timestamp: new Date(),
              metadata: response.content.metadata,
            },
          };
          
          res.json(apiResponse);
        } catch (error) {
          logger.error("Chat API error:", error);
          res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : "Failed to process message",
          });
        }
      },
    },
    
    // Get markets
    {
      path: "/api/markets",
      method: "GET",
      handler: async (req: any, res: any, runtime: IAgentRuntime) => {
        try {
          // Get markets from Polymarket plugin
          const polymarketService = runtime.getService("polymarket");
          if (!polymarketService) {
            throw new Error("Polymarket service not available");
          }
          
          // Call the getSamplingMarkets action
          const markets = await runtime.executeAction("GET_SAMPLING_MARKETS", {
            limit: req.query.limit || 20,
            active: req.query.active !== "false",
          });
          
          const apiResponse: ApiResponse<Market[]> = {
            success: true,
            data: markets,
          };
          
          res.json(apiResponse);
        } catch (error) {
          logger.error("Markets API error:", error);
          res.status(500).json({
            success: false,
            error: "Failed to fetch markets",
          });
        }
      },
    },
    
    // Get market details
    {
      path: "/api/markets/:id",
      method: "GET",
      handler: async (req: any, res: any, runtime: IAgentRuntime) => {
        try {
          const marketId = req.params.id;
          
          const marketDetails = await runtime.executeAction("GET_MARKET_DETAILS", {
            marketId,
          });
          
          const apiResponse: ApiResponse<Market> = {
            success: true,
            data: marketDetails,
          };
          
          res.json(apiResponse);
        } catch (error) {
          logger.error("Market details API error:", error);
          res.status(500).json({
            success: false,
            error: "Failed to fetch market details",
          });
        }
      },
    },
    
    // Get portfolio
    {
      path: "/api/portfolio",
      method: "GET",
      handler: async (req: any, res: any, runtime: IAgentRuntime) => {
        try {
          const portfolio = await runtime.executeAction("GET_PORTFOLIO_POSITIONS", {});
          
          const apiResponse: ApiResponse<Portfolio> = {
            success: true,
            data: portfolio,
          };
          
          res.json(apiResponse);
        } catch (error) {
          logger.error("Portfolio API error:", error);
          res.status(500).json({
            success: false,
            error: "Failed to fetch portfolio",
          });
        }
      },
    },
    
    // Place order
    {
      path: "/api/orders",
      method: "POST",
      handler: async (req: any, res: any, runtime: IAgentRuntime) => {
        try {
          const body = await orderRequestSchema.parseAsync(req.body);
          
          const order = await runtime.executeAction("PLACE_ORDER", {
            tokenId: body.marketId,
            side: body.side,
            amount: body.amount,
            price: body.price,
            orderType: body.type === "market" ? "FOK" : "GTC",
          });
          
          const apiResponse: ApiResponse<Order> = {
            success: true,
            data: order,
          };
          
          res.json(apiResponse);
        } catch (error) {
          logger.error("Place order API error:", error);
          res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : "Failed to place order",
          });
        }
      },
    },
    
    // Cancel order
    {
      path: "/api/orders/:id/cancel",
      method: "POST",
      handler: async (req: any, res: any, runtime: IAgentRuntime) => {
        try {
          const orderId = req.params.id;
          
          await runtime.executeAction("CANCEL_ORDER", {
            orderId,
          });
          
          const apiResponse: ApiResponse<void> = {
            success: true,
            message: "Order cancelled successfully",
          };
          
          res.json(apiResponse);
        } catch (error) {
          logger.error("Cancel order API error:", error);
          res.status(400).json({
            success: false,
            error: "Failed to cancel order",
          });
        }
      },
    },
    
    // Health check
    {
      path: "/api/health",
      method: "GET",
      handler: async (_req: any, res: any) => {
        res.json({
          success: true,
          status: "healthy",
          timestamp: new Date().toISOString(),
        });
      },
    },
  ],
  
  // WebSocket setup
  services: [
    {
      name: "websocket",
      getInstance: (runtime: IAgentRuntime) => {
        const server = createServer();
        const wss = new WebSocketServer({ server });
        
        wss.on("connection", (ws) => {
          logger.info("WebSocket client connected");
          
          ws.on("message", async (message) => {
            try {
              const data = JSON.parse(message.toString()) as WsMessage;
              
              switch (data.type) {
                case "market:subscribe":
                  // Subscribe to market updates
                  runtime.on(`market:${data.payload.marketId}`, (update) => {
                    ws.send(JSON.stringify({
                      type: "market:update",
                      payload: update,
                      timestamp: new Date(),
                    }));
                  });
                  break;
                  
                case "portfolio:subscribe":
                  // Subscribe to portfolio updates
                  runtime.on("portfolio:update", (update) => {
                    ws.send(JSON.stringify({
                      type: "portfolio:update",
                      payload: update,
                      timestamp: new Date(),
                    }));
                  });
                  break;
              }
            } catch (error) {
              logger.error("WebSocket message error:", error);
            }
          });
          
          ws.on("close", () => {
            logger.info("WebSocket client disconnected");
          });
        });
        
        // Start WebSocket server on port 3001
        server.listen(3001, () => {
          logger.info("WebSocket server started on port 3001");
        });
        
        return { wss, server };
      },
    },
  ],
};