// Upload service tests (no network, no real credentials).
// Verifies validation, safe configuration handling, v7-token-only uploads,
// and correct classification of configuration vs provider failures.

const test = require("node:test");
const assert = require("node:assert/strict");

const ENV_KEYS = [
  "UPLOADTHING_TOKEN",
  "UPLOADTHING_SECRET",
  "UPLOADTHING_APP_ID",
  "UPLOADTHING_REGION",
];

function loadUploadService({ uploadthingServerModule, env = {} } = {}) {
  const servicePath = require.resolve("../src/services/uploadthingService");
  delete require.cache[servicePath];

  const previous = {};
  for (const key of ENV_KEYS) {
    previous[key] = process.env[key];
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(env)) process.env[key] = value;

  let utPath;
  try {
    utPath = require.resolve("uploadthing/server");
  } catch {
    utPath = null;
  }
  const prevUt = utPath ? require.cache[utPath] : undefined;
  if (utPath && uploadthingServerModule) {
    require.cache[utPath] = {
      id: utPath,
      filename: utPath,
      loaded: true,
      exports: uploadthingServerModule,
    };
  } else if (utPath && uploadthingServerModule === null) {
    delete require.cache[utPath];
  }

  const mod = require("../src/services/uploadthingService");

  function restore() {
    delete require.cache[servicePath];
    if (utPath) {
      if (prevUt === undefined) delete require.cache[utPath];
      else require.cache[utPath] = prevUt;
    }
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }

  return { ...mod, restore };
}

function imageBuffer(mimetype) {
  if (mimetype === "image/jpeg") {
    return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  }
  if (mimetype === "image/webp") {
    return Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.from([0x20, 0x00, 0x00, 0x00]),
      Buffer.from("WEBP", "ascii"),
      Buffer.from([0x56, 0x50, 0x38, 0x20]),
    ]);
  }
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
}

function file(overrides = {}) {
  const mimetype = overrides.mimetype ?? "image/png";
  const buffer = overrides.buffer ?? imageBuffer(mimetype);
  return {
    originalname: "photo.png",
    mimetype,
    size: buffer.length,
    buffer,
    ...overrides,
  };
}

// Shape-only fixture matching the v7 SDK schema. Not a real credential.
function v7Token(apiKey = "sk_test_key", appId = "ut_app_test", regions = ["sea1"]) {
  return Buffer.from(JSON.stringify({ apiKey, appId, regions }), "utf8").toString("base64");
}

test("validateImageFile rejects missing file, bad type, bad image data, and large size", () => {
  const { validateImageFile, restore } = loadUploadService({ env: {} });
  try {
    assert.equal(validateImageFile(null).ok, false);
    assert.equal(validateImageFile(file({ mimetype: "application/pdf" })).ok, false);
    assert.match(validateImageFile(file({ mimetype: "application/pdf" })).message, /Invalid image type/i);
    assert.equal(
      validateImageFile(file({ mimetype: "image/png", buffer: Buffer.from("not-an-image") })).ok,
      false
    );
    assert.match(
      validateImageFile(file({ mimetype: "image/png", buffer: Buffer.from("not-an-image") })).message,
      /not a valid/i
    );
    assert.equal(validateImageFile(file({ size: 10 * 1024 * 1024 })).ok, false);
    assert.match(validateImageFile(file({ size: 10 * 1024 * 1024 })).message, /too large/i);
    assert.equal(validateImageFile(file()).ok, true);
    assert.equal(validateImageFile(file({ mimetype: "image/jpeg" })).ok, true);
    assert.equal(validateImageFile(file({ mimetype: "image/webp" })).ok, true);
  } finally {
    restore();
  }
});

test("uploadImageToUploadThing returns 503 when UPLOADTHING_TOKEN is missing", async () => {
  class UTFileMock {}
  class UTApiMock {
    async uploadFiles() {
      throw new Error("should not call");
    }
  }
  const svc = loadUploadService({ uploadthingServerModule: { UTApi: UTApiMock, UTFile: UTFileMock } });
  try {
    const result = await svc.uploadImageToUploadThing(file());
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    assert.match(result.message, /UPLOADTHING_TOKEN/i);
    assert.match(result.message, /V7/i);
  } finally {
    svc.restore();
  }
});

