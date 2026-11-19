// UploadThing image upload/delete integration (server-side only).
//
// Admin-only endpoints use this service to upload a service image or specialist
// profile picture to UploadThing cloud storage, then save the returned URL in
// PostgreSQL (Service.imageUrl / Specialist.imageUrl). When an image is
// replaced, removed, or its owning record is deleted, the old file is removed
// from UploadThing too (unless another record still references the same URL).
//
// Configuration (backend environment variables):
// - UPLOADTHING_TOKEN: the token from UploadThing Dashboard -> API Keys -> V7.
//   UploadThing v7 expects the complete base64-encoded JSON token with
//   { apiKey, appId, regions }. It is read verbatim and never reconstructed.
//
// Legacy v6 secrets (UPLOADTHING_SECRET / UPLOADTHING_APP_ID) are deliberately
// NOT supported: an old secret is not a v7 token and must not be passed to the
// SDK. A missing/invalid token is a configuration problem (503), never a 502
// upload failure.
//
// There is intentionally NO local-disk fallback. If UploadThing is not
// configured, uploads fail with a clear 503 response instead of silently
// storing files on the server.

const multer = require("multer");

let UTApi;
let UTFile;
try {
  ({ UTApi, UTFile } = require("uploadthing/server"));
} catch (_err) {
  UTApi = null;
  UTFile = null;
}

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DEFAULT_MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB
const EXT_BY_MIME = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

const TOKEN_SETUP_MESSAGE =
  "Set UPLOADTHING_TOKEN in the backend environment to the token from UploadThing Dashboard -> API Keys -> V7, then restart/redeploy the backend.";
const INVALID_TOKEN_MESSAGE =
  "UPLOADTHING_TOKEN is not a valid UploadThing v7 token. Copy the complete token from UploadThing Dashboard -> API Keys -> V7 (do not use a v6 secret), then restart/redeploy the backend.";
const CONFIG_ERROR_CODES = new Set(["INVALID_SERVER_CONFIG", "MISSING_ENV"]);

const TOKEN_ISSUE_MESSAGES = {
  missing: TOKEN_SETUP_MESSAGE,
  "legacy-v6-secret":
    "UPLOADTHING_TOKEN contains a legacy v6 secret (sk_...). Open UploadThing Dashboard -> API Keys -> V7 and copy the complete V7 token instead.",
  "malformed-base64":
    "UPLOADTHING_TOKEN is not complete Base64. Copy the entire one-line V7 token and paste it without quotes, prefixes, or line breaks.",
  "not-json":
    "UPLOADTHING_TOKEN decoded to something other than JSON, so it is not an UploadThing V7 token.",
  "invalid-shape":
    "UPLOADTHING_TOKEN decoded to JSON, but it does not have the V7 fields apiKey, appId, and regions.",
  "invalid-api-key":
    "UPLOADTHING_TOKEN decoded to JSON, but apiKey is missing or is not a v7 key beginning with sk_.",
  "invalid-app-id":
    "UPLOADTHING_TOKEN decoded to JSON, but appId is missing or empty.",
  "invalid-regions":
    "UPLOADTHING_TOKEN decoded to JSON, but regions is missing or empty. Copy the complete token again.",
};

