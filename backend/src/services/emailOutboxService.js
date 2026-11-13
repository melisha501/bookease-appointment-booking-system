// Database-backed email outbox for reliable appointment notifications.
//
// Why: a Resend outage (network error, 429, 5xx) must never fail a booking or a
// status update. The appointment transaction commits first, then an outbox row
// is written. The first delivery attempt happens inline; if it fails
// transiently the row stays `pending` and a background worker retries with
// exponential backoff. A unique idempotency key prevents duplicate emails for
// the same appointment event.
//
// Delivery semantics are at-least-once: if the process crashes after Resend
// accepted an email but before the row was marked `sent`, the stuck-row
// recovery will retry it. Recovering stuck rows older than 5 minutes keeps
// that window small.
//
// Environment variables (all optional):
// - EMAIL_OUTBOX_MAX_ATTEMPTS   default 5
// - EMAIL_OUTBOX_BASE_DELAY_MS  default 60000 (1 minute)
// - EMAIL_OUTBOX_MAX_DELAY_MS   default 3600000 (1 hour)
// - EMAIL_OUTBOX_STUCK_AFTER_MS default 300000 (5 minutes)
// - EMAIL_OUTBOX_BATCH_SIZE     default 20
// - EMAIL_OUTBOX_INTERVAL_MS    default 30000 (30 seconds)

const prisma = require("../lib/prisma");
const emailService = require("./emailService");

const DEFAULTS = {
  maxAttempts: 5,
  baseDelayMs: 60 * 1000,
  maxDelayMs: 60 * 60 * 1000,
  stuckAfterMs: 5 * 60 * 1000,
  batchSize: 20,
  intervalMs: 30 * 1000,
};

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function getSettings() {
  return {
    maxAttempts: positiveInt(process.env.EMAIL_OUTBOX_MAX_ATTEMPTS, DEFAULTS.maxAttempts),
    baseDelayMs: positiveInt(process.env.EMAIL_OUTBOX_BASE_DELAY_MS, DEFAULTS.baseDelayMs),
    maxDelayMs: positiveInt(process.env.EMAIL_OUTBOX_MAX_DELAY_MS, DEFAULTS.maxDelayMs),
    stuckAfterMs: positiveInt(process.env.EMAIL_OUTBOX_STUCK_AFTER_MS, DEFAULTS.stuckAfterMs),
    batchSize: positiveInt(process.env.EMAIL_OUTBOX_BATCH_SIZE, DEFAULTS.batchSize),
    intervalMs: positiveInt(process.env.EMAIL_OUTBOX_INTERVAL_MS, DEFAULTS.intervalMs),
  };
}

// 1st retry: base delay, then double each attempt, capped at maxDelayMs.
function backoffDelayMs(attempts, settings = getSettings()) {
  const exponent = Math.max(0, attempts - 1);
  return Math.min(settings.baseDelayMs * 2 ** exponent, settings.maxDelayMs);
}

function appointmentReferenceOf(appointment) {
  return String(appointment?.reference || appointment?.id || "").trim();
}

// Stable key per appointment event. The database unique constraint turns
// retries and duplicate requests into a no-op instead of a second email.
function idempotencyKey(reference, event) {
  const ref = String(reference || "").trim();
  if (!ref) throw new Error("Cannot build an email idempotency key without an appointment reference.");
  return `appointment:${ref}:${event}`;
}

function recipientsFor(to) {
  const { valid } = emailService.normalizeRecipients(to);
  return valid;
}

// Insert the email row if it does not exist yet. Returns the stored row.
async function enqueue({ key, type, appointmentReference, to, subject, html, text, maxAttempts }) {
  if (!key) throw new Error("Email outbox key is required.");
  if (!type) throw new Error("Email outbox type is required.");
  if (!subject || !html || !text) throw new Error("Email outbox payload is incomplete.");

  const recipients = recipientsFor(to);
  if (!recipients.length) {
    return { enqueued: false, skipped: true, reason: "invalid-recipient", row: null };
  }

  const settings = getSettings();
  const created = await prisma.emailOutbox.createMany({
    data: [
      {
        idempotencyKey: key,
        type,
        appointmentReference: appointmentReference || null,
        recipient: recipients.join(", "),
        subject,
        html,
        text,
        status: "pending",
        attempts: 0,
        maxAttempts: positiveInt(maxAttempts, settings.maxAttempts),
        nextAttemptAt: new Date(),
      },
    ],
    skipDuplicates: true,
  });

  const row = await prisma.emailOutbox.findUnique({ where: { idempotencyKey: key } });
  return { enqueued: Boolean(created && created.count > 0), duplicate: !(created && created.count > 0), row };
}

