// Authentication rate limiting.
//
// Only the credential endpoints are limited. Public catalog, availability and
// appointment APIs stay untouched. Limits are configurable so deployments can
// tune them without code changes:
// - AUTH_RATE_LIMIT_WINDOW_MS   default 900000 (15 minutes)
// - AUTH_RATE_LIMIT_LOGIN_MAX   default 10 failed logins per window per IP
// - AUTH_RATE_LIMIT_REGISTER_MAX default 5 registrations per window per IP
//
// Successful logins are not counted, so a shared office/NAT IP cannot lock
// legitimate users out by logging in normally.

const rateLimit = require("express-rate-limit");

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function windowMs() {
  return positiveInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
}

function buildLimiter({ max, message, skipSuccessfulRequests = false }) {
  const window = windowMs();

  return rateLimit({
    windowMs: window,
    limit: Math.max(1, max),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler(req, res) {
      const resetTime = req.rateLimit && req.rateLimit.resetTime;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((((resetTime instanceof Date ? resetTime.getTime() : Date.now() + window) - Date.now()) / 1000))
      );

      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        success: false,
        message,
        retryAfterSeconds,
      });
    },
  });
}

const loginLimiter = buildLimiter({
  max: positiveInt(process.env.AUTH_RATE_LIMIT_LOGIN_MAX, 10),
  message: "Too many login attempts. Please wait a few minutes and try again.",
  skipSuccessfulRequests: true,
});

const registerLimiter = buildLimiter({
  max: positiveInt(process.env.AUTH_RATE_LIMIT_REGISTER_MAX, 5),
  message: "Too many account creation attempts. Please wait a few minutes and try again.",
});

module.exports = { loginLimiter, registerLimiter, windowMs };
