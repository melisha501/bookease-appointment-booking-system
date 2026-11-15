// HTTP-level CORS tests for the three real frontend origins:
//   - the Vercel production alias,
//   - the Vercel git-main alias,
//   - a unique Vercel preview deployment URL.
//
// This deliberately configures only FRONTEND_URL (the production alias), just
// like a minimal Render environment. The other two origins must be accepted by
// the built-in project/team rules, without extra CORS_ORIGINS entries.
//
// Prisma is mocked, so these tests need no database.

const test = require("node:test");
const assert = require("node:assert/strict");

const PRODUCTION = "https://bookease-appointment-booking-system.vercel.app";
const GIT_MAIN = "https://bookease-appointment-booking-system-git-main-melisha.vercel.app";
const PREVIEW = "https://bookease-appointment-booking-system-6pf8hu70w-melisha.vercel.app";

process.env.JWT_SECRET = process.env.JWT_SECRET || "cors-http-test-secret";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb";
process.env.FRONTEND_URL = PRODUCTION;
delete process.env.CORS_ORIGINS;
delete process.env.ALLOW_VERCEL_PREVIEWS;
delete process.env.VERCEL_PREVIEW_PROJECT;
delete process.env.VERCEL_PREVIEW_TEAM;
process.env.NODE_ENV = "test";

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

let server;
let base;

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

function get(path, origin) {
  const headers = origin ? { Origin: origin } : {};
  return fetch(`${base}${path}`, { headers });
}

function preflight(path, origin, requestHeaders) {
  return fetch(`${base}${path}`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "GET",
      ...(requestHeaders
        ? { "Access-Control-Request-Headers": requestHeaders }
        : {}),
    },
  });
}

test("production alias, git-main alias and unique preview can read the API", async () => {
  for (const origin of [PRODUCTION, GIT_MAIN, PREVIEW]) {
    const res = await get("/api/health", origin);
    assert.equal(res.status, 200, `${origin} should reach the API`);
    assert.equal(
      res.headers.get("access-control-allow-origin"),
      origin,
      `${origin} should be reflected in Access-Control-Allow-Origin`
    );
    assert.equal(res.headers.get("access-control-allow-credentials"), "true");
    assert.match(res.headers.get("vary") || "", /Origin/i);
  }
});

test("unknown origins receive no CORS allow-origin header", async () => {
  for (const origin of [
    "https://evil.example.test",
    "https://another-project.vercel.app",
    "https://bookease-appointment-booking-system-6pf8hu70w-other-team.vercel.app",
    "https://bookease-appointment-booking-system.vercel.app.evil.example",
  ]) {
    const res = await get("/api/health", origin);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("access-control-allow-origin"), null, origin);
    assert.equal(res.headers.get("access-control-allow-credentials"), null, origin);
    assert.match(res.headers.get("vary") || "", /Origin/i);
  }
});

test("requests without an Origin header are untouched", async () => {
  const res = await get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), null);
});

test("preflight for the failing preview origin is answered with 204", async () => {
  const res = await preflight("/api/services", PREVIEW, "authorization,content-type");
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), PREVIEW);
  assert.equal(res.headers.get("access-control-allow-credentials"), "true");
  assert.match(res.headers.get("access-control-allow-methods") || "", /GET/);
  assert.match(res.headers.get("access-control-allow-methods") || "", /POST/);
  assert.match(res.headers.get("access-control-allow-methods") || "", /OPTIONS/);
  assert.match(res.headers.get("access-control-allow-headers") || "", /authorization/i);
  assert.match(res.headers.get("access-control-allow-headers") || "", /content-type/i);
  assert.equal(res.headers.get("access-control-max-age"), "86400");
});

test("preflight works for every failing catalog and auth endpoint", async () => {
  for (const path of [
    "/api/services",
    "/api/categories",
    "/api/specialists",
    "/api/auth/login",
    "/api/auth/register",
  ]) {
    const res = await preflight(path, PREVIEW, "content-type");
    assert.equal(res.status, 204, `${path} preflight should succeed`);
    assert.equal(res.headers.get("access-control-allow-origin"), PREVIEW, path);
  }
});

test("disallowed preflight is rejected without CORS headers", async () => {
  const res = await preflight("/api/services", "https://evil.example.test");
  assert.equal(res.status, 403);
  assert.equal(res.headers.get("access-control-allow-origin"), null);
  const body = await res.json();
  assert.equal(body.success, false);
});

test("authenticated requests keep CORS headers on auth failures", async () => {
  const res = await fetch(`${base}/api/dashboard/stats`, {
    headers: {
      Origin: PREVIEW,
      Authorization: "Bearer not-a-real-token",
    },
  });
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("access-control-allow-origin"), PREVIEW);
  const body = await res.json();
  assert.equal(body.success, false);
});