// Remove only transport artifacts (wrapping quotes, whitespace, escaped line
// breaks, and Base64URL representation). The decoded credential itself is never
// reconstructed or changed: a normal dashboard token comes back byte-for-byte.
function normalizeTokenValue(raw) {
  let token = raw == null ? "" : String(raw);
  const normalizations = [];

  const trimmed = token.trim();
  if (trimmed && trimmed !== token) normalizations.push("outer whitespace removed");
  token = trimmed;

  if (
    token.length >= 2 &&
    ((token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'")))
  ) {
    token = token.slice(1, -1).trim();
    normalizations.push("surrounding quotes removed");
  }

  if (token.includes("\\r") || token.includes("\\n")) {
    token = token.replace(/\\r/g, "").replace(/\\n/g, "");
    normalizations.push("escaped line breaks removed");
  }

  if (/\s/.test(token)) {
    token = token.replace(/\s+/g, "");
    normalizations.push("embedded whitespace removed");
  }

  // A raw v6 secret is a plain-text credential string, not a v7 token. Detect
  // it before any Base64URL conversion so underscores in secrets are preserved
  // for the diagnostic and the secret is never decoded/passed to the SDK.
  const rawLegacySecret = /^sk_/i.test(token);

  // UploadThing v7's SDK decodes standard Base64 only. A token copied from a
  // URL-safe source can still be used by converting the representation, not
  // by inventing any credential data.
  if (!rawLegacySecret && /^[A-Za-z0-9_-]+={0,2}$/.test(token) && /[-_]/.test(token)) {
    token = token.replace(/-/g, "+").replace(/_/g, "/");
    normalizations.push("Base64URL representation converted to standard Base64");
  }

  if (/^[A-Za-z0-9+/]+={0,2}$/.test(token) && token.length % 4 !== 0) {
    token += "=".repeat(4 - (token.length % 4));
    normalizations.push("Base64 padding restored");
  }

  return { token, normalizations };
}

// Canonical standard Base64, matching the SDK's Uint8ArrayFromBase64 schema.
const STANDARD_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function decodeBase64Json(token) {
  if (!STANDARD_BASE64.test(token)) return null;
  try {
    return JSON.parse(Buffer.from(token, "base64").toString("utf8"));
  } catch (_err) {
    return null;
  }
}

function tokenDiagnostic(issue, normalizations) {
  const base = TOKEN_ISSUE_MESSAGES[issue] || INVALID_TOKEN_MESSAGE;
  if (!normalizations.length) return base;
  return `${base} Safe normalization applied before validation: ${normalizations.join("; ")}.`;
}

// Validates the exact shape required by uploadthing v7's own config schema:
// base64(JSON({ apiKey: "sk_...", appId: string, regions: [string, ...] })).
function analyzeToken(raw) {
  const { token, normalizations } = normalizeTokenValue(raw);
  const result = { token, decoded: null, issue: "", normalizations, diagnostic: "" };

  if (!token) {
    result.issue = "missing";
    result.diagnostic = tokenDiagnostic("missing", normalizations);
    return result;
  }

  // A raw v6 secret is the most common wrong value. Never pass it to the SDK.
  if (/^sk_/i.test(token)) {
    result.issue = "legacy-v6-secret";
    // Keep the diagnostic secret-free: report the class of mistake only.
    result.normalizations = normalizations.filter(
      (n) => n !== "Base64URL representation converted to standard Base64" && n !== "Base64 padding restored"
    );
    result.diagnostic = tokenDiagnostic("legacy-v6-secret", result.normalizations);
    return result;
  }

  const parsed = decodeBase64Json(token);
  if (parsed === null) {
    result.issue = /^[A-Za-z0-9+/]+={0,2}$/.test(token) ? "not-json" : "malformed-base64";
    result.diagnostic = tokenDiagnostic(result.issue, normalizations);
    return result;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    result.issue = "invalid-shape";
  } else if (typeof parsed.apiKey !== "string" || !parsed.apiKey.startsWith("sk_")) {
    result.issue = "invalid-api-key";
  } else if (typeof parsed.appId !== "string" || !parsed.appId.trim()) {
    result.issue = "invalid-app-id";
  } else if (
    !Array.isArray(parsed.regions) ||
    parsed.regions.length === 0 ||
    !parsed.regions.every((region) => typeof region === "string" && region.trim())
  ) {
    result.issue = "invalid-regions";
  } else {
    result.decoded = parsed;
    result.diagnostic = normalizations.length
      ? `Valid V7 token. Safe normalization applied: ${normalizations.join("; ")}.`
      : "Valid V7 token.";
    return result;
  }

  result.diagnostic = tokenDiagnostic(result.issue, normalizations);
  return result;
}

function isUploadThingConfigError(err) {
  if (!err) return false;
  if (CONFIG_ERROR_CODES.has(err.code)) return true;
  const message = String(err.message || "");
  return /invalid token|missing token|invalid_server_config|missing_env/i.test(message);
}

function getUploadThingConfig() {
  // Exactly one source of truth: the v7 token issued by UploadThing. Legacy
  // v6 variables are intentionally ignored so an old secret can never be used
  // as a v7 token.
  const analysis = analyzeToken(process.env.UPLOADTHING_TOKEN);
  const { token, decoded } = analysis;
  const sdkAvailable = Boolean(UTApi && UTFile);
  const configured = Boolean(token);

  let error = "";
  if (!configured || !decoded) error = analysis.diagnostic;
  else if (!sdkAvailable) error = "The UploadThing server SDK is not available. Run npm install in the backend.";

  return {
    token,
    source: configured ? "token" : "none",
    configured,
    tokenValid: Boolean(decoded),
    enabled: Boolean(configured && decoded && sdkAvailable),
    sdkAvailable,
    error,
    tokenIssue: analysis.issue,
    normalizations: analysis.normalizations,
    diagnostic: error || analysis.diagnostic,
    appId: decoded?.appId || null,
    region: decoded?.regions?.[0] || null,
    maxBytes: DEFAULT_MAX_IMAGE_BYTES,
    allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
  };
}

// Logs only a safe, secret-free explanation of a configuration problem.
function logConfigurationIssue(config, context) {
  if (config.configured && !config.enabled && config.diagnostic) {
    console.error(`[upload] ${context}: ${config.diagnostic}`);
  }
}

function hasValidMagicBytes(buffer, mimetype) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 3) return false;
  if (mimetype === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimetype === "image/png") {
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(signature);
  }
  if (mimetype === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    );
  }
  return false;
}

