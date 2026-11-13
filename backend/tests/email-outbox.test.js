// Email outbox tests with an in-memory Prisma double and a mocked email
// transport. No database or Resend API calls are made.
//
// Covers: successful first attempt, transient failure + retry, retry
// exhaustion, non-retryable errors, duplicate prevention, stuck-row recovery,
// idempotency keys, and backoff calculation.

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.EMAIL_OUTBOX_BASE_DELAY_MS = "60000";
process.env.EMAIL_OUTBOX_MAX_DELAY_MS = "3600000";
process.env.EMAIL_OUTBOX_MAX_ATTEMPTS = "5";
process.env.EMAIL_OUTBOX_STUCK_AFTER_MS = "300000";

function createPrismaMock() {
  const rows = new Map();
  let seq = 0;

  function matches(row, where = {}) {
    for (const [key, expected] of Object.entries(where)) {
      if (expected instanceof Date) {
        if (row[key]?.getTime() !== expected.getTime()) return false;
        continue;
      }
      if (expected && typeof expected === "object") {
        const actual = row[key];
        if ("lte" in expected && !(actual <= expected.lte)) return false;
        if ("lt" in expected && !(actual < expected.lt)) return false;
        if ("in" in expected && !expected.in.includes(actual)) return false;
        continue;
      }
      if (row[key] !== expected) return false;
    }
    return true;
  }

  function apply(row, data) {
    Object.assign(row, data);
    row.updatedAt = new Date();
    return row;
  }

  return {
    _rows: rows,
    emailOutbox: {
      createMany: async ({ data, skipDuplicates }) => {
        let count = 0;
        for (const item of data) {
          const duplicate = [...rows.values()].some(
            (row) => row.idempotencyKey === item.idempotencyKey
          );
          if (duplicate) {
            if (skipDuplicates) continue;
            throw new Error("Unique constraint failed on idempotencyKey");
          }
          const row = {
            id: `row-${++seq}`,
            status: "pending",
            attempts: 0,
            maxAttempts: 5,
            lastError: null,
            providerMessageId: null,
            sentAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...item,
          };
          rows.set(row.id, row);
          count += 1;
        }
        return { count };
      },
      findUnique: async ({ where }) => {
        if (where.id) return rows.get(where.id) || null;
        return (
          [...rows.values()].find((row) => row.idempotencyKey === where.idempotencyKey) || null
        );
      },
      updateMany: async ({ where, data }) => {
        const matching = [...rows.values()].filter((row) => matches(row, where));
        for (const row of matching) apply(row, data);
        return { count: matching.length };
      },
      update: async ({ where, data }) => {
        const row = rows.get(where.id);
        if (!row) throw new Error("Record not found");
        return apply(row, data);
      },
      findMany: async ({ where, take }) =>
        [...rows.values()]
          .filter((row) => matches(row, where))
          .sort((a, b) => a.nextAttemptAt - b.nextAttemptAt)
          .slice(0, take),
      count: async ({ where }) => [...rows.values()].filter((row) => matches(row, where)).length,
    },
  };
}

function makeEmailService(deliver, { enabled = true } = {}) {
  const deliveries = [];
  return {
    deliveries,
    getConfig: () => ({ enabled, usingTestSender: false, isProduction: false }),
    normalizeRecipients(to) {
      const raw = Array.isArray(to) ? to : String(to ?? "").split(/[,;]/);
      const valid = raw
        .map((item) => String(item ?? "").trim())
        .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));
      return { valid, invalid: [] };
    },
    prepareAppointmentConfirmation: (appointment) => ({
      type: "booking_confirmation",
      to: appointment.customerEmail,
      subject: `Booking received (${appointment.reference})`,
      html: "<p>Booking received</p>",
      text: "Booking received",
      reference: appointment.reference,
    }),
    prepareAppointmentApproved: (appointment) => ({
      type: "appointment_approved",
      to: appointment.customerEmail,
      subject: `Appointment confirmed (${appointment.reference})`,
      html: "<p>Appointment confirmed</p>",
      text: "Appointment confirmed",
      reference: appointment.reference,
    }),
    prepareAppointmentStatusUpdate: (appointment, previousStatus) => ({
      type: "status_update",
      to: appointment.customerEmail,
      subject: `Status ${appointment.status} (${appointment.reference})`,
      html: `<p>Status ${appointment.status}</p>`,
      text: `Status ${appointment.status}`,
      reference: appointment.reference,
      status: appointment.status,
      previousStatus,
    }),
    prepareAdminNewBookingNotification: (appointment) => ({
      type: "admin_new_booking",
      to: "admin@example.test",
      subject: `New booking (${appointment.reference})`,
      html: "<p>New booking</p>",
      text: "New booking",
      reference: appointment.reference,
    }),
    deliverEmail: async (payload) => {
      deliveries.push(payload);
      return deliver(payload);
    },
  };
}

function loadOutbox({ prisma, emailService }) {
  const prismaPath = require.resolve("../src/lib/prisma");
  const emailPath = require.resolve("../src/services/emailService");
  const outboxPath = require.resolve("../src/services/emailOutboxService");

  delete require.cache[outboxPath];
  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: prisma,
  };
  require.cache[emailPath] = {
    id: emailPath,
    filename: emailPath,
    loaded: true,
    exports: emailService,
  };

  return require("../src/services/emailOutboxService");
}

const appointment = {
  id: "appt-1",
  reference: "APT-TEST1",
  customerName: "Test Customer",
  customerEmail: "customer@example.test",
  status: "pending",
};

function pendingRow(prisma) {
  return [...prisma._rows.values()][0];
}

test("delivers a booking confirmation inline and records the provider message id", async () => {
  const prisma = createPrismaMock();
  const email = makeEmailService(async () => ({ sent: true, id: "resend_msg_1" }));
  const outbox = loadOutbox({ prisma, emailService: email });

  const result = await outbox.queueAppointmentConfirmation(appointment);

  assert.equal(result.enqueued, true);
  assert.equal(result.delivery.status, "sent");
  assert.equal(prisma._rows.size, 1);

  const row = pendingRow(prisma);
  assert.equal(row.idempotencyKey, "appointment:APT-TEST1:confirmation");
  assert.equal(row.type, "booking_confirmation");
  assert.equal(row.appointmentReference, "APT-TEST1");
  assert.equal(row.recipient, "customer@example.test");
  assert.equal(row.status, "sent");
  assert.equal(row.attempts, 1);
  assert.equal(row.providerMessageId, "resend_msg_1");
  assert.ok(row.sentAt instanceof Date);
  assert.equal(row.lastError, null);
  assert.equal(email.deliveries.length, 1);
});

test("keeps a transiently failed email pending and a later retry succeeds", async () => {
  const prisma = createPrismaMock();
  const responses = [
    { sent: false, error: "429 rate limit exceeded", retryable: true },
    { sent: true, id: "resend_msg_2" },
  ];
  const email = makeEmailService(async () => responses.shift());
  const outbox = loadOutbox({ prisma, emailService: email });

  const result = await outbox.queueAppointmentConfirmation(appointment);
  assert.equal(result.delivery.status, "pending");

  let row = pendingRow(prisma);
  assert.equal(row.status, "pending");
  assert.equal(row.attempts, 1);
  assert.match(row.lastError, /rate limit/i);
  assert.ok(row.nextAttemptAt.getTime() > Date.now());

  // Simulate the backoff window elapsing.
  row.nextAttemptAt = new Date(Date.now() - 1000);

  const processed = await outbox.processDue();
  assert.equal(processed.processed, 1);

  row = pendingRow(prisma);
  assert.equal(row.status, "sent");
  assert.equal(row.attempts, 2);
  assert.equal(row.providerMessageId, "resend_msg_2");
  assert.equal(email.deliveries.length, 2);
});

test("marks the email failed after retry exhaustion and stops resending", async () => {
  const previousMax = process.env.EMAIL_OUTBOX_MAX_ATTEMPTS;
  process.env.EMAIL_OUTBOX_MAX_ATTEMPTS = "2";
  try {
    const prisma = createPrismaMock();
    let calls = 0;
    const email = makeEmailService(async () => {
      calls += 1;
      return { sent: false, error: "503 provider unavailable", retryable: true };
    });
    const outbox = loadOutbox({ prisma, emailService: email });

    await outbox.queueAppointmentConfirmation(appointment);
    assert.equal(pendingRow(prisma).status, "pending");

    pendingRow(prisma).nextAttemptAt = new Date(Date.now() - 1000);
    await outbox.processDue();

    const row = pendingRow(prisma);
    assert.equal(row.status, "failed");
    assert.equal(row.attempts, 2);
    assert.match(row.lastError, /503|unavailable/i);

    // No pending rows remain, so nothing else is sent.
    const again = await outbox.processDue();
    assert.equal(again.processed, 0);
    assert.equal(calls, 2);
  } finally {
    process.env.EMAIL_OUTBOX_MAX_ATTEMPTS = previousMax;
  }
});

test("fails immediately on non-retryable provider errors", async () => {
  const prisma = createPrismaMock();
  const email = makeEmailService(async () => ({
    sent: false,
    error: "Invalid `from` field: sender not verified",
    retryable: false,
  }));
  const outbox = loadOutbox({ prisma, emailService: email });

  await outbox.queueAppointmentConfirmation(appointment);

  const row = pendingRow(prisma);
  assert.equal(row.status, "failed");
  assert.equal(row.attempts, 1);
  assert.match(row.lastError, /sender not verified/i);
  assert.equal(email.deliveries.length, 1);
});

