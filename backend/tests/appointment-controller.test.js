// Controller-level scheduling tests with mocked Prisma (no real database).
// Verifies: duration-based overlap rejection, break/working-hours enforcement,
// past slot rejection, occupied pending+confirmed statuses, and advisory lock usage.

const test = require("node:test");
const assert = require("node:assert/strict");

function freshControllerWithPrisma(prismaMock) {
  process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb";
  const prismaPath = require.resolve("../src/lib/prisma");
  const controllerPath = require.resolve("../src/controllers/appointmentController");
  const schedulingPath = require.resolve("../src/utils/scheduling");
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
  // scheduling is pure but clear cache for isolation
  delete require.cache[schedulingPath];
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

const baseSpecialist = {
  id: "sp1",
  slug: "dr-a",
  name: "Dr A",
  schedules: [{ days: ["Mon", "Tue", "Wed", "Thu", "Fri"], startTime: "09:00 AM", endTime: "05:00 PM", breakStart: "01:00 PM", breakEnd: "02:00 PM" }],
};
const baseService = { id: "svc30", slug: "svc-30", name: "Consult", durationMins: 30 };

test("getAvailability returns duration-based slots and marks overlaps/breaks (past date closed)", async () => {
  const prisma = {
    specialist: { findFirst: async () => baseSpecialist },
    service: { findFirst: async () => ({ ...baseService, durationMins: 60 }) },
    appointment: {
      findMany: async () => [
        { reference: "APT-X", time: "10:00 AM", service: { durationMins: 60 } }, // occupies 10:00-11:00
      ],
    },
  };
  const { getAvailability } = freshControllerWithPrisma(prisma);
  const req = { query: { specialistId: "dr-a", serviceId: "svc-30", date: "2099-01-06" } }; // a Tuesday
  const res = mockRes();
  await getAvailability(req, res, (e) => { throw e; });

  assert.equal(res.body.success, true);
  assert.equal(res.body.closed, false);
  assert.equal(res.body.durationMins, 60);
  const labels = res.body.slots.map((s) => s.slot);
  assert.ok(labels.includes("09:00 AM"));
  assert.ok(labels.includes("11:00 AM"));
  assert.ok(!labels.includes("09:30 AM")); // 60-min step
  const ten = res.body.slots.find((s) => s.slot === "10:00 AM");
  assert.equal(ten.available, false);
  assert.equal(ten.taken, true);
  const one = res.body.slots.find((s) => s.slot === "01:00 PM"); // 1:00-2:00 overlaps break 1:00-2:00
  assert.equal(one.inBreak, true);
  assert.equal(one.available, false);
});

test("getAvailability rejects past dates and requires serviceId", async () => {
  const prisma = { specialist: { findFirst: async () => baseSpecialist }, service: { findFirst: async () => baseService }, appointment: { findMany: async () => [] } };
  const { getAvailability } = freshControllerWithPrisma(prisma);

  let res = mockRes();
  await getAvailability({ query: { specialistId: "dr-a", date: "2099-01-06" } }, res, (e) => { throw e; });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /serviceId/i);

  res = mockRes();
  await getAvailability({ query: { specialistId: "dr-a", serviceId: "svc-30", date: "2000-01-01" } }, res, (e) => { throw e; });
  assert.equal(res.body.closed, true);
  assert.match(res.body.reason, /past/i);
});