test("legacy v6 SECRET + APP_ID are ignored and never converted into a v7 token", async () => {
  let called = false;
  class UTFileMock {}
  class UTApiMock {
    async uploadFiles() {
      called = true;
      return { data: { ufsUrl: "https://app.ufs.sh/f/test-key.png" } };
    }
  }
  const svc = loadUploadService({
    uploadthingServerModule: { UTApi: UTApiMock, UTFile: UTFileMock },
    env: {
      UPLOADTHING_SECRET: "ut_secret_test",
      UPLOADTHING_APP_ID: "ut_app_test",
      UPLOADTHING_REGION: "lhr1",
    },
  });
  try {
    const result = await svc.uploadImageToUploadThing(file());
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    assert.equal(called, false);
    assert.doesNotMatch(result.message, /ut_secret_test/);
  } finally {
    svc.restore();
  }
});

test("an invalid v7 token is a 503 configuration error and never reaches the SDK", async () => {
  let called = false;
  class UTFileMock {}
  class UTApiMock {
    constructor(opts) {
      assert.equal(opts.token, undefined);
    }
    async uploadFiles() {
      called = true;
      return { data: { ufsUrl: "https://app.ufs.sh/f/test-key.png" } };
    }
  }

  // Raw v6 secret accidentally placed in UPLOADTHING_TOKEN.
  const rawSecret = loadUploadService({
    uploadthingServerModule: { UTApi: UTApiMock, UTFile: UTFileMock },
    env: { UPLOADTHING_TOKEN: "sk_live_old_v6_secret" },
  });
  try {
    const result = await rawSecret.uploadImageToUploadThing(file());
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    assert.match(result.message, /v7 token/i);
    assert.equal(called, false);
  } finally {
    rawSecret.restore();
  }

  // Base64 JSON with an apiKey that does not match the v7 SDK schema.
  const badShape = loadUploadService({
    uploadthingServerModule: { UTApi: UTApiMock, UTFile: UTFileMock },
    env: { UPLOADTHING_TOKEN: v7Token("re_not_an_uploadthing_key", "ut_app_test", []) },
  });
  try {
    const result = await badShape.uploadImageToUploadThing(file());
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    assert.match(result.message, /v7 token/i);
    assert.equal(called, false);
  } finally {
    badShape.restore();
  }
});

test("a valid v7 token is used verbatim for uploads", async () => {
  let seen;
  class UTFileMock {
    constructor(parts, name, opts) {
      this.parts = parts;
      this.name = name;
      this.type = opts?.type;
    }
  }
  class UTApiMock {
    constructor(opts) {
      this.opts = opts;
    }
    async uploadFiles(f) {
      seen = { f, token: this.opts.token };
      return {
        data: { ufsUrl: "https://app.ufs.sh/f/test-key.png", key: "test-key" },
        error: null,
      };
    }
  }

  const token = v7Token("sk_test_key", "ut_app_test", ["lhr1"]);
  const svc = loadUploadService({
    uploadthingServerModule: { UTApi: UTApiMock, UTFile: UTFileMock },
    env: { UPLOADTHING_TOKEN: token },
  });
  try {
    const result = await svc.uploadImageToUploadThing(
      file({ originalname: "my photo.webp", mimetype: "image/webp" })
    );
    assert.equal(result.ok, true);
    assert.equal(result.url, "https://app.ufs.sh/f/test-key.png");
    assert.equal(result.key, "test-key");
    assert.equal(result.storage, "uploadthing");
    assert.equal(seen.token, token);
    assert.equal(seen.f.name, "my-photo.webp");
    assert.equal(seen.f.type, "image/webp");
  } finally {
    svc.restore();
  }
});

test("UPLOADTHING_TOKEN is used directly and returns the uploaded URL", async () => {
  let seen;
  class UTFileMock {
    constructor(parts, name, opts) {
      this.name = name;
      this.type = opts?.type;
    }
  }
  class UTApiMock {
    constructor(opts) {
      this.opts = opts;
    }
    async uploadFiles(f) {
      seen = { f, token: this.opts.token };
      return { data: { url: "https://utfs.io/f/test-key.png", key: "test-key" }, error: null };
    }
  }

  const token = v7Token("sk_test_direct_key", "ut_direct_app");
  const svc = loadUploadService({
    uploadthingServerModule: { UTApi: UTApiMock, UTFile: UTFileMock },
    env: { UPLOADTHING_TOKEN: token },
  });
  try {
    const result = await svc.uploadImageToUploadThing(
      file({ originalname: "a.webp", mimetype: "image/webp" })
    );
    assert.equal(result.ok, true);
    assert.equal(result.url, "https://utfs.io/f/test-key.png");
    assert.equal(seen.token, token);
    assert.equal(seen.f.name, "a.webp");
    assert.equal(seen.f.type, "image/webp");
  } finally {
    svc.restore();
  }
});

