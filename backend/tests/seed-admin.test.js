// Admin bootstrap tests for the seed script. The seed must create an admin only
// from environment variables, never reset an existing password, and never print
// the password to logs.

const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

const prismaPath = require.resolve("../src/lib/prisma");
const seedPath = require.resolve("../src/seed");

function loadSeed(prismaMock) {
  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: prismaMock,
  };
  delete require.cache[seedPath];
  return require(seedPath);
}

function saveEnv() {
  return { ...process.env };
}

function restoreEnv(previous) {
  for (const key of Object.keys(process.env)) {
    if (!(key in previous)) delete process.env[key];
  }
  Object.assign(process.env, previous);
}

async function captureLogs(run) {
  const original = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.map(String).join(" "));
  try {
    await run();
  } finally {
    console.log = original;
  }
  return lines.join("\n");
}

test("production bootstrap fails clearly when admin env vars are missing", async () => {
  const previous = saveEnv();
  try {
    process.env.NODE_ENV = "production";
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;

    const seed = loadSeed({});
    await assert.rejects(
      () => seed.bootstrapAdmin(),
      /Production admin bootstrap requires ADMIN_EMAIL and ADMIN_PASSWORD/
    );
  } finally {
    restoreEnv(previous);
  }
});

test("bootstrap creates an admin from env vars and never logs the password", async () => {
  const previous = saveEnv();
  const password = "StrongAdminPass123";
  const calls = { findUnique: [], create: [], update: [] };
  const prismaMock = {
    user: {
      findUnique: async (args) => {
        calls.findUnique.push(args);
        return null;
      },
      create: async (args) => {
        calls.create.push(args);
        return { id: "admin-1", ...args.data };
      },
      update: async (args) => {
        calls.update.push(args);
        return args;
      },
    },
  };

  try {
    process.env.NODE_ENV = "test";
    process.env.ADMIN_EMAIL = "Admin@Example.com";
    process.env.ADMIN_PASSWORD = password;
    process.env.ADMIN_NAME = "Platform Admin";

    const seed = loadSeed(prismaMock);
    const logs = await captureLogs(() => seed.bootstrapAdmin());

    assert.deepEqual(calls.findUnique, [{ where: { email: "admin@example.com" } }]);
    assert.equal(calls.create.length, 1);
    assert.equal(calls.update.length, 0);
    assert.equal(calls.create[0].data.name, "Platform Admin");
    assert.equal(calls.create[0].data.email, "admin@example.com");
    assert.equal(calls.create[0].data.role, "ADMIN");
    assert.notEqual(calls.create[0].data.passwordHash, password);
    assert.equal(bcrypt.compareSync(password, calls.create[0].data.passwordHash), true);
    assert.match(logs, /Admin account created for admin@example\.com/);
    assert.ok(!logs.includes(password));
  } finally {
    restoreEnv(previous);
  }
});

test("bootstrap leaves an existing admin password untouched", async () => {
  const previous = saveEnv();
  const password = "AnotherStrongPass123";
  const calls = { create: [], update: [] };
  const prismaMock = {
    user: {
      findUnique: async () => ({ id: "admin-1", email: "admin@example.com", role: "ADMIN" }),
      create: async (args) => {
        calls.create.push(args);
        return args;
      },
      update: async (args) => {
        calls.update.push(args);
        return args;
      },
    },
  };

  try {
    process.env.NODE_ENV = "test";
    process.env.ADMIN_EMAIL = "admin@example.com";
    process.env.ADMIN_PASSWORD = password;

    const seed = loadSeed(prismaMock);
    const logs = await captureLogs(() => seed.bootstrapAdmin());

    assert.equal(calls.create.length, 0);
    assert.equal(calls.update.length, 0);
    assert.match(logs, /password was not changed/);
    assert.ok(!logs.includes(password));
  } finally {
    restoreEnv(previous);
  }
});

test("bootstrap refuses to reuse a non-admin email address", async () => {
  const previous = saveEnv();
  const prismaMock = {
    user: {
      findUnique: async () => ({ id: "customer-1", email: "admin@example.com", role: "CUSTOMER" }),
    },
  };

  try {
    process.env.NODE_ENV = "test";
    process.env.ADMIN_EMAIL = "admin@example.com";
    process.env.ADMIN_PASSWORD = "StrongAdminPass123";

    const seed = loadSeed(prismaMock);
    await assert.rejects(
      () => seed.bootstrapAdmin(),
      /already belongs to a CUSTOMER account/
    );
  } finally {
    restoreEnv(previous);
  }
});
