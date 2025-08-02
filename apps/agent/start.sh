#!/bin/sh

# Start health check server in background
node -e "
const http = require('http');
const server = http.createServer((req, res) => {
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
server.listen(3001, () => {
  console.log('Health check server running on port 3001');
});
" &

# Start ElizaOS using npm
cd /app/apps/agent
npm run start:eliza