// Authentication controller: register, login, me (current user).

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    address: user.address,
    role: user.role,
    createdAt: user.createdAt,
  };
}

async function register(req, res, next) {
  try {
    const { name, email, phone, password } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: "Full name is required." });
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(String(email))) {
      return res.status(400).json({ success: false, message: "A valid email is required." });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ success: false, message: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: normalizedEmail,
        phone: phone ? String(phone).trim() : null,
        passwordHash,
        role: "CUSTOMER",
      },
    });

    const token = signToken(user);
    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      token,
      user: safeUser(user),
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const token = signToken(user);
    return res.json({
      success: true,
      message: "Logged in successfully.",
      token,
      user: safeUser(user),
    });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  // req.user is attached by requireAuth
  return res.json({ success: true, user: req.user });
}

async function logout(_req, res) {
  // JWT is stateless; the client clears its token.
  return res.json({ success: true, message: "Logged out." });
}

async function updateProfile(req, res, next) {
  try {
    const { name, phone, address } = req.body || {};
    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ success: false, message: "Name cannot be empty." });
    }
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(phone !== undefined ? { phone: phone ? String(phone).trim() : null } : {}),
        ...(address !== undefined ? { address: address ? String(address).trim() : null } : {}),
      },
      select: { id: true, name: true, email: true, phone: true, address: true, role: true, createdAt: true },
    });
    return res.json({ success: true, message: "Profile updated.", user });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, me, logout, updateProfile };
