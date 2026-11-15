// CORS policy for the BookEase API.
//
// Origins are resolved once at startup:
//   1. An explicit allowlist from FRONTEND_URL and CORS_ORIGINS.
//   2. The project's production Vercel alias (https://<project>.vercel.app).
//   3. Vercel preview deployments for this project and team only, matched
//      against a strict hostname pattern:
//        https://<project>-<deployment-id-or-git-branch>-<team>.vercel.app
//
// Never allow a bare *.vercel.app wildcard: that domain is shared by every
// Vercel customer, so it would let unrelated projects call this API. The
// project and team segments are required, so lookalike hosts such as
// `<project>-evil.vercel.app` and other teams' previews stay blocked.

const DEFAULT_VERCEL_PREVIEW_PROJECT = "bookease-appointment-booking-system";
const DEFAULT_VERCEL_PREVIEW_TEAM = "melisha";

// Used only when no explicit origin is configured (local development).
const LOCAL_DEVELOPMENT_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

// Accept only a bare http(s) origin. Reject paths, credentials, queries and
// fragments so a malformed value cannot widen the allowlist.
function normalizeOrigin(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return "";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "";
  if (url.username || url.password) return "";
  if (url.pathname !== "/" || url.search || url.hash) return "";
  return url.origin;
}

function parseOriginList(value) {
  return String(value || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
}

function readBoolean(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return fallback;
  }
  return /^(1|true|yes|on)$/i.test(String(value).trim());
}

// undefined -> use the project default; an explicitly empty value disables it.
function readSetting(value, fallback) {
  if (value === undefined) return fallback;
  return String(value).trim().toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createCorsPolicy(env = process.env) {
  const explicitOrigins = [
    ...parseOriginList(env.FRONTEND_URL),
    ...parseOriginList(env.CORS_ORIGINS),
  ];
  const originSet = new Set(
    explicitOrigins.length ? explicitOrigins : LOCAL_DEVELOPMENT_ORIGINS
  );

  const previewProject = readSetting(
    env.VERCEL_PREVIEW_PROJECT,
    DEFAULT_VERCEL_PREVIEW_PROJECT
  );
  const previewTeam = readSetting(env.VERCEL_PREVIEW_TEAM, DEFAULT_VERCEL_PREVIEW_TEAM);
  const previewsEnabled = readBoolean(env.ALLOW_VERCEL_PREVIEWS, true);

  // The production alias is tied to the project name, not to whether preview
  // deployments are enabled, so register it whenever a project is configured.
  if (previewProject) {
    originSet.add(`https://${previewProject}.vercel.app`);
  }

  let previewPattern = null;
  if (previewsEnabled && previewProject && previewTeam) {
    // At least one deployment-id or git-branch segment is required between the
    // project prefix and the team suffix.
    previewPattern = new RegExp(
      `^https://${escapeRegExp(previewProject)}-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?-${escapeRegExp(
        previewTeam
      )}\\.vercel\\.app$`,
      "i"
    );
  }

  const isAllowedOrigin = (origin) => {
    // Health checks, curl and server-to-server calls do not send Origin.
    if (!origin) return true;
    const normalized = normalizeOrigin(origin);
    if (!normalized) return false;
    if (originSet.has(normalized)) return true;
    if (!previewPattern) return false;
    return previewPattern.test(normalized);
  };

  return {
    allowedOrigins: [...originSet],
    previewsEnabled: Boolean(previewPattern),
    previewPattern,
    isAllowedOrigin,
  };
}

module.exports = {
  createCorsPolicy,
  normalizeOrigin,
  parseOriginList,
  DEFAULT_VERCEL_PREVIEW_PROJECT,
  DEFAULT_VERCEL_PREVIEW_TEAM,
  LOCAL_DEVELOPMENT_ORIGINS,
};
