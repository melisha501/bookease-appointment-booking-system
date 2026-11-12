// Email service tests (no real API calls). Verifies Resend integration is
// best-effort, validates recipients/configuration, and includes the required
// appointment details in customer and admin notifications.

const test = require("node:test");
const assert = require("node:assert/strict");

const ENV_KEYS = [
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "ADMIN_NOTIFICATION_EMAIL",
  "EMAIL_REPLY_TO",
  "SUPPORT_EMAIL",
  "APP_NAME",
  "APP_URL",
  "FRONTEND_URL",
];

function loadEmailService({ resendModule, env = {} } = {}) {
  const servicePath = require.resolve("../src/services/emailService");
  delete require.cache[servicePath];

  const prev = {};
  for (const key of ENV_KEYS) prev[key] = process.env[key];
  for (const [key, value] of Object.entries(env)) process.env[key] = value;
  for (const key of ENV_KEYS) {
    if (!(key in env)) delete process.env[key];
  }

  let resendPath;
  try {
    resendPath = require.resolve("resend");
  } catch {
    resendPath = null;
  }
  const prevResend = resendPath ? require.cache[resendPath] : undefined;
  if (resendPath) {
    if (resendModule === null) delete require.cache[resendPath];
    else if (resendModule) require.cache[resendPath] = { id: resendPath, filename: resendPath, loaded: true, exports: resendModule };
  }

  const mod = require("../src/services/emailService");

  function restore() {
    delete require.cache[servicePath];
    if (resendPath) {
      if (prevResend === undefined) delete require.cache[resendPath];
      else require.cache[resendPath] = prevResend;
    }
    for (const key of ENV_KEYS) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  }

  return { ...mod, restore };
}

function resendMock(onSend) {
  return class ResendMock {
    constructor(key) {
      this.key = key;
      this.emails = { send: onSend };
    }
  };
}

const sample = {
  reference: "APT-ABC123",
  customerName: "Test Customer",
  customerEmail: "customer@example.com",
  customerPhone: "+977-9800000000",
  service: { name: "Dental Checkup" },
  specialist: { name: "Dr. Smith" },
  date: "2099-01-06",
  time: "09:00 AM",
  status: "pending",
  notes: "Please call before arrival.",
};

const baseEnv = {
  RESEND_API_KEY: "re_test_key",
  RESEND_FROM_EMAIL: "BookEase <noreply@example.test>",
  ADMIN_NOTIFICATION_EMAIL: "admin@example.test",
};

test("getConfig trims values and parses admin recipients", () => {
  const email = loadEmailService({
    resendModule: { Resend: class {} },
    env: {
      RESEND_API_KEY: "  re_test_key  ",
      RESEND_FROM_EMAIL: "  BookEase <noreply@example.test>  ",
      ADMIN_NOTIFICATION_EMAIL: " admin@example.test , second@example.test ",
      SUPPORT_EMAIL: " help@example.test ",
      APP_NAME: " BookEase ",
      APP_URL: " https://app.example.test/ ",
    },
  });
  try {
    const cfg = email.getConfig();
    assert.equal(cfg.apiKey, "re_test_key");
    assert.equal(cfg.from, "BookEase <noreply@example.test>");
    assert.deepEqual(cfg.adminEmails, ["admin@example.test", "second@example.test"]);
    assert.equal(cfg.supportEmail, "help@example.test");
    assert.equal(cfg.appName, "BookEase");
    assert.equal(cfg.appUrl, "https://app.example.test");
    assert.equal(cfg.enabled, true);
  } finally {
    email.restore();
  }
});

test("validates recipient addresses", () => {
  const email = loadEmailService({ env: {} });
  try {
    assert.equal(email.isValidEmail("customer@example.com"), true);
    assert.equal(email.isValidEmail(" not-an-email "), false);
    assert.equal(email.isValidEmail(""), false);
    assert.deepEqual(email.normalizeRecipients("a@example.com, bad, b@example.com").valid, [
      "a@example.com",
      "b@example.com",
    ]);
  } finally {
    email.restore();
  }
});

test("skips safely when Resend env vars are not configured (no throw)", async () => {
  const email = loadEmailService({ env: {} });
  try {
    const result = await email.sendAppointmentConfirmation(sample);
    assert.equal(result.sent, false);
    assert.equal(result.skipped, true);
    assert.equal(result.reason, "not-configured");
  } finally {
    email.restore();
  }
});