// Atomically claim one row and try to deliver it. Safe to call from both the
// request path and the worker: only one caller can flip pending -> sending.
async function sendNow(id, settings = getSettings()) {
  const claimed = await prisma.emailOutbox.updateMany({
    where: { id, status: "pending" },
    data: { status: "sending" },
  });
  if (!claimed || claimed.count === 0) {
    return { claimed: false, status: "skipped" };
  }

  const row = await prisma.emailOutbox.findUnique({ where: { id } });
  if (!row) return { claimed: false, status: "missing" };

  return deliverRow(row, settings);
}

async function deliverRow(row, settings) {
  const attempts = (row.attempts || 0) + 1;
  const maxAttempts = row.maxAttempts || settings.maxAttempts;

  let result;
  try {
    result = await emailService.deliverEmail({
      to: row.recipient,
      subject: row.subject,
      html: row.html,
      text: row.text,
      label: row.type,
    });
  } catch (err) {
    result = {
      sent: false,
      error: err && err.message ? err.message : "Email send failed",
      retryable: true,
    };
  }

  if (result.sent) {
    await prisma.emailOutbox.update({
      where: { id: row.id },
      data: {
        status: "sent",
        attempts,
        providerMessageId: result.id || null,
        sentAt: new Date(),
        lastError: null,
      },
    });
    return { claimed: true, status: "sent", attempts, messageId: result.id || null };
  }

  const message = String(result.error || result.reason || "Email delivery failed").slice(0, 2000);
  const retryable = result.skipped ? false : result.retryable !== false;

  if (!retryable || attempts >= maxAttempts) {
    await prisma.emailOutbox.update({
      where: { id: row.id },
      data: { status: "failed", attempts, lastError: message },
    });
    return { claimed: true, status: "failed", attempts, error: message, retryable };
  }

  const nextAttemptAt = new Date(Date.now() + backoffDelayMs(attempts, settings));
  await prisma.emailOutbox.update({
    where: { id: row.id },
    data: { status: "pending", attempts, lastError: message, nextAttemptAt },
  });
  return { claimed: true, status: "pending", attempts, error: message, nextAttemptAt };
}

// Rows left in `sending` mean the process stopped mid-delivery. Re-queue them
// so they are not stuck forever.
async function recoverStuck(settings = getSettings()) {
  const cutoff = new Date(Date.now() - settings.stuckAfterMs);
  const result = await prisma.emailOutbox.updateMany({
    where: { status: "sending", updatedAt: { lt: cutoff } },
    data: {
      status: "pending",
      nextAttemptAt: new Date(),
      lastError: "Recovered after an interrupted delivery attempt.",
    },
  });
  return result?.count || 0;
}

