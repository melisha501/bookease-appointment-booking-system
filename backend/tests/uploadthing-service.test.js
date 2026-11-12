// Upload service tests (no network, no real credentials).
// Verifies validation, safe configuration handling, the UploadThing-only upload
// path, legacy SECRET + APP_ID support, and provider failure handling.

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

function legacyToken(secret, appId, region = "sea1") {
  return Buffer.from(JSON.stringify({ apiKey: secret, appId, regions: [region] }), "utf8").toString(
    "base64"
  );
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

test("uploadImageToUploadThing returns 503 when no credentials are configured", async () => {
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
    assert.match(result.message, /UPLOADTHING_SECRET/i);
    assert.match(result.message, /UPLOADTHING_APP_ID/i);
  } finally {
    svc.restore();
  }
});

test("legacy SECRET + APP_ID are combined into a v7 token and used for uploads", async () => {
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

  const svc = loadUploadService({
    uploadthingServerModule: { UTApi: UTApiMock, UTFile: UTFileMock },
    env: {
      UPLOADTHING_SECRET: "ut_secret_test",
      UPLOADTHING_APP_ID: "ut_app_test",
      UPLOADTHING_REGION: "lhr1",
    },
  });
  try {
    const result = await svc.uploadImageToUploadThing(
      file({ originalname: "my photo.webp", mimetype: "image/webp" })
    );
    assert.equal(result.ok, true);
    assert.equal(result.url, "https://app.ufs.sh/f/test-key.png");
    assert.equal(result.key, "test-key");
    assert.equal(result.storage, "uploadthing");
    assert.equal(seen.f.name, "my-photo.webp");
    assert.equal(seen.f.type, "image/webp");

    const decoded = JSON.parse(Buffer.from(seen.token, "base64").toString("utf8"));
    assert.equal(decoded.apiKey, "ut_secret_test");
    assert.equal(decoded.appId, "ut_app_test");
    assert.deepEqual(decoded.regions, ["lhr1"]);
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

  const token = legacyToken("ut_direct_key", "ut_direct_app");
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
    env: { UPLOADTHING_SECRET: "ut_secret_test", UPLOADTHING_APP_ID: "ut_app_test" },
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
    env: { UPLOADTHING_SECRET: "ut_secret_test", UPLOADTHING_APP_ID: "ut_app_test" },
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

test("getUploadThingConfig reports configuration sources without exposing the token", () => {
  const svc = loadUploadService({
    uploadthingServerModule: { UTApi: class {}, UTFile: class {} },
    env: { UPLOADTHING_SECRET: "ut_secret_test", UPLOADTHING_APP_ID: "ut_app_test" },
  });
  try {
    const config = svc.getUploadThingConfig();
    assert.equal(config.configured, true);
    assert.equal(config.enabled, true);
    assert.equal(config.source, "legacy");
    assert.equal(config.appId, "ut_app_test");
    assert.ok(config.token);
    assert.equal(Object.prototype.hasOwnProperty.call(config, "apiKey"), false);
  } finally {
    svc.restore();
  }
});
