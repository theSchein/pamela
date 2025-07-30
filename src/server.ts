import { AgentServer } from '@elizaos/server';
import { projectAgent } from './index.js';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startProductionServer() {
  const port = parseInt(process.env.PORT || '3000');
  
  console.log('🚀 Starting Pamela AI Production Server...');
  
  // Initialize ElizaOS server
  const server = new AgentServer();
  await server.initialize();
  
  // Start the agent
  const runtime = await server.startAgent(projectAgent.character);
  await server.registerAgent(runtime);
  
  // Serve frontend static files
  const frontendPath = path.join(__dirname, '../dist/frontend');
  console.log(`📁 Serving frontend from: ${frontendPath}`);
  
  server.app.use(express.static(frontendPath));
  
  // Catch-all handler: send back React's index.html file for SPA routing
  server.app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
  
  // Start the server
  await server.start(port);
  
  console.log(`✅ Pamela AI Agent running on port ${port}`);
  console.log(`🌐 Frontend: http://localhost:${port}`);
  console.log(`🔌 WebSocket: ws://localhost:${port}/socket.io/`);
  console.log(`📊 API: http://localhost:${port}/api`);
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('🛑 Shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    console.log('🛑 Shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startProductionServer().catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
}

export { startProductionServer };