test("skips safely when the customer recipient is missing or invalid", async () => {
  let called = 0;
  const email = loadEmailService({
    resendModule: { Resend: resendMock(async () => { called += 1; return { data: { id: "x" }, error: null }; }) },
    env: baseEnv,
  });
  try {
    const missing = await email.sendAppointmentConfirmation({ ...sample, customerEmail: "" });
    const invalid = await email.sendAppointmentConfirmation({ ...sample, customerEmail: "not-an-email" });
    assert.equal(missing.sent, false);
    assert.equal(missing.skipped, true);
    assert.equal(invalid.sent, false);
    assert.equal(invalid.skipped, true);
    assert.equal(invalid.reason, "invalid-recipient");
    assert.equal(called, 0);
  } finally {
    email.restore();
  }
});

test("sends a branded confirmation with all required appointment fields", async () => {
  let payload;
  const email = loadEmailService({
    resendModule: { Resend: resendMock(async (p) => { payload = p; return { data: { id: "email_1" }, error: null }; }) },
    env: { ...baseEnv, EMAIL_REPLY_TO: "reply@example.test" },
  });
  try {
    const result = await email.sendAppointmentConfirmation(sample);
    assert.equal(result.sent, true);
    assert.equal(result.id, "email_1");
    assert.equal(payload.from, "BookEase <noreply@example.test>");
    assert.deepEqual(payload.to, ["customer@example.com"]);
    assert.equal(payload.replyTo, "reply@example.test");
    assert.match(payload.subject, /APT-ABC123/);
    assert.match(payload.subject, /Dental Checkup/);

    for (const required of [
      "BookEase",
      "Appointment booked successfully",
      "APT-ABC123",
      "Dental Checkup",
      "Dr. Smith",
      "2099-01-06",
      "09:00 AM",
      "Pending",
    ]) {
      assert.match(payload.html, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.match(payload.text, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }

    assert.match(payload.html, /@media only screen and \(max-width: 600px\)/);
    assert.match(payload.html, /max-width:600px/);
    assert.match(payload.html, /hello@bookease\.com\.np/);
    assert.match(payload.html, /View my appointments/);
  } finally {
    email.restore();
  }
});

test("escapes customer-provided values in HTML emails", async () => {
  let payload;
  const email = loadEmailService({
    resendModule: { Resend: resendMock(async (p) => { payload = p; return { data: { id: "escaped" }, error: null }; }) },
    env: baseEnv,
  });
  try {
    await email.sendAppointmentConfirmation({ ...sample, customerName: "<script>alert(1)</script>" });
    assert.doesNotMatch(payload.html, /<script>alert\(1\)<\/script>/);
    assert.match(payload.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  } finally {
    email.restore();
  }
});

test("sends an admin new-booking notification with customer and appointment details", async () => {
  let payload;
  const email = loadEmailService({
    resendModule: { Resend: resendMock(async (p) => { payload = p; return { data: { id: "admin_email" }, error: null }; }) },
    env: baseEnv,
  });
  try {
    const result = await email.sendAdminNewBookingNotification(sample);
    assert.equal(result.sent, true);
    assert.deepEqual(payload.to, ["admin@example.test"]);
    assert.match(payload.subject, /New booking/i);
    assert.match(payload.subject, /APT-ABC123/);

    for (const required of [
      "New appointment booking",
      "APT-ABC123",
      "Test Customer",
      "customer@example.com",
      "+977-9800000000",
      "Dental Checkup",
      "Dr. Smith",
      "2099-01-06",
      "09:00 AM",
      "Please call before arrival.",
      "Open admin dashboard",
    ]) {
      assert.match(payload.html, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.match(payload.text, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  } finally {
    email.restore();
  }
});

test("skips the admin notification when ADMIN_NOTIFICATION_EMAIL is missing", async () => {
  let called = 0;
  const email = loadEmailService({
    resendModule: { Resend: resendMock(async () => { called += 1; return { data: { id: "x" }, error: null }; }) },
    env: { RESEND_API_KEY: "re_test_key", RESEND_FROM_EMAIL: "noreply@example.test" },
  });
  try {
    const result = await email.sendAdminNewBookingNotification(sample);
    assert.equal(result.sent, false);
    assert.equal(result.skipped, true);
    assert.equal(result.reason, "admin-not-configured");
    assert.equal(called, 0);
  } finally {
    email.restore();
  }
});

test("sends admin notifications only to valid recipients", async () => {
  let payload;
  const email = loadEmailService({
    resendModule: { Resend: resendMock(async (p) => { payload = p; return { data: { id: "admin_multi" }, error: null }; }) },
    env: { ...baseEnv, ADMIN_NOTIFICATION_EMAIL: "admin@example.test, not-an-email, ops@example.test" },
  });
  try {
    const result = await email.sendAdminNewBookingNotification(sample);
    assert.equal(result.sent, true);
    assert.deepEqual(payload.to, ["admin@example.test", "ops@example.test"]);
    assert.equal(result.recipients, 2);
  } finally {
    email.restore();
  }
});

test("sends status update emails for confirmed, rejected, cancelled, and completed", async () => {
  const payloads = [];
  const email = loadEmailService({
    resendModule: { Resend: resendMock(async (p) => { payloads.push(p); return { data: { id: "x" }, error: null }; }) },
    env: baseEnv,
  });
  try {
    for (const status of ["confirmed", "rejected", "cancelled", "completed"]) {
      const result = await email.sendAppointmentStatusUpdate({ ...sample, status }, "pending");
      assert.equal(result.sent, true);
    }

    assert.equal(payloads.length, 4);
    assert.match(payloads[0].subject, /confirmed/i);
    assert.match(payloads[1].subject, /rejected/i);
    assert.match(payloads[2].subject, /cancelled/i);
    assert.match(payloads[3].subject, /completed/i);
    assert.match(payloads[0].html, /Previous status/);
    assert.match(payloads[0].html, /Pending/);
    assert.match(payloads[1].html, /Rejected/);
    assert.match(payloads[2].html, /Cancelled/);
    assert.match(payloads[3].html, /Completed/);
  } finally {
    email.restore();
  }
});

test("does not send a duplicate status email when the status did not change", async () => {
  let called = 0;
  const email = loadEmailService({
    resendModule: { Resend: resendMock(async () => { called += 1; return { data: { id: "x" }, error: null }; }) },
    env: baseEnv,
  });
  try {
    const result = await email.sendAppointmentStatusUpdate({ ...sample, status: "confirmed" }, "confirmed");
    assert.equal(result.sent, false);
    assert.equal(result.skipped, true);
    assert.equal(result.reason, "status-unchanged");
    assert.equal(called, 0);
  } finally {
    email.restore();
  }
});

test("sends a dedicated approval email when an appointment is confirmed", async () => {
  let payload;
  const email = loadEmailService({
    resendModule: { Resend: resendMock(async (p) => { payload = p; return { data: { id: "approved" }, error: null }; }) },
    env: baseEnv,
  });
  try {
    const result = await email.sendAppointmentApproved({ ...sample, status: "confirmed" });
    assert.equal(result.sent, true);
    assert.match(payload.subject, /confirmed/i);
    assert.match(payload.html, /Appointment confirmed/i);
    assert.match(payload.html, /Confirmed/);
  } finally {
    email.restore();
  }
});

test("email provider failure does not throw (best-effort, network/exception)", async () => {
  const email = loadEmailService({
    resendModule: { Resend: resendMock(async () => { throw new Error("network down"); }) },
    env: baseEnv,
  });
  try {
    const result = await email.sendAppointmentConfirmation(sample);
    assert.equal(result.sent, false);
    assert.match(result.error || "", /network down/i);
  } finally {
    email.restore();
  }
});

test("handles Resend API errors (e.g., invalid API key/sender) without throwing", async () => {
  const email = loadEmailService({
    resendModule: {
      Resend: resendMock(async () => ({ data: null, error: { message: "Invalid `from` field: sender not verified" } })),
    },
    env: { ...baseEnv, RESEND_FROM_EMAIL: "bad@example.invalid" },
  });
  try {
    const result = await email.sendAppointmentStatusUpdate({ ...sample, status: "confirmed" }, "pending");
    assert.equal(result.sent, false);
    assert.match(result.error || "", /sender not verified|Invalid/i);
  } finally {
    email.restore();
  }
});
