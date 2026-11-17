// Express app — routes & middleware.
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const { createCorsPolicy } = require("./config/cors");
const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/auth");
const categoryRoutes = require("./routes/categories");
const serviceRoutes = require("./routes/services");
const specialistRoutes = require("./routes/specialists");
const appointmentRoutes = require("./routes/appointments");
const customerRoutes = require("./routes/customers");
const dashboardRoutes = require("./routes/dashboard");
const providerRoutes = require("./routes/providers");
const providerAdminRoutes = require("./routes/providerAdmin");

const app = express();

// Render (and most PaaS hosts) terminate TLS at a single reverse proxy, so the
// client IP is in the first X-Forwarded-For entry. Trusting exactly one hop
// lets rate limiting see real client IPs. Local development trusts nothing.
// Override with TRUST_PROXY=false|true|<number>|<preset> if the topology differs.
function parseTrustProxy(value) {
  if (value === undefined || String(value).trim() === "") {
    return process.env.NODE_ENV === "production" ? 1 : false;
  }
  const trimmed = String(value).trim();
  if (/^false$/i.test(trimmed)) return false;
  if (/^true$/i.test(trimmed)) return true;
  const hops = Number(trimmed);
  if (Number.isInteger(hops) && hops >= 0) return hops;
  return trimmed;
}
app.set("trust proxy", parseTrustProxy(process.env.TRUST_PROXY));

// Security headers. The API returns JSON (plus legacy /uploads images), so a
// strict CSP is safe here and does not affect the separately hosted frontend.
// UploadThing CDN images must remain embeddable cross-origin.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS: explicit allowlist plus this project's own Vercel preview deployments.
// FRONTEND_URL is the primary origin; CORS_ORIGINS accepts a comma-separated
// list (custom domain, production alias, git-main alias). Preview hosts are
// matched against a strict project + team pattern in config/cors.js - never a
// bare *.vercel.app wildcard. Requests without an Origin header (Render health
// checks, curl, server-to-server) are always allowed because they are not
// subject to browser CORS.
const corsPolicy = createCorsPolicy();
const corsOptions = {
  origin(origin, callback) {
    return callback(null, corsPolicy.isAllowedOrigin(origin));
  },
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  optionsSuccessStatus: 204,
  maxAge: 86400,
};

// The response depends on the request Origin, so tell caches about it even when
// the origin is rejected (the `cors` package skips Vary for rejected origins).
app.use((req, res, next) => {
  res.vary("Origin");
  return next();
});

// Reject disallowed preflights explicitly instead of falling through to a 200
// with no CORS headers. Allowed preflights are answered by `cors` with 204.
app.use((req, res, next) => {
  if (
    req.method === "OPTIONS" &&
    req.headers.origin &&
    !corsPolicy.isAllowedOrigin(req.headers.origin)
  ) {
    return res.status(403).json({
      success: false,
      message: "Origin is not allowed by CORS.",
    });
  }
  return next();
});

// Must run before the API routes so JSON errors also carry CORS headers.
app.use(cors(corsOptions));
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
app.use("/api/providers", providerRoutes);
app.use("/api/admin", providerAdminRoutes);

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
