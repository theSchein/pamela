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
healthServer.listen(healthPort, () => {
  console.log(`Health check server running on port ${healthPort}`);
});

// Start ElizaOS directly
console.log('Starting Pamela agent with ElizaOS (Railway mode)...');

// Set environment to bypass Bun check
process.env.NODE_ENV = 'production';
process.env.SKIP_BUN_CHECK = 'true';

// Ensure Bun is in PATH for the subprocess
const bunPaths = ['/usr/bin', '/usr/local/bin', join(homedir(), '.bun', 'bin')];
const currentPath = process.env.PATH || '';
const pathsToAdd = bunPaths.filter(p => existsSync(p) && !currentPath.includes(p));
if (pathsToAdd.length > 0) {
  process.env.PATH = `${pathsToAdd.join(':')}:${currentPath}`;
}

// Set BUN_INSTALL
if (existsSync('/usr/local/bin/bun') || existsSync('/usr/bin/bun')) {
  process.env.BUN_INSTALL = '/usr/local';
}

// Check if we can use Bun directly
const bunPath = existsSync('/usr/bin/bun') ? '/usr/bin/bun' : 
                existsSync('/usr/local/bin/bun') ? '/usr/local/bin/bun' : null;

if (bunPath) {
  console.log(`Found Bun at: ${bunPath}`);
  console.log('Starting ElizaOS with Bun...');
  
  // Start ElizaOS using Bun directly
  const elizaProcess = spawn(bunPath, ['node_modules/@elizaos/cli/dist/index.js', 'start'], {
    stdio: 'inherit',
    env: process.env,
    cwd: process.cwd()
  });

  elizaProcess.on('error', (error) => {
    console.error('Failed to start ElizaOS with Bun:', error);
    console.log('Falling back to Node.js...');
    
    // Fallback to Node.js
    process.argv = [process.argv[0], process.argv[1], 'start'];
    import('../node_modules/@elizaos/cli/dist/index.js').then(() => {
      console.log('ElizaOS started successfully with Node.js');
    }).catch((error) => {
      console.error('Failed to start ElizaOS:', error);
      healthServer.close();
      process.exit(1);
    });
  });

  elizaProcess.on('exit', (code) => {
    console.log(`ElizaOS exited with code ${code}`);
    healthServer.close();
    process.exit(code || 0);
  });
} else {
  console.log('Bun not found, using Node.js to start ElizaOS...');
  
  // Use Node.js to import ElizaOS
  process.argv = [process.argv[0], process.argv[1], 'start'];
  import('../node_modules/@elizaos/cli/dist/index.js').then(() => {
    console.log('ElizaOS started successfully with Node.js');
  }).catch((error) => {
    console.error('Failed to start ElizaOS:', error);
    healthServer.close();
    process.exit(1);
  });
}

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