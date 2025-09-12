import { createServer } from "http";

// Create a simple health check server
const PORT = process.env.HEALTH_CHECK_PORT || 3001;

const server = createServer((req, res) => {
  if (req.url === "/health" || req.url === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "healthy",
        service: "pamela-agent",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      }),
    );
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(PORT, () => {
  console.log(`Health check server running on port ${PORT}`);
});

export default server;
