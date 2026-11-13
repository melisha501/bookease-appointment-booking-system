// Live rate-limiting tests for the authentication endpoints.
// Starts the real Express app and real express-rate-limit middleware with
// Prisma mocked, so no database is touched and failed credentials return 401.

const test = require("node:test");
const assert = require("node:assert/strict");

const LOGIN_MAX = 3;
const REGISTER_MAX = 2;

process.env.JWT_SECRET = process.env.JWT_SECRET || "rate-limit-test-secret";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.AUTH_RATE_LIMIT_WINDOW_MS = "60000";
process.env.AUTH_RATE_LIMIT_LOGIN_MAX = String(LOGIN_MAX);
process.env.AUTH_RATE_LIMIT_REGISTER_MAX = String(REGISTER_MAX);

const existingUser = {
  id: "user-existing",
  name: "Existing User",
  email: "existing@example.test",
  phone: null,
  address: null,
  role: "CUSTOMER",
  passwordHash: "$2b$10$abcdefghijklmnopqrstuv",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

const prismaMock = {
  $queryRaw: async () => [{ "?column?": 1 }],
  user: {
    findUnique: async ({ where }) => (where.email === existingUser.email ? existingUser : null),
    create: async ({ data }) => ({ id: "user-new", ...data, role: "CUSTOMER" }),
  },
};

const prismaPath = require.resolve("../src/lib/prisma");
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
};

const app = require("../src/app");

async function postJson(base, path, body) {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("login is limited after repeated failures and returns a JSON 429", async (t) => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const credentials = { email: "missing@example.test", password: "WrongPassword1" };

  for (let attempt = 1; attempt <= LOGIN_MAX; attempt += 1) {
    const res = await postJson(base, "/api/auth/login", credentials);
    assert.equal(res.status, 401, `attempt ${attempt} should be a normal 401`);
    const body = await res.json();
    assert.equal(body.success, false);
  }

  const blocked = await postJson(base, "/api/auth/login", credentials);
  assert.equal(blocked.status, 429);
  assert.ok(blocked.headers.get("retry-after"), "Retry-After header should be present");
  assert.ok(blocked.headers.get("ratelimit"), "RateLimit header should be present");
  const body = await blocked.json();
  assert.equal(body.success, false);
  assert.match(body.message, /too many login attempts/i);
  assert.ok(Number(body.retryAfterSeconds) >= 1);

  // Public endpoints must stay available after the auth limit is exhausted.
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
});

test("registration has its own limiter and does not share the login budget", async (t) => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise((resolve) => server.close(resolve)));

  // "missing" login budget is already exhausted from the previous test in this
  // process; a fresh registration request must still be processed normally.
  const duplicate = {
    name: "Existing User",
    email: existingUser.email,
    password: "AnotherPass1",
  };

  for (let attempt = 1; attempt <= REGISTER_MAX; attempt += 1) {
    const res = await postJson(base, "/api/auth/register", duplicate);
    assert.equal(res.status, 409, `attempt ${attempt} should be a normal validation response`);
  }

  const blocked = await postJson(base, "/api/auth/register", duplicate);
  assert.equal(blocked.status, 429);
  const body = await blocked.json();
  assert.equal(body.success, false);
  assert.match(body.message, /too many account creation attempts/i);
  assert.ok(Number(body.retryAfterSeconds) >= 1);

  // A different endpoint is still reachable.
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
});