test("delivery exceptions never throw and leave the email retryable", async () => {
  const prisma = createPrismaMock();
  const email = makeEmailService(async () => {
    throw new Error("socket hang up");
  });
  const outbox = loadOutbox({ prisma, emailService: email });

  const result = await outbox.queueAppointmentConfirmation(appointment);
  assert.equal(result.enqueued, true);
  assert.equal(result.delivery.status, "pending");

  const row = pendingRow(prisma);
  assert.equal(row.status, "pending");
  assert.match(row.lastError, /socket hang up/i);
});

test("duplicate queue calls create a single email and never resend it", async () => {
  const prisma = createPrismaMock();
  const email = makeEmailService(async () => ({ sent: true, id: "resend_once" }));
  const outbox = loadOutbox({ prisma, emailService: email });

  const first = await outbox.queueAppointmentConfirmation(appointment);
  const second = await outbox.queueAppointmentConfirmation(appointment);

  assert.equal(first.enqueued, true);
  assert.equal(second.enqueued, false);
  assert.equal(second.duplicate, true);
  assert.equal(prisma._rows.size, 1);
  assert.equal(email.deliveries.length, 1);
  assert.equal(pendingRow(prisma).status, "sent");
});

test("recovers emails left in the sending state after a crash", async () => {
  const prisma = createPrismaMock();
  const email = makeEmailService(async () => ({ sent: true, id: "x" }));
  const outbox = loadOutbox({ prisma, emailService: email });

  await outbox.enqueue({
    key: outbox.idempotencyKey("APT-TEST1", "confirmation"),
    type: "booking_confirmation",
    appointmentReference: "APT-TEST1",
    to: "customer@example.test",
    subject: "Subject",
    html: "<p>Body</p>",
    text: "Body",
  });

  const row = pendingRow(prisma);
  row.status = "sending";
  row.updatedAt = new Date(Date.now() - 10 * 60 * 1000);

  const count = await outbox.recoverStuck({ ...outbox.getSettings(), stuckAfterMs: 60 * 1000 });
  assert.equal(count, 1);
  assert.equal(row.status, "pending");
  assert.match(row.lastError, /recovered/i);
});

test("different appointment events use stable, separate idempotency keys", async () => {
  const prisma = createPrismaMock();
  const email = makeEmailService(async () => ({ sent: true, id: "x" }));
  const outbox = loadOutbox({ prisma, emailService: email });

  await outbox.queueAppointmentApproved({ ...appointment, status: "confirmed" }, "pending");
  await outbox.queueAppointmentStatusUpdate({ ...appointment, status: "cancelled" }, "pending");
  await outbox.queueAdminNewBookingNotification(appointment);

  const keys = [...prisma._rows.values()].map((row) => row.idempotencyKey).sort();
  assert.deepEqual(keys, [
    "appointment:APT-TEST1:admin-new-booking",
    "appointment:APT-TEST1:status:pending->cancelled",
    "appointment:APT-TEST1:status:pending->confirmed",
  ]);
});

test("skips queueing when email is not configured or the recipient is invalid", async () => {
  const disabledPrisma = createPrismaMock();
  const disabledEmail = makeEmailService(async () => ({ sent: true }), { enabled: false });
  const disabledOutbox = loadOutbox({ prisma: disabledPrisma, emailService: disabledEmail });

  const skipped = await disabledOutbox.queueAppointmentConfirmation(appointment);
  assert.equal(skipped.enqueued, false);
  assert.equal(skipped.reason, "not-configured");
  assert.equal(disabledPrisma._rows.size, 0);

  const prisma = createPrismaMock();
  const email = makeEmailService(async () => ({ sent: true }));
  email.prepareAppointmentConfirmation = () => ({
    type: "booking_confirmation",
    to: "",
    subject: "Subject",
    html: "<p>Body</p>",
    text: "Body",
    reference: "APT-TEST1",
  });
  const outbox = loadOutbox({ prisma, emailService: email });

  const invalid = await outbox.queueAppointmentConfirmation(appointment);
  assert.equal(invalid.enqueued, false);
  assert.equal(invalid.reason, "invalid-recipient");
  assert.equal(prisma._rows.size, 0);
});

test("backoff doubles per attempt and is capped", () => {
  const prisma = createPrismaMock();
  const outbox = loadOutbox({
    prisma,
    emailService: makeEmailService(async () => ({ sent: true })),
  });

  const settings = { baseDelayMs: 1000, maxDelayMs: 5000 };
  assert.equal(outbox.backoffDelayMs(1, settings), 1000);
  assert.equal(outbox.backoffDelayMs(2, settings), 2000);
  assert.equal(outbox.backoffDelayMs(3, settings), 4000);
  assert.equal(outbox.backoffDelayMs(4, settings), 5000);
  assert.equal(outbox.backoffDelayMs(10, settings), 5000);
});
