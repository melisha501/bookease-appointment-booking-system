// Health-check route: GET /api/health
// Confirms the API is running and reports database connectivity (without secrets).

const express = require("express");
const prisma = require("../lib/prisma");

const router = express.Router();

router.get("/", async (_req, res) => {
  let db = "unknown";
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "ok";
  } catch (err) {
    db = "error";
  }

  const ok = db === "ok";
  res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "degraded",
    message: ok ? "Backend and database are reachable" : "Backend is running, but the database is not reachable. Check DATABASE_URL, PostgreSQL, and migrations.",
    database: db,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