test("createAppointment rejects overlapping booking (different duration), uses advisory lock, and considers pending+confirmed", async () => {
  const calls = { lock: null, findManyWhere: null, created: null };
  const tx = {
    $executeRaw: async (strings, ...values) => {
      calls.lock = { sql: String(strings && strings[0] ? strings.join("?") : strings), values };
      return 1;
    },
    workingHour: { findUnique: async () => ({ days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], startTime: "09:00 AM", endTime: "05:00 PM", breakStart: "01:00 PM", breakEnd: "02:00 PM" }) },
    appointment: {
      findMany: async ({ where }) => {
        calls.findManyWhere = where;
        // Existing pending appointment 10:00 AM, 60 mins => occupies 10:00-11:00
        return [{ reference: "APT-P", time: "10:00 AM", service: { durationMins: 60 } }];
      },
      findUnique: async () => null,
      create: async ({ data }) => { calls.created = data; return { ...data, id: "new1", service: baseService, specialist: baseSpecialist }; },
    },
  };
  const prisma = {
    service: { findFirst: async () => ({ ...baseService, durationMins: 30 }) },
    specialist: { findFirst: async () => baseSpecialist },
    specialistService: { findFirst: async () => ({ specialistId: "sp1", serviceId: "svc30" }) },
    $transaction: async (fn) => fn(tx),
  };
  const { createAppointment } = freshControllerWithPrisma(prisma);

  // Overlaps existing 10:00-11:00
  let res = mockRes();
  await createAppointment(
    { body: { serviceId: "svc-30", specialistId: "dr-a", date: "2099-01-06", time: "10:30 AM", customerName: "T", customerEmail: "t@example.com" } },
    res,
    (e) => { throw e; }
  );
  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /no longer available/i);
  assert.ok(calls.lock, "advisory lock should be acquired in transaction");
  assert.match(calls.lock.sql, /pg_advisory_xact_lock/i);
  assert.deepEqual(calls.findManyWhere.status, { in: ["pending", "confirmed"] });

  // Non-overlapping slot succeeds (09:00-09:30)
  calls.lock = null;
  tx.appointment.findMany = async ({ where }) => { calls.findManyWhere = where; return [{ reference: "APT-P", time: "10:00 AM", service: { durationMins: 60 } }]; };
  res = mockRes();
  await createAppointment(
    { body: { serviceId: "svc-30", specialistId: "dr-a", date: "2099-01-06", time: "09:00 AM", customerName: "T", customerEmail: "t@example.com" } },
    res,
    (e) => { throw e; }
  );
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.ok(calls.created.reference.startsWith("APT-"));
});

test("createAppointment rejects break overlap, extending beyond hours, and past time slots", async () => {
  const tx = {
    $executeRaw: async () => 1,
    workingHour: { findUnique: async () => ({ days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], startTime: "09:00 AM", endTime: "05:00 PM", breakStart: "01:00 PM", breakEnd: "02:00 PM" }) },
    appointment: { findMany: async () => [], findUnique: async () => null, create: async ({ data }) => ({ ...data, id: "n", service: baseService, specialist: baseSpecialist }) },
  };
  const prisma = {
    service: { findFirst: async () => ({ ...baseService, durationMins: 60 }) },
    specialist: { findFirst: async () => baseSpecialist },
    specialistService: { findFirst: async () => ({}) },
    $transaction: async (fn) => fn(tx),
  };
  const { createAppointment } = freshControllerWithPrisma(prisma);

  // 12:30 PM + 60m = 1:30 PM overlaps break
  let res = mockRes();
  await createAppointment({ body: { serviceId: "svc-30", specialistId: "dr-a", date: "2099-01-06", time: "12:30 PM", customerName: "T", customerEmail: "t@example.com" } }, res, (e) => { throw e; });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /break/i);

  // 4:30 PM + 60m = 5:30 PM extends beyond 5:00 PM
  res = mockRes();
  await createAppointment({ body: { serviceId: "svc-30", specialistId: "dr-a", date: "2099-01-06", time: "04:30 PM", customerName: "T", customerEmail: "t@example.com" } }, res, (e) => { throw e; });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /working hours/i);

  // past date
  res = mockRes();
  await createAppointment({ body: { serviceId: "svc-30", specialistId: "dr-a", date: "2000-01-01", time: "09:00 AM", customerName: "T", customerEmail: "t@example.com" } }, res, (e) => { throw e; });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /past date/i);
});
