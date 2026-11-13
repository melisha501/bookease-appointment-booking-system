// Verifies Helmet security headers and the existing CORS allow-list on real
// HTTP responses from the Express app (Prisma mocked, no database).

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "headers-test-secret";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.CORS_ORIGINS = "https://bookease.example.test";
process.env.ALLOW_VERCEL_PREVIEWS = "false";
delete process.env.TRUST_PROXY;

const prismaMock = {
  $queryRaw: async () => [{ "?column?": 1 }],
};

const prismaPath = require.resolve("../src/lib/prisma");
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
};

const app = require("../src/app");

test("API responses include security headers and keep CORS behaviour", async (t) => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const res = await fetch(`${base}/api/health`, {
    headers: { Origin: "http://localhost:5173" },
  });
  assert.equal(res.status, 200);

  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.match(res.headers.get("strict-transport-security") || "", /max-age=\d+/);
  assert.match(res.headers.get("content-security-policy") || "", /default-src 'none'/);
  assert.match(res.headers.get("content-security-policy") || "", /frame-ancestors 'none'/);
  assert.equal(res.headers.get("cross-origin-resource-policy"), "cross-origin");
  assert.equal(res.headers.get("cross-origin-embedder-policy"), null);
  assert.ok(res.headers.get("referrer-policy"));
  assert.equal(res.headers.get("x-powered-by"), null);

  // Configured frontend origin is still allowed.
  assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:5173");

  // A second configured origin is allowed too.
  const allowed = await fetch(`${base}/api/health`, {
    headers: { Origin: "https://bookease.example.test" },
  });
  assert.equal(allowed.headers.get("access-control-allow-origin"), "https://bookease.example.test");

  // Unknown origins do not receive an allow-origin header.
  const blocked = await fetch(`${base}/api/health`, {
    headers: { Origin: "https://evil.example.test" },
  });
  assert.equal(blocked.status, 200);
  assert.equal(blocked.headers.get("access-control-allow-origin"), null);
});

test("JSON error responses also carry security headers", async (t) => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const res = await fetch(`${base}/api/route-that-does-not-exist`);
  assert.equal(res.status, 404);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  const body = await res.json();
  assert.equal(body.success, false);
});
