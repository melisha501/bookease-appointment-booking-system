// Express app — routes & middleware.
const express = require("express");
const cors = require("cors");
const path = require("path");

const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/auth");
const categoryRoutes = require("./routes/categories");
const serviceRoutes = require("./routes/services");
const specialistRoutes = require("./routes/specialists");
const appointmentRoutes = require("./routes/appointments");
const customerRoutes = require("./routes/customers");
const dashboardRoutes = require("./routes/dashboard");

const app = express();

// CORS: allow the deployed frontend plus local development.
// FRONTEND_URL is the primary origin; CORS_ORIGINS accepts a comma-separated
// list (useful for a custom domain and a Vercel preview URL at the same time).
// Requests without an Origin header (Render health checks, curl, server-to-server)
// are always allowed because they are not subject to browser CORS.
function parseOriginList(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

const configuredOrigins = [
  ...parseOriginList(process.env.FRONTEND_URL),
  ...parseOriginList(process.env.CORS_ORIGINS),
];
const allowedOrigins = configuredOrigins.length
  ? [...new Set(configuredOrigins)]
  : ["http://localhost:5173", "http://127.0.0.1:5173"];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Optional: allow any Vercel preview deployment for this project.
      if (
        process.env.ALLOW_VERCEL_PREVIEWS === "true" &&
        /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
// Legacy static files only. New admin image uploads go to UploadThing and are
// stored in PostgreSQL as absolute URLs. This route keeps any pre-existing
// local images from older data working; nothing writes here anymore.
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/specialists", specialistRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.get("/", (_req, res) => {
  res.json({ message: "Appointment & Service Booking System API" });
});

// Keep unknown routes consistent with the rest of the JSON API.
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

// Central error handler (keeps responses beginner-friendly JSON).
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  let status = err.status || 500;
  let message = err.message || "Server error";

  // Common database connectivity errors (do not expose secrets).
  const raw = String(err.message || "");
  const code = err.code || "";
  if (
    code === "ECONNREFUSED" ||
    code === "P1001" ||
    err.name === "PrismaClientInitializationError" ||
    /Can't reach database server|ECONNREFUSED|Connection refused|password authentication failed/i.test(raw)
  ) {
    status = 503;
    if (/password authentication failed/i.test(raw)) {
      message = "Database authentication failed. Check DATABASE_URL credentials in backend/.env.";
    } else if (/ECONNREFUSED|Can't reach database server|Connection refused|P1001/i.test(raw) || code === "ECONNREFUSED" || code === "P1001") {
      message = "Cannot connect to PostgreSQL. Make sure PostgreSQL is running and DATABASE_URL in backend/.env is correct.";
    } else {
      message = "Database is unavailable. Check PostgreSQL and backend/.env (DATABASE_URL), then run migrations (db push/migrate).";
    }
  }

  res.status(status).json({ success: false, message });
});

module.exports = app;
