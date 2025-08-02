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

// Start ElizaOS
console.log('Starting Pamela agent with ElizaOS...');
const elizaProcess = spawn('node', [
  '--experimental-specifier-resolution=node',
  '../../node_modules/@elizaos/cli/dist/index.js',
  'start'
], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: process.env
});

elizaProcess.on('error', (error) => {
  console.error('Failed to start ElizaOS:', error);
  process.exit(1);
});

elizaProcess.on('exit', (code) => {
  console.log(`ElizaOS exited with code ${code}`);
  healthServer.close();
  process.exit(code);
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  elizaProcess.kill('SIGTERM');
  healthServer.close();
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  elizaProcess.kill('SIGINT');
  healthServer.close();
});