async function processDue(options = {}) {
  const settings = getSettings();
  const limit = positiveInt(options.limit, settings.batchSize);

  const recovered = await recoverStuck(settings);
  const rows = await prisma.emailOutbox.findMany({
    where: { status: "pending", nextAttemptAt: { lte: new Date() } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
  });

  const results = [];
  for (const row of rows) {
    const claimed = await prisma.emailOutbox.updateMany({
      where: { id: row.id, status: "pending" },
      data: { status: "sending" },
    });
    if (!claimed || claimed.count === 0) continue;
    results.push(await deliverRow(row, settings));
  }

  return { recovered, processed: results.length, results };
}

async function stats() {
  const [pending, sending, sent, failed] = await Promise.all([
    prisma.emailOutbox.count({ where: { status: "pending" } }),
    prisma.emailOutbox.count({ where: { status: "sending" } }),
    prisma.emailOutbox.count({ where: { status: "sent" } }),
    prisma.emailOutbox.count({ where: { status: "failed" } }),
  ]);
  return { pending, sending, sent, failed, total: pending + sending + sent + failed };
}

// Enqueue + immediate attempt. Delivery problems never throw to the caller so a
// committed appointment is never affected by email infrastructure.
async function queuePrepared(prepared, { key, appointmentReference }) {
  if (!prepared || prepared.skipped) {
    return {
      enqueued: false,
      skipped: true,
      reason: prepared?.reason || "empty-payload",
      delivery: null,
    };
  }

  if (typeof emailService.getConfig === "function" && !emailService.getConfig().enabled) {
    console.warn("[email-outbox] Email is not configured; skipping notification.");
    return { enqueued: false, skipped: true, reason: "not-configured", delivery: null };
  }

  const result = await enqueue({
    key,
    type: prepared.type,
    appointmentReference,
    to: prepared.to,
    subject: prepared.subject,
    html: prepared.html,
    text: prepared.text,
  });

  if (!result.row) return { ...result, delivery: null };

  // Previous outbox attempt already handled this event.
  if (result.row.status !== "pending") {
    return { ...result, delivery: { status: result.row.status } };
  }

  let delivery = null;
  try {
    delivery = await sendNow(result.row.id);
  } catch (err) {
    // Leave the row pending; the background worker will retry it.
    console.error("[email-outbox] Inline delivery failed:", err && err.message ? err.message : err);
    delivery = { status: "pending", error: err && err.message ? err.message : "Delivery failed" };
  }

  return { ...result, delivery };
}

async function queueAppointmentConfirmation(appointment) {
  const reference = appointmentReferenceOf(appointment);
  const prepared = emailService.prepareAppointmentConfirmation(appointment);
  return queuePrepared(prepared, {
    key: idempotencyKey(reference, "confirmation"),
    appointmentReference: reference,
  });
}

async function queueAdminNewBookingNotification(appointment) {
  const reference = appointmentReferenceOf(appointment);
  const prepared = emailService.prepareAdminNewBookingNotification(appointment);
  return queuePrepared(prepared, {
    key: idempotencyKey(reference, "admin-new-booking"),
    appointmentReference: reference,
  });
}

async function queueAppointmentApproved(appointment, previousStatus) {
  const reference = appointmentReferenceOf(appointment);
  const from = String(previousStatus || "update").trim().toLowerCase();
  const prepared = emailService.prepareAppointmentApproved(appointment);
  return queuePrepared(prepared, {
    key: idempotencyKey(reference, `status:${from}->confirmed`),
    appointmentReference: reference,
  });
}

async function queueAppointmentStatusUpdate(appointment, previousStatus) {
  const reference = appointmentReferenceOf(appointment);
  const prepared = emailService.prepareAppointmentStatusUpdate(appointment, previousStatus);
  const from = String(previousStatus || "update").trim().toLowerCase();
  const to = String(prepared.status || appointment?.status || "unknown").trim().toLowerCase();
  return queuePrepared(prepared, {
    key: idempotencyKey(reference, `status:${from}->${to}`),
    appointmentReference: reference,
  });
}

let workerTimer = null;
let workerRunning = false;

async function runWorkerTick() {
  if (workerRunning) return;
  workerRunning = true;
  try {
    await processDue();
  } catch (err) {
    console.error("[email-outbox] Worker error:", err && err.message ? err.message : err);
  } finally {
    workerRunning = false;
  }
}

function startWorker(options = {}) {
  if (workerTimer) return workerTimer;
  const settings = getSettings();
  const intervalMs = positiveInt(options.intervalMs, settings.intervalMs);

  // Retry anything left over from a previous process shortly after startup.
  runWorkerTick();

  workerTimer = setInterval(runWorkerTick, intervalMs);
  if (typeof workerTimer.unref === "function") workerTimer.unref();
  return workerTimer;
}

function stopWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}

module.exports = {
  DEFAULT_SETTINGS: DEFAULTS,
  getSettings,
  backoffDelayMs,
  idempotencyKey,
  enqueue,
  sendNow,
  processDue,
  recoverStuck,
  stats,
  startWorker,
  stopWorker,
  queueAppointmentConfirmation,
  queueAppointmentApproved,
  queueAppointmentStatusUpdate,
  queueAdminNewBookingNotification,
};
