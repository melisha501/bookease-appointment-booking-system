// Unit tests for the CORS origin policy (no HTTP server or database).
// The policy must keep an explicit allowlist and only accept preview hosts
// that belong to this Vercel project and team.

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createCorsPolicy,
  normalizeOrigin,
  parseOriginList,
  DEFAULT_VERCEL_PREVIEW_PROJECT,
  DEFAULT_VERCEL_PREVIEW_TEAM,
} = require("../src/config/cors");

const PRODUCTION = "https://bookease-appointment-booking-system.vercel.app";
const GIT_MAIN = "https://bookease-appointment-booking-system-git-main-melisha.vercel.app";
const PREVIEW = "https://bookease-appointment-booking-system-6pf8hu70w-melisha.vercel.app";

const baseEnv = {
  FRONTEND_URL: PRODUCTION,
  CORS_ORIGINS: `${GIT_MAIN},https://www.bookease.example.test`,
};

test("normalizeOrigin accepts bare origins and removes a trailing slash", () => {
  assert.equal(normalizeOrigin("https://example.test/"), "https://example.test");
  assert.equal(normalizeOrigin(" https://Example.TEST "), "https://example.test");
  assert.equal(normalizeOrigin("http://localhost:5173"), "http://localhost:5173");
});

test("normalizeOrigin rejects malformed or unsafe values", () => {
  for (const value of [
    "",
    "not a url",
    "javascript:alert(1)",
    "https://user:pass@example.test",
    "https://example.test/path",
    "https://example.test/?query=1",
    "https://example.test/#fragment",
    null,
    42,
  ]) {
    assert.equal(normalizeOrigin(value), "", `expected ${JSON.stringify(value)} to be rejected`);
  }
});

test("parseOriginList splits, normalizes and drops invalid entries", () => {
  assert.deepEqual(
    parseOriginList(" https://a.test/ , bad, https://b.test "),
    ["https://a.test", "https://b.test"]
  );
});

test("explicit allowlist origins are accepted", () => {
  const policy = createCorsPolicy(baseEnv);
  assert.equal(policy.isAllowedOrigin(PRODUCTION), true);
  assert.equal(policy.isAllowedOrigin(GIT_MAIN), true);
  assert.equal(policy.isAllowedOrigin("https://www.bookease.example.test"), true);
  assert.equal(policy.isAllowedOrigin("https://unknown.example.test"), false);
});

test("default preview pattern accepts this project's deployment and branch URLs", () => {
  const policy = createCorsPolicy(baseEnv);
  assert.equal(policy.previewsEnabled, true);
  assert.equal(policy.allowedOrigins.includes(PRODUCTION), true);
  assert.equal(policy.isAllowedOrigin(PREVIEW), true);
  assert.equal(policy.isAllowedOrigin(GIT_MAIN), true);
  assert.equal(
    policy.isAllowedOrigin(
      "https://bookease-appointment-booking-system-feature-booking-flow-melisha.vercel.app"
    ),
    true
  );
  assert.equal(policy.isAllowedOrigin(PRODUCTION.toUpperCase()), true);
});

test("preview pattern rejects unrelated projects, teams and lookalike hosts", () => {
  const policy = createCorsPolicy(baseEnv);
  for (const origin of [
    "https://some-other-project.vercel.app",
    "https://bookease-appointment-booking-system.vercel.app.evil.example",
    "https://evilbookease-appointment-booking-system-6pf8hu70w-melisha.vercel.app",
    "https://bookease-appointment-booking-system-6pf8hu70w-other-team.vercel.app",
    "https://bookease-appointment-booking-system-evil.vercel.app",
    "https://bookease-appointment-booking-system--melisha.vercel.app",
    "http://bookease-appointment-booking-system-6pf8hu70w-melisha.vercel.app",
  ]) {
    assert.equal(policy.isAllowedOrigin(origin), false, `expected ${origin} to be blocked`);
  }
});

test("previews can be disabled without removing the explicit allowlist", () => {
  const policy = createCorsPolicy({ ...baseEnv, ALLOW_VERCEL_PREVIEWS: "false" });
  assert.equal(policy.previewsEnabled, false);
  assert.equal(policy.isAllowedOrigin(PREVIEW), false);
  assert.equal(policy.isAllowedOrigin(PRODUCTION), true);
  assert.equal(policy.isAllowedOrigin(GIT_MAIN), true);
});

test("preview project and team are configurable", () => {
  const policy = createCorsPolicy({
    ...baseEnv,
    VERCEL_PREVIEW_PROJECT: "my-other-project",
    VERCEL_PREVIEW_TEAM: "my-team",
    ALLOW_VERCEL_PREVIEWS: "true",
  });
  assert.equal(
    policy.isAllowedOrigin("https://my-other-project-abc123-my-team.vercel.app"),
    true
  );
  assert.equal(policy.isAllowedOrigin(PREVIEW), false);
  assert.equal(policy.isAllowedOrigin("https://my-other-project.vercel.app"), true);
});

test("missing configuration falls back to local development origins", () => {
  const policy = createCorsPolicy({});
  assert.equal(policy.isAllowedOrigin("http://localhost:5173"), true);
  assert.equal(policy.isAllowedOrigin("http://127.0.0.1:5173"), true);
  assert.equal(policy.isAllowedOrigin("https://unknown.example.test"), false);
});

test("default project and team constants match this deployment", () => {
  assert.equal(DEFAULT_VERCEL_PREVIEW_PROJECT, "bookease-appointment-booking-system");
  assert.equal(DEFAULT_VERCEL_PREVIEW_TEAM, "melisha");
});

test("only FRONTEND_URL is needed for production, git-main and previews", () => {
  // Mirrors a Render environment that only sets the production alias: the
  // git-main alias and unique deployment URLs are derived from the project
  // name and team, so they do not need separate CORS_ORIGINS entries.
  const policy = createCorsPolicy({ FRONTEND_URL: PRODUCTION });
  assert.equal(policy.isAllowedOrigin(PRODUCTION), true);
  assert.equal(policy.isAllowedOrigin(GIT_MAIN), true);
  assert.equal(policy.isAllowedOrigin(PREVIEW), true);
  assert.equal(policy.isAllowedOrigin(undefined), true);
  assert.equal(policy.isAllowedOrigin("https://evil.example.test"), false);
});

test("the production alias does not depend on the preview toggle", () => {
  const policy = createCorsPolicy({ ALLOW_VERCEL_PREVIEWS: "false" });
  assert.equal(policy.previewsEnabled, false);
  assert.equal(policy.isAllowedOrigin(PRODUCTION), true);
  assert.equal(policy.isAllowedOrigin(GIT_MAIN), false);
  assert.equal(policy.isAllowedOrigin(PREVIEW), false);
});

test("origins are normalized before matching (trailing slash, case)", () => {
  const policy = createCorsPolicy(baseEnv);
  assert.equal(policy.isAllowedOrigin(`${PRODUCTION}/`), true);
  assert.equal(policy.isAllowedOrigin(`${PREVIEW}/`), true);
  assert.equal(policy.isAllowedOrigin(PREVIEW.toUpperCase()), true);
  assert.equal(policy.isAllowedOrigin(`https://${PREVIEW}`), false);
  assert.equal(policy.isAllowedOrigin(`https://${PREVIEW}.evil.test`), false);
  assert.equal(policy.isAllowedOrigin(`https://${PREVIEW}:8443`), false);
});