test("uploadImageToUploadThing handles provider errors safely", async () => {
  class UTFileMock {}
  class UTApiMock {
    async uploadFiles() {
      return { data: null, error: { message: "quota exceeded" } };
    }
  }
  const svc = loadUploadService({
    uploadthingServerModule: { UTApi: UTApiMock, UTFile: UTFileMock },
    env: { UPLOADTHING_TOKEN: v7Token() },
  });
  try {
    const result = await svc.uploadImageToUploadThing(file());
    assert.equal(result.ok, false);
    assert.equal(result.status, 502);
    assert.match(result.message, /quota exceeded/i);
  } finally {
    svc.restore();
  }
});

test("uploadImageToUploadThing hides thrown provider errors and never returns a token", async () => {
  class UTFileMock {}
  class UTApiMock {
    async uploadFiles() {
      throw new Error("network down: secret-value-should-not-leak");
    }
  }
  const svc = loadUploadService({
    uploadthingServerModule: { UTApi: UTApiMock, UTFile: UTFileMock },
    env: { UPLOADTHING_TOKEN: v7Token() },
  });
  try {
    const result = await svc.uploadImageToUploadThing(file());
    assert.equal(result.ok, false);
    assert.equal(result.status, 502);
    assert.match(result.message, /Image upload failed/i);
    assert.doesNotMatch(result.message, /secret-value-should-not-leak/);
    assert.doesNotMatch(result.message, /ut_secret_test/);
  } finally {
    svc.restore();
  }
});

test("getUploadThingConfig reports v7 token status without exposing the token", () => {
  const svc = loadUploadService({
    uploadthingServerModule: { UTApi: class {}, UTFile: class {} },
    env: { UPLOADTHING_TOKEN: v7Token("sk_test_key", "ut_app_test", ["lhr1"]) },
  });
  try {
    const config = svc.getUploadThingConfig();
    assert.equal(config.configured, true);
    assert.equal(config.tokenValid, true);
    assert.equal(config.enabled, true);
    assert.equal(config.source, "token");
    assert.equal(config.appId, "ut_app_test");
    assert.equal(config.region, "lhr1");
    assert.ok(config.token);
    assert.equal(Object.prototype.hasOwnProperty.call(config, "apiKey"), false);
  } finally {
    svc.restore();
  }
});

test("SDK configuration errors are reported as 503 instead of 502", async () => {
  class UTFileMock {}
  class UTApiMock {
    async uploadFiles() {
      return {
        data: null,
        error: {
          code: "INVALID_SERVER_CONFIG",
          message:
            "Invalid token. A token is a base64 encoded JSON object matching { apiKey: string, appId: string, regions: string[] }.",
        },
      };
    }
  }
  const svc = loadUploadService({
    uploadthingServerModule: { UTApi: UTApiMock, UTFile: UTFileMock },
    env: { UPLOADTHING_TOKEN: v7Token() },
  });
  try {
    const result = await svc.uploadImageToUploadThing(file());
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    assert.match(result.message, /v7 token/i);
  } finally {
    svc.restore();
  }
});

test("extractUploadThingKey reads official URLs and rejects anything unsafe", () => {
  const svc = loadUploadService({ env: {} });
  try {
    assert.equal(svc.extractUploadThingKey("https://utfs.io/f/2e0fdb64_image.jpg"), "2e0fdb64_image.jpg");
    assert.equal(
      svc.extractUploadThingKey("https://myapp.ufs.sh/f/1649353b_image2.jpg?foo=1"),
      "1649353b_image2.jpg"
    );
    assert.equal(
      svc.extractUploadThingKey("https://myapp.ufs.sh/f/key%20with%20space.png"),
      "key with space.png"
    );

    assert.equal(svc.extractUploadThingKey(null), null);
    assert.equal(svc.extractUploadThingKey(""), null);
    assert.equal(svc.extractUploadThingKey("not a url"), null);
    assert.equal(svc.extractUploadThingKey("https://images.unsplash.com/photo-123"), null);
    assert.equal(svc.extractUploadThingKey("https://evil.example/f/key.png"), null);
    assert.equal(svc.extractUploadThingKey("https://myapp.ufs.sh/f/a/extra.png"), null);
    assert.equal(svc.extractUploadThingKey("https://myapp.ufs.sh/f/..%2Fescape.png"), null);
  } finally {
    svc.restore();
  }
});

