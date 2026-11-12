// JWT authentication middleware.
// - requireAuth: verifies Bearer token and attaches req.user
// - requireAdmin: ensures req.user.role === 'ADMIN'

const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ success: false, message: "Server auth is not configured." });
    }

    const payload = jwt.verify(token, secret);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, phone: true, address: true, role: true, createdAt: true },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid or expired session." });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError" || err.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
    }
    next(err);
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ success: false, message: "Admin access required." });
  }
  next();
}

// Optional auth: attaches user if token is valid, but does not block guests.
async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, phone: true, address: true, role: true },
    });
    if (user) req.user = user;
  } catch {
    // ignore invalid token for optional auth
  }
  next();
}

module.exports = { requireAuth, requireAdmin, optionalAuth };
