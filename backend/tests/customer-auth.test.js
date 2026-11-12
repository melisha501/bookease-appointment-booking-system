// Authentication & authorisation tests for the customer management API.
// Uses mocked Prisma and real JWTs/bcrypt so no database is required.

const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

process.env.JWT_SECRET = "customer-test-secret";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb";

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function freshRequire(modulePath, prismaMock) {
  const prismaPath = require.resolve("../src/lib/prisma");
  const targetPath = require.resolve(modulePath);
  delete require.cache[targetPath];
  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: prismaMock,
  };
  return require(targetPath);
}

const adminUser = {
  id: "admin-1",
  name: "Admin User",
  email: "admin@example.com",
  phone: null,
  address: null,
  role: "ADMIN",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};
const customerUser = { ...adminUser, id: "cust-1", role: "CUSTOMER", email: "cust@example.com" };

function signToken(user, options = {}) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "1h", ...options }
  );
}

test("requireAuth rejects requests without a bearer token", async () => {
  const { requireAuth } = freshRequire("../src/middleware/auth", {});
  const res = mockRes();
  let called = false;

  await requireAuth({ headers: {} }, res, () => {
    called = true;
  });

  assert.equal(res.statusCode, 401);
  assert.match(res.body.message, /authentication required/i);
  assert.equal(called, false);
});

test("requireAuth attaches a safe admin user for a valid token", async () => {
  let findUniqueArgs = null;
  const prisma = {
    user: {
      findUnique: async (args) => {
        findUniqueArgs = args;
        return adminUser;
      },
    },
  };
  const { requireAuth, requireAdmin } = freshRequire("../src/middleware/auth", prisma);
  const req = { headers: { authorization: `Bearer ${signToken(adminUser)}` } };
  const res = mockRes();
  let nextCalled = false;

  await requireAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(req.user, adminUser);
  assert.equal(findUniqueArgs.select.passwordHash, undefined);
  assert.ok(!JSON.stringify(req.user).includes("passwordHash"));

  let adminNext = false;
  requireAdmin(req, res, () => {
    adminNext = true;
  });
  assert.equal(adminNext, true);
});

test("requireAuth rejects invalid and expired tokens", async () => {
  const prisma = { user: { findUnique: async () => adminUser } };
  const { requireAuth } = freshRequire("../src/middleware/auth", prisma);

  let res = mockRes();
  await requireAuth({ headers: { authorization: "Bearer not-a-token" } }, res, () => {
    throw new Error("next should not be called");
  });
  assert.equal(res.statusCode, 401);
  assert.match(res.body.message, /session expired/i);

  const expired = jwt.sign({ sub: "admin-1" }, process.env.JWT_SECRET, { expiresIn: -1 });
  res = mockRes();
  await requireAuth({ headers: { authorization: `Bearer ${expired}` } }, res, () => {
    throw new Error("next should not be called");
  });
  assert.equal(res.statusCode, 401);
  assert.match(res.body.message, /session expired/i);
});

test("requireAuth rejects tokens whose user no longer exists", async () => {
  const prisma = { user: { findUnique: async () => null } };
  const { requireAuth } = freshRequire("../src/middleware/auth", prisma);
  const res = mockRes();

  await requireAuth(
    { headers: { authorization: `Bearer ${signToken(adminUser)}` } },
    res,
    () => {
      throw new Error("next should not be called");
    }
  );

  assert.equal(res.statusCode, 401);
  assert.match(res.body.message, /invalid or expired session/i);
});

test("requireAdmin blocks authenticated customers with 403", async () => {
  const { requireAdmin } = freshRequire("../src/middleware/auth", {});
  const res = mockRes();
  let called = false;

  requireAdmin({ user: customerUser }, res, () => {
    called = true;
  });

  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /admin access required/i);
  assert.equal(called, false);
});

test("requireAdmin blocks unauthenticated requests with 403", async () => {
  const { requireAdmin } = freshRequire("../src/middleware/auth", {});
  const res = mockRes();

  requireAdmin({}, res, () => {
    throw new Error("next should not be called");
  });

  assert.equal(res.statusCode, 403);
});

test("login returns a token and a safe user without passwordHash", async () => {
  const passwordHash = bcrypt.hashSync("Secret123", 10);
  const prisma = {
    user: {
      findUnique: async ({ where }) => {
        assert.equal(where.email, "admin@example.com");
        return { ...adminUser, passwordHash };
      },
    },
  };
  const { login } = freshRequire("../src/controllers/authController", prisma);
  const res = mockRes();

  await login(
    { body: { email: "Admin@Example.com", password: "Secret123" } },
    res,
    (err) => {
      throw err;
    }
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.token);
  assert.equal(res.body.user.email, "admin@example.com");
  assert.equal(res.body.user.role, "ADMIN");
  assert.equal("passwordHash" in res.body.user, false);
  assert.ok(!JSON.stringify(res.body).includes(passwordHash));
  assert.equal(jwt.verify(res.body.token, process.env.JWT_SECRET).sub, "admin-1");
});

test("login rejects an incorrect password without exposing account data", async () => {
  const passwordHash = bcrypt.hashSync("Secret123", 10);
  const prisma = {
    user: { findUnique: async () => ({ ...adminUser, passwordHash }) },
  };
  const { login } = freshRequire("../src/controllers/authController", prisma);
  const res = mockRes();

  await login(
    { body: { email: "admin@example.com", password: "wrong-password" } },
    res,
    (err) => {
      throw err;
    }
  );

  assert.equal(res.statusCode, 401);
  assert.match(res.body.message, /invalid email or password/i);
  assert.equal(res.body.user, undefined);
  assert.ok(!JSON.stringify(res.body).includes(passwordHash));
});
