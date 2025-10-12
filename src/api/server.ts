import express, { type Express } from "express";
import type { Server } from "http";
import { logger } from "@elizaos/core";
import { healthHandler } from "./routes/health";
import { walletHandler } from "./routes/wallet";
import type { ApiServerConfig } from "./types";

/**
 * API Server for SPMC Integration
 *
 * Provides HTTP endpoints on port 8080 for:
 * - Health checks (GET /health)
 * - Wallet address retrieval (GET /wallet)
 *
 * Requirements:
 * - Must respond within 5 seconds
 * - Health endpoint called every 30 seconds by SPMC
 * - Wallet endpoint polled during startup (up to 60 seconds)
 */
export class ApiServer {
  private app: Express;
  private server: Server | null = null;
  private config: ApiServerConfig;

  constructor(config: ApiServerConfig) {
    this.config = config;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // JSON body parser
    this.app.use(express.json());

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on("finish", () => {
        const duration = Date.now() - start;
        logger.debug(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
      });
      next();
    });

    // CORS headers (if needed)
    this.app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type");
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get("/health", healthHandler);

    // Wallet address endpoint
    this.app.get("/wallet", walletHandler);

    // Root endpoint - redirect to health
    this.app.get("/", (req, res) => {
      res.redirect("/health");
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: "Not Found",
        path: req.path,
        available_endpoints: ["/health", "/wallet"],
      });
    });

    // Error handler
    this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error("API Server Error:", err.message);
      res.status(500).json({
        error: "Internal Server Error",
        message: err.message,
      });
    });
  }

  /**
   * Start the API server
   *
   * @returns Promise that resolves when server is listening
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, () => {
          logger.info(`✓ API Server listening on port ${this.config.port}`);
          logger.info(`  Health endpoint: http://localhost:${this.config.port}/health`);
          logger.info(`  Wallet endpoint: http://localhost:${this.config.port}/wallet`);

          if (this.config.gitTag) {
            logger.info(`  Git tag: ${this.config.gitTag}`);
          }
          if (this.config.gitCommit) {
            logger.info(`  Git commit: ${this.config.gitCommit}`);
          }

          resolve();
        });

        this.server.on("error", (error: Error) => {
          logger.error("Failed to start API server:", error.message);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the API server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error) => {
        if (error) {
          logger.error("Error stopping API server:", error instanceof Error ? error.message : String(error));
          reject(error);
        } else {
          logger.info("✓ API Server stopped");
          resolve();
        }
      });
    });
  }

  /**
   * Get Express app instance (for testing)
   */
  getApp(): Express {
    return this.app;
  }
}

/**
 * Create and start API server
 *
 * @param port - Port to listen on (default: 8080)
 * @returns ApiServer instance
 */
export async function startApiServer(port: number = 8080): Promise<ApiServer> {
  const config: ApiServerConfig = {
    port,
    version: process.env.npm_package_version || "0.1.0",
    gitTag: process.env.GIT_TAG,
    gitCommit: process.env.GIT_COMMIT_SHA,
  };

  const server = new ApiServer(config);
  await server.start();

  return server;
}

export default ApiServer;
