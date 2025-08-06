#!/usr/bin/env node

import { spawn } from 'child_process';
import { createServer } from 'http';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

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
healthServer.listen(healthPort, '0.0.0.0', () => {
  console.log(`Health check server running on port ${healthPort} (all interfaces)`);
});

// Start ElizaOS directly using node
console.log('Starting Pamela agent with ElizaOS...');

// Set NODE_ENV to avoid Bun check
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Ensure Bun is in PATH - add all possible locations
const currentPath = process.env.PATH || '';
const bunPaths = ['/usr/local/bin', join(homedir(), '.bun', 'bin')];
const pathsToAdd = bunPaths.filter(p => existsSync(p) && !currentPath.includes(p));
if (pathsToAdd.length > 0) {
  process.env.PATH = `${pathsToAdd.join(':')}:${currentPath}`;
}

// Also set BUN_INSTALL for ElizaOS
if (existsSync('/usr/local/bin/bun')) {
  process.env.BUN_INSTALL = '/usr/local';
}

// Set process.argv to include the 'start' command
process.argv = [process.argv[0], process.argv[1], 'start'];

// Use dynamic import to load ElizaOS
import('../node_modules/@elizaos/cli/dist/index.js').then(() => {
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