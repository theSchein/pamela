#!/usr/bin/env node

import { spawn } from 'child_process';
import { createServer } from 'http';

// Start health check server
const healthServer = createServer((req, res) => {
  if (req.url === '/health' || req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'pamela-agent',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

const healthPort = process.env.HEALTH_CHECK_PORT || 3001;
healthServer.listen(healthPort, () => {
  console.log(`Health check server running on port ${healthPort}`);
});

// Start ElizaOS directly using node
console.log('Starting Pamela agent with ElizaOS...');

// Set NODE_ENV to avoid Bun check
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Use dynamic import to load ElizaOS
import('../../node_modules/@elizaos/cli/dist/index.js').then(() => {
  console.log('ElizaOS started successfully');
}).catch((error) => {
  console.error('Failed to start ElizaOS:', error);
  healthServer.close();
  process.exit(1);
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  healthServer.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  healthServer.close();
  process.exit(0);
});