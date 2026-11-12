// Simple, beginner-friendly setup:
// 1. Loads PORT/HOST from .env (falls back to 5000 / 0.0.0.0)
// 2. Starts the Express app defined in app.js (single listen() call)

require("dotenv").config();

const app = require("./app");

const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
  console.log(`Backend running at http://${HOST}:${PORT} (local: http://localhost:${PORT})`);
  console.log(`Health check:     http://localhost:${PORT}/api/health`);
});

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(`\n[server] Port ${PORT} is already in use on ${HOST} (EADDRINUSE).`);
    console.error("[server] Another backend process may still be running.");
    console.error("[server] Stop the old backend process using that port, then start this server again.");
    console.error(`[server] Windows (PowerShell): Get-NetTCPConnection -LocalPort ${PORT} -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess`);
    console.error(`[server] Then inspect/stop only that PID: Get-CimInstance Win32_Process -Filter "ProcessId=<PID>"; Stop-Process -Id <PID>`);
    process.exit(1);
  }
  console.error("[server] Failed to start:", err);
  process.exit(1);
});

function shutdown(signal) {
  console.log(`\n[server] Received ${signal}. Shutting down...`);
  server.close(() => {
    console.log("[server] HTTP server closed.");
    process.exit(0);
  });
  // Force exit if something hangs
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