function validateImageFile(file) {
  if (!file) {
    return { ok: false, status: 400, message: "An image file is required (field name: image)." };
  }
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
    return {
      ok: false,
      status: 400,
      message: "Invalid image type. Allowed types: JPG, JPEG, PNG, WEBP.",
    };
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, status: 400, message: "Invalid image file." };
  }
  if (file.size > DEFAULT_MAX_IMAGE_BYTES) {
    return { ok: false, status: 400, message: "Image is too large. Maximum size is 4 MB." };
  }
  if (!file.buffer || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    return { ok: false, status: 400, message: "Invalid image data." };
  }
  if (!hasValidMagicBytes(file.buffer, file.mimetype)) {
    return {
      ok: false,
      status: 400,
      message: "The selected file is not a valid JPG, PNG, or WEBP image.",
    };
  }
  return { ok: true };
}

// Multer memory storage: the buffer is streamed to UploadThing by uploadImage().
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DEFAULT_MAX_IMAGE_BYTES, files: 1 },
  fileFilter(_req, file, callback) {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      const error = new Error("Invalid image type. Allowed types: JPG, JPEG, PNG, WEBP.");
      error.status = 400;
      callback(error);
      return;
    }
    callback(null, true);
  },
});

function imageUploadMiddleware(req, res, next) {
  const single = memoryUpload.single("image");
  single(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: `Image is too large. Maximum size is ${Math.round(DEFAULT_MAX_IMAGE_BYTES / (1024 * 1024))} MB.`,
        });
      }
      return res.status(400).json({ success: false, message: err.message || "Invalid upload." });
    }
    return res.status(400).json({ success: false, message: err.message || "Upload failed." });
  });
}

function extractUploadedUrl(result) {
  const item = Array.isArray(result) ? result[0] : result;
  if (!item || item.error) return null;
  const data = item.data || item;
  return data.ufsUrl || data.url || data.appUrl || data.fileUrl || null;
}

// UploadThing serves files from utfs.io (legacy) and *.ufs.sh (v7).
// Only files on these official hosts are ever sent to deleteFiles(). Seed data
// and any other externally hosted image is deliberately left untouched.
const UPLOADTHING_HOSTS = new Set(["utfs.io", "ufs.sh"]);

function isUploadThingHost(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
  if (!host) return false;
  return UPLOADTHING_HOSTS.has(host) || host.endsWith(".ufs.sh");
}

function isSafeUploadThingKey(key) {
  if (typeof key !== "string") return false;
  const trimmed = key.trim();
  if (!trimmed || trimmed.length > 512) return false;
  if (trimmed === "." || trimmed === "..") return false;
  if (trimmed.includes("/") || trimmed.includes("\\")) return false;
  // Reject control characters, which can never be part of a real file key.
  return !/[\u0000-\u001f\u007f]/.test(trimmed);
}

