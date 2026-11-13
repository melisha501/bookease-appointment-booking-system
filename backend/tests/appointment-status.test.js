// Appointment status tests: transition rules, admin updates, and the customer
// 24-hour cancellation policy. Prisma is mocked; no real database is touched.

const test = require("node:test");
const assert = require("node:assert/strict");

const { minutesToLabel } = require("../src/utils/scheduling");
const {
  OCCUPIED_STATUSES,
  canAdminTransition,
  isCustomerCancellableStatus,
  normalizeStatus,
} = require("../src/utils/appointmentStatus");

function freshControllerWithPrisma(prismaMock) {
  process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb";
  const prismaPath = require.resolve("../src/lib/prisma");
  const controllerPath = require.resolve("../src/controllers/appointmentController");
  const outboxPath = require.resolve("../src/services/emailOutboxService");
  const noopOutbox = {
    queueAppointmentConfirmation: async () => ({ enqueued: true }),
    queueAppointmentApproved: async () => ({ enqueued: true }),
    queueAppointmentStatusUpdate: async () => ({ enqueued: true }),
    queueAdminNewBookingNotification: async () => ({ enqueued: true }),
  };
  delete require.cache[controllerPath];
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prismaMock };
  require.cache[outboxPath] = { id: outboxPath, filename: outboxPath, loaded: true, exports: noopOutbox };
  return require("../src/controllers/appointmentController");
}

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function makeAppointment(overrides = {}) {
  return {
    id: "appt-1",
    reference: "APT-STATUS1",
    customerId: "cust-1",
    customerName: "Test Customer",
    customerEmail: "customer@example.test",
    customerPhone: null,
    date: "2099-01-06",
    time: "09:00 AM",
    status: "pending",
    service: { name: "Consultation" },
    specialist: { name: "Dr. Test" },
    ...overrides,
  };
}

function futureDateTime(hoursFromNow) {
  const dt = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const time = minutesToLabel(dt.getHours() * 60 + dt.getMinutes());
  return { date, time };
}

async function runUpdateStatus({ currentStatus, nextStatus }) {
  const calls = { updated: null };
  const prisma = {
    appointment: {
      findUnique: async () => makeAppointment({ status: currentStatus }),
      update: async ({ data }) => {
        calls.updated = data;
        return makeAppointment({ status: data.status });
      },
    },
  };
  const { updateStatus } = freshControllerWithPrisma(prisma);
  const res = mockRes();
  await updateStatus(
    { params: { reference: "APT-STATUS1" }, body: { status: nextStatus } },
    res,
    (err) => { throw err; }
  );
  return { res, calls };
}

test("status constants keep rejected separate and only pending/confirmed occupy slots", () => {
  assert.deepEqual([...OCCUPIED_STATUSES], ["pending", "confirmed"]);
  assert.equal(normalizeStatus("REJECTED"), "rejected");
  assert.equal(normalizeStatus("nonsense"), null);
  assert.equal(isCustomerCancellableStatus("pending"), true);
  assert.equal(isCustomerCancellableStatus("confirmed"), true);
  assert.equal(isCustomerCancellableStatus("rejected"), false);
  assert.equal(isCustomerCancellableStatus("cancelled"), false);
  assert.equal(isCustomerCancellableStatus("completed"), false);
});

test("admin transition rules allow approve/reject/complete/cancel only where valid", () => {
  assert.equal(canAdminTransition("pending", "confirmed"), true);
  assert.equal(canAdminTransition("pending", "rejected"), true);
  assert.equal(canAdminTransition("pending", "cancelled"), true);
  assert.equal(canAdminTransition("pending", "completed"), false);

  assert.equal(canAdminTransition("confirmed", "completed"), true);
  assert.equal(canAdminTransition("confirmed", "cancelled"), true);
  assert.equal(canAdminTransition("confirmed", "rejected"), false);

  for (const terminal of ["completed", "cancelled", "rejected"]) {
    assert.equal(canAdminTransition(terminal, "pending"), false);
    assert.equal(canAdminTransition(terminal, "confirmed"), false);
  }
});

test("admin can approve pending -> confirmed", async () => {
  const { res, calls } = await runUpdateStatus({ currentStatus: "pending", nextStatus: "confirmed" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.appointment.status, "confirmed");
  assert.equal(calls.updated.status, "confirmed");
});

test("admin can reject pending -> rejected (separate from cancelled)", async () => {
  const { res, calls } = await runUpdateStatus({ currentStatus: "pending", nextStatus: "rejected" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.appointment.status, "rejected");
  assert.equal(calls.updated.status, "rejected");
});

test("admin can mark confirmed -> completed", async () => {
  const { res, calls } = await runUpdateStatus({ currentStatus: "confirmed", nextStatus: "completed" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.appointment.status, "completed");
  assert.equal(calls.updated.status, "completed");
});

test("invalid admin transitions are rejected and never persisted", async () => {
  const cases = [
    ["pending", "completed", /cannot change/i],
    ["confirmed", "rejected", /cannot change/i],
    ["rejected", "confirmed", /cannot be changed/i],
    ["cancelled", "confirmed", /cannot be changed/i],
    ["completed", "cancelled", /cannot be changed/i],
    ["pending", "pending", /already pending/i],
    ["pending", "not-a-status", /invalid status/i],
  ];

  for (const [currentStatus, nextStatus, pattern] of cases) {
    const { res, calls } = await runUpdateStatus({ currentStatus, nextStatus });
    assert.equal(res.statusCode, 400, `${currentStatus} -> ${nextStatus} should be rejected`);
    assert.match(res.body.message, pattern);
    assert.equal(calls.updated, null, `${currentStatus} -> ${nextStatus} must not call update`);
  }
});

test("admin status input is case-insensitive", async () => {
  const { res } = await runUpdateStatus({ currentStatus: "pending", nextStatus: "REJECTED" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.appointment.status, "rejected");
});

test("customer can cancel a pending appointment more than 24 hours away", async () => {
  const { date, time } = futureDateTime(48);
  const calls = { updated: null };
  const prisma = {
    appointment: {
      findFirst: async () => makeAppointment({ status: "pending", date, time }),
      update: async ({ data }) => {
        calls.updated = data;
        return makeAppointment({ status: data.status, date, time });
      },
    },
  };
  const { cancelMine } = freshControllerWithPrisma(prisma);
  const res = mockRes();
  await cancelMine(
    { params: { reference: "APT-STATUS1" }, user: { id: "cust-1" } },
    res,
    (err) => { throw err; }
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.appointment.status, "cancelled");
  assert.equal(calls.updated.status, "cancelled");
});

test("customer cannot cancel within 24 hours or after a terminal status", async () => {
  const near = futureDateTime(2);
  const cases = [
    [{ status: "confirmed", date: near.date, time: near.time }, /24 hours/i],
    [{ status: "rejected" }, /rejected/i],
    [{ status: "cancelled" }, /already been cancelled/i],
    [{ status: "completed" }, /completed appointments cannot be cancelled/i],
  ];

  for (const [overrides, pattern] of cases) {
    const prisma = {
      appointment: {
        findFirst: async () => makeAppointment(overrides),
        update: async () => { throw new Error("update must not be called"); },
      },
    };
    const { cancelMine } = freshControllerWithPrisma(prisma);
    const res = mockRes();
    await cancelMine(
      { params: { reference: "APT-STATUS1" }, user: { id: "cust-1" } },
      res,
      (err) => { throw err; }
    );
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, pattern);
  }
});
