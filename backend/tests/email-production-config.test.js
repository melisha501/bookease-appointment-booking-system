// Production email configuration tests (no real API calls).
// Verifies that production never silently uses the Resend test sender or
// localhost links, while development keeps convenient localhost fallbacks.

const test = require("node:test");
const assert = require("node:assert/strict");

const ENV_KEYS = [
  "NODE_ENV",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "ADMIN_NOTIFICATION_EMAIL",
  "EMAIL_REPLY_TO",
  "SUPPORT_EMAIL",
  "APP_NAME",
  "APP_URL",
  "FRONTEND_URL",
];

function loadEmailService({ env = {}, send } = {}) {
  const servicePath = require.resolve("../src/services/emailService");
  const resendPath = require.resolve("resend");
  delete require.cache[servicePath];

  const prev = {};
  for (const key of ENV_KEYS) prev[key] = process.env[key];
  for (const key of ENV_KEYS) {
    if (!(key in env)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(env)) process.env[key] = value;

  const prevResend = require.cache[resendPath];
  require.cache[resendPath] = {
    id: resendPath,
    filename: resendPath,
    loaded: true,
    exports: {
      Resend: class ResendMock {
        constructor() {
          this.emails = { send: send || (async () => ({ data: { id: "msg" }, error: null })) };
        }
      },
    },
  };

  const mod = require("../src/services/emailService");

  function restore() {
    delete require.cache[servicePath];
    if (prevResend === undefined) delete require.cache[resendPath];
    else require.cache[resendPath] = prevResend;
    for (const key of ENV_KEYS) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  }

  return { ...mod, restore };
}

const appointment = {
  reference: "APT-PROD1",
  customerName: "Production Customer",
  customerEmail: "customer@example.test",
  service: { name: "Consultation" },
  specialist: { name: "Dr. A" },
  date: "2099-01-06",
  time: "09:00 AM",
  status: "pending",
};

test("production requires an explicit sender and never falls back to the test sender", async () => {
  let calls = 0;
  const email = loadEmailService({
    env: { NODE_ENV: "production", RESEND_API_KEY: "re_test_key" },
    send: async () => {
      calls += 1;
      return { data: { id: "should-not-send" }, error: null };
    },
  });
  try {
    const config = email.getConfig();
    assert.equal(config.from, "");
    assert.equal(config.enabled, false);
    assert.equal(config.appUrl, "");
    assert.equal(config.usingTestSender, false);

    const result = await email.sendAppointmentConfirmation(appointment);
    assert.equal(result.sent, false);
    assert.equal(result.skipped, true);
    assert.equal(result.reason, "not-configured");
    assert.equal(calls, 0);
  } finally {
    email.restore();
  }
});

test("production uses the verified sender and configured frontend URL", async () => {
  let payload;
  const email = loadEmailService({
    env: {
      NODE_ENV: "production",
      RESEND_API_KEY: "re_test_key",
      RESEND_FROM_EMAIL: "BookEase <no-reply@bookease.example.test>",
      APP_URL: "https://bookease.example.test/",
      ADMIN_NOTIFICATION_EMAIL: "admin@example.test",
    },
    send: async (p) => {
      payload = p;
      return { data: { id: "prod_msg" }, error: null };
    },
  });
  try {
    const config = email.getConfig();
    assert.equal(config.from, "BookEase <no-reply@bookease.example.test>");
    assert.equal(config.appUrl, "https://bookease.example.test");
    assert.equal(config.usingTestSender, false);
    assert.equal(config.enabled, true);

    const result = await email.sendAppointmentConfirmation(appointment);
    assert.equal(result.sent, true);
    assert.equal(payload.from, "BookEase <no-reply@bookease.example.test>");
    assert.match(payload.html, /https:\/\/bookease\.example\.test\/customer\/appointments/);
    assert.doesNotMatch(payload.html, /localhost/);
  } finally {
    email.restore();
  }
});

test("production falls back to FRONTEND_URL but never to localhost", async () => {
  let payload;
  const email = loadEmailService({
    env: {
      NODE_ENV: "production",
      RESEND_API_KEY: "re_test_key",
      RESEND_FROM_EMAIL: "BookEase <no-reply@bookease.example.test>",
      FRONTEND_URL: "https://app.bookease.example.test",
      ADMIN_NOTIFICATION_EMAIL: "admin@example.test",
    },
    send: async (p) => {
      payload = p;
      return { data: { id: "prod_url" }, error: null };
    },
  });
  try {
    assert.equal(email.getConfig().appUrl, "https://app.bookease.example.test");
    await email.sendAppointmentConfirmation(appointment);
    assert.match(payload.html, /https:\/\/app\.bookease\.example\.test\/customer\/appointments/);

    // Without either URL, no link is rendered at all.
    process.env.APP_URL = "";
    process.env.FRONTEND_URL = "";
    await email.sendAppointmentConfirmation(appointment);
    assert.doesNotMatch(payload.html, /localhost/);
    assert.doesNotMatch(payload.html, /View my appointments/);
  } finally {
    email.restore();
  }
});

test("development keeps the Resend test sender and localhost fallbacks", async () => {
  let payload;
  const email = loadEmailService({
    env: {
      NODE_ENV: "development",
      RESEND_API_KEY: "re_test_key",
      ADMIN_NOTIFICATION_EMAIL: "admin@example.test",
    },
    send: async (p) => {
      payload = p;
      return { data: { id: "dev_msg" }, error: null };
    },
  });
  try {
    const config = email.getConfig();
    assert.equal(config.from, "BookEase <onboarding@resend.dev>");
    assert.equal(config.appUrl, "http://localhost:5173");
    assert.equal(config.usingTestSender, true);
    assert.equal(config.enabled, true);

    const result = await email.sendAppointmentConfirmation(appointment);
    assert.equal(result.sent, true);
    assert.equal(payload.from, "BookEase <onboarding@resend.dev>");
    assert.match(payload.html, /http:\/\/localhost:5173\/customer\/appointments/);
  } finally {
    email.restore();
  }
});