// Parses a stored image URL into an UploadThing file key.
// Returns { ok: true, key, host } for supported official URLs, or
// { ok: false, reason } for missing/external/invalid URLs.
function parseUploadThingImageUrl(imageUrl) {
  if (imageUrl == null || typeof imageUrl !== "string" || !imageUrl.trim()) {
    return { ok: false, reason: "missing-url" };
  }

  let parsed;
  try {
    parsed = new URL(imageUrl.trim());
  } catch (_err) {
    return { ok: false, reason: "invalid-url" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, reason: "invalid-url" };
  }

  const host = parsed.hostname.toLowerCase();
  if (!isUploadThingHost(host)) {
    return { ok: false, reason: "external-url", host };
  }

  // Official URLs use https://<host>/f/<fileKey>. Reject any other path shape
  // so we never guess a key and accidentally delete an unrelated file.
  const match = /^\/f\/([^/]+)\/?$/.exec(parsed.pathname);
  if (!match) {
    return { ok: false, reason: "unsupported-path", host };
  }

  let key;
  try {
    key = decodeURIComponent(match[1]);
  } catch (_err) {
    return { ok: false, reason: "invalid-key", host };
  }

  if (!isSafeUploadThingKey(key)) {
    return { ok: false, reason: "invalid-key", host };
  }

  return { ok: true, key, host };
}

// Extracts the UploadThing file key from a stored image URL, or null when the
// URL is missing, invalid, or not hosted by UploadThing.
function extractUploadThingKey(imageUrl) {
  const parsed = parseUploadThingImageUrl(imageUrl);
  return parsed.ok ? parsed.key : null;
}

// Deletes one file from UploadThing cloud storage.
//
// Result shapes:
// - { ok: true, deleted: true, key }            file deleted
// - { ok: true, deleted: false, skipped: true } nothing to delete (missing or
//                                               externally hosted image)
// - { ok: true, deleted: false, notFound: true } UploadThing says it is gone
// - { ok: false, status, message }               configuration/API failure
async function deleteImageFromUploadThing(imageUrl) {
  const parsed = parseUploadThingImageUrl(imageUrl);

  if (!parsed.ok) {
    if (parsed.reason === "missing-url") {
      return {
        ok: true,
        deleted: false,
        skipped: true,
        reason: "missing-url",
        message: "No image URL was stored.",
      };
    }
    if (parsed.reason === "external-url") {
      return {
        ok: true,
        deleted: false,
        skipped: true,
        reason: "external-url",
        message: "The image is not hosted on UploadThing, so no cloud file was deleted.",
      };
    }
    if (parsed.reason === "invalid-url") {
      return {
        ok: true,
        deleted: false,
        skipped: true,
        reason: "invalid-url",
        message: "The stored image URL is invalid, so no cloud file was deleted.",
      };
    }
    // The URL is on an UploadThing host but we cannot determine a safe key.
    return {
      ok: false,
      status: 422,
      deleted: false,
      reason: parsed.reason,
      message:
        "The stored image URL is an UploadThing URL, but its file key could not be determined safely. " +
        "The cloud file was not deleted; check the UploadThing dashboard and the stored URL.",
    };
  }

  const config = getUploadThingConfig();
  if (!config.enabled) {
    logConfigurationIssue(config, "image deletion unavailable");
    return {
      ok: false,
      status: 503,
      code: config.tokenIssue || "UPLOADTHING_SDK_MISSING",
      deleted: false,
      key: parsed.key,
      message: `Image deletion is unavailable: ${config.error}`,
    };
  }

  try {
    const utapi = new UTApi({ token: config.token });
    const result = await utapi.deleteFiles(parsed.key);

    if (!result || result.success !== true) {
      return {
        ok: false,
        status: 502,
        deleted: false,
        key: parsed.key,
        message:
          "UploadThing did not confirm deletion of the image. " +
          "The file may still exist in the UploadThing dashboard.",
      };
    }

    const deletedCount = Number(result.deletedCount) || 0;
    if (deletedCount === 0) {
      return {
        ok: true,
        deleted: false,
        notFound: true,
        key: parsed.key,
        message:
          "UploadThing reported that the image was not found; it may already have been deleted.",
      };
    }

    return { ok: true, deleted: true, key: parsed.key, deletedCount };
  } catch (err) {
    // Log only a safe error code/name. Never log tokens, API keys, or raw
    // provider messages that could contain credentials.
    console.error(
      "[upload] UploadThing delete failed:",
      (err && (err.code || err.name)) || "Unknown error"
    );
    if (isUploadThingConfigError(err)) {
      return { ok: false, status: 503, deleted: false, key: parsed.key, message: INVALID_TOKEN_MESSAGE };
    }
    return {
      ok: false,
      status: 502,
      deleted: false,
      key: parsed.key,
      message:
        "Image deletion failed. The file may still exist in UploadThing; " +
        "check the dashboard and try again.",
    };
  }
}