test("deleteImageFromUploadThing returns 503 when credentials are missing", async () => {
  class UTApiMock {
    async deleteFiles() {
      throw new Error("should not call");
    }
  }
  const svc = loadUploadService({
    uploadthingServerModule: { UTApi: UTApiMock, UTFile: class {} },
    env: {},
  });
  try {
    const result = await svc.deleteImageFromUploadThing("https://utfs.io/f/test-key.png");
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    assert.match(result.message, /UPLOADTHING_TOKEN/i);
  } finally {
    svc.restore();
  }
});

test("deleteImageFromUploadThing deletes only the extracted key via UTApi", async () => {
  let seen;
  class UTApiMock {
    constructor(opts) {
      this.opts = opts;
    }
    async deleteFiles(key) {
      seen = { key, token: this.opts.token };
      return { success: true, deletedCount: 1 };
    }
  }
  const token = v7Token();
  const svc = loadUploadService({
    uploadthingServerModule: { UTApi: UTApiMock, UTFile: class {} },
    env: { UPLOADTHING_TOKEN: token },
  });
  try {
    const result = await svc.deleteImageFromUploadThing(
      "https://myapp.ufs.sh/f/2e0fdb64_image.jpg"
    );
    assert.equal(result.ok, true);
    assert.equal(result.deleted, true);
    assert.equal(result.key, "2e0fdb64_image.jpg");
    assert.equal(seen.key, "2e0fdb64_image.jpg");
    assert.equal(seen.token, token);
  } finally {
    svc.restore();
  }
});

test("deleteImageFromUploadThing skips external and missing URLs without calling the SDK", async () => {
  let called = false;
  class UTApiMock {
    async deleteFiles() {
      called = true;
      return { success: true, deletedCount: 1 };
    }
  }
  const svc = loadUploadService({
    uploadthingServerModule: { UTApi: UTApiMock, UTFile: class {} },
    env: { UPLOADTHING_TOKEN: v7Token() },
  });
  try {
    const external = await svc.deleteImageFromUploadThing("https://images.unsplash.com/photo-123");
    assert.equal(external.ok, true);
    assert.equal(external.deleted, false);
    assert.equal(external.skipped, true);
    assert.equal(external.reason, "external-url");

    const missing = await svc.deleteImageFromUploadThing(null);
    assert.equal(missing.ok, true);
    assert.equal(missing.skipped, true);
    assert.equal(missing.reason, "missing-url");

    const invalid = await svc.deleteImageFromUploadThing("https://myapp.ufs.sh/not-a-file");
    assert.equal(invalid.ok, false);
    assert.equal(invalid.reason, "unsupported-path");

    assert.equal(called, false);
  } finally {
    svc.restore();
  }
});

test("deleteImageFromUploadThing reports already-missing files honestly", async () => {
  class UTApiMock {
    async deleteFiles() {
      return { success: true, deletedCount: 0 };
    }
  }
  const svc = loadUploadService({
    uploadthingServerModule: { UTApi: UTApiMock, UTFile: class {} },
    env: { UPLOADTHING_TOKEN: v7Token() },
  });
  try {
    const result = await svc.deleteImageFromUploadThing("https://utfs.io/f/already-gone.png");
    assert.equal(result.ok, true);
    assert.equal(result.deleted, false);
    assert.equal(result.notFound, true);
    assert.match(result.message, /not found/i);
  } finally {
    svc.restore();
  }
});

test("deleteImageFromUploadThing handles provider refusal and thrown errors safely", async () => {
  class RefusingUTApi {
    async deleteFiles() {
      return { success: false, deletedCount: 0 };
    }
  }
  const refused = loadUploadService({
    uploadthingServerModule: { UTApi: RefusingUTApi, UTFile: class {} },
    env: { UPLOADTHING_TOKEN: v7Token() },
  });
  try {
    const result = await refused.deleteImageFromUploadThing("https://utfs.io/f/test-key.png");
    assert.equal(result.ok, false);
    assert.equal(result.status, 502);
    assert.match(result.message, /did not confirm deletion/i);
  } finally {
    refused.restore();
  }

  class ThrowingUTApi {
    async deleteFiles() {
      throw new Error("network down: secret-value-should-not-leak");
    }
  }
  const thrown = loadUploadService({
    uploadthingServerModule: { UTApi: ThrowingUTApi, UTFile: class {} },
    env: { UPLOADTHING_TOKEN: v7Token() },
  });
  try {
    const result = await thrown.deleteImageFromUploadThing("https://utfs.io/f/test-key.png");
    assert.equal(result.ok, false);
    assert.equal(result.status, 502);
    assert.match(result.message, /Image deletion failed/i);
    assert.doesNotMatch(result.message, /secret-value-should-not-leak/);
    assert.doesNotMatch(result.message, /ut_secret_test/);
  } finally {
    thrown.restore();
  }
});