function safeFileName(file) {
  const ext = EXT_BY_MIME[file.mimetype] || "";
  const raw = String(file.originalname || "image")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-100);
  const base = raw && raw !== "." && raw !== ".." ? raw : `image-${Date.now()}`;
  if (ext && !base.toLowerCase().endsWith(ext)) {
    return `${base.replace(/\.[^.]+$/, "") || `image-${Date.now()}`}${ext}`;
  }
  return base;
}

async function uploadImage(file) {
  const validation = validateImageFile(file);
  if (!validation.ok) return validation;

  const config = getUploadThingConfig();

  if (!config.enabled) {
    // Missing/invalid v7 token and a missing SDK are backend configuration
    // problems. They must never be reported as a failed upload (502).
    logConfigurationIssue(config, "image upload unavailable");
    return {
      ok: false,
      status: 503,
      code: config.tokenIssue || "UPLOADTHING_SDK_MISSING",
      message: `Image uploads are unavailable: ${config.error}`,
    };
  }

  try {
    const utapi = new UTApi({ token: config.token });
    const utFile = new UTFile([file.buffer], safeFileName(file), { type: file.mimetype });
    const result = await utapi.uploadFiles(utFile);
    const item = Array.isArray(result) ? result[0] : result;

    if (item && item.error) {
      if (isUploadThingConfigError(item.error)) {
        return { ok: false, status: 503, message: `Image uploads are unavailable: ${INVALID_TOKEN_MESSAGE}` };
      }
      const msg = item.error.message || item.error.code || "Image upload failed.";
      return { ok: false, status: 502, message: `Image upload failed: ${msg}` };
    }

    const url = extractUploadedUrl(result);
    if (!url) {
      return { ok: false, status: 502, message: "Image upload did not return a URL." };
    }

    return {
      ok: true,
      url,
      key: (item && item.data && item.data.key) || null,
      storage: "uploadthing",
    };
  } catch (err) {
    // Log only a safe error code/name. Never log tokens, API keys, or raw
    // provider messages that could contain credentials.
    console.error(
      "[upload] UploadThing upload failed:",
      (err && (err.code || err.name)) || "Unknown error"
    );
    if (isUploadThingConfigError(err)) {
      return {
        ok: false,
        status: 503,
        message: `Image uploads are unavailable: ${INVALID_TOKEN_MESSAGE}`,
      };
    }
    return {
      ok: false,
      status: 502,
      message: "Image upload failed. Please try again.",
    };
  }
}

// Backward-compatible export name used by the catalog controllers/tests.
async function uploadImageToUploadThing(file) {
  return uploadImage(file);
}

module.exports = {
  ALLOWED_IMAGE_MIME_TYPES,
  DEFAULT_MAX_IMAGE_BYTES,
  getUploadThingConfig,
  isUploadThingConfigError,
  imageUploadMiddleware,
  validateImageFile,
  uploadImage,
  uploadImageToUploadThing,
  extractUploadedUrl,
  safeFileName,
  deleteImageFromUploadThing,
  extractUploadThingKey,
  parseUploadThingImageUrl,
  isUploadThingHost,
};
