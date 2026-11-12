// Admin dashboard controller tests with mocked Prisma (no real database).
// Verifies live statistics, status breakdown, booking activity, recent
// appointments, empty-state handling, and error propagation.

const test = require("node:test");
const assert = require("node:assert/strict");

function freshControllerWithPrisma(prismaMock) {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb";
  const prismaPath = require.resolve("../src/lib/prisma");
  const controllerPath = require.resolve("../src/controllers/dashboardController");
  delete require.cache[controllerPath];
  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: prismaMock,
  };
  return require("../src/controllers/dashboardController");
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

function utcDayOffset(days) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function appointmentRow(overrides = {}) {
  return {
    id: "appt-1",
    reference: "APT-TEST01",
    customerId: "cust-a",
    customerName: "Melisha Thapa",
    customerEmail: "melisha@example.com",
    customerPhone: "+9779819398682",
    serviceId: "svc-1",
    specialistId: "sp-1",
    service: { name: "Career Guidance", slug: "career-guidance" },
    specialist: { name: "Nabin K.C.", slug: "nabin-kc" },
    date: "2026-11-11",
    time: "11:30 AM",
    status: "confirmed",
    notes: "First visit",
    createdAt: new Date("2026-11-08T10:00:00.000Z"),
    ...overrides,
  };
}

function basePrisma(overrides = {}) {
  return {
    user: { count: async () => 0 },
    specialist: { count: async () => 0 },
    service: { count: async () => 0 },
    appointment: {
      groupBy: async () => [],
      findMany: async () => [],
    },
    ...overrides,
  };
}

test("getDashboardStats returns live counts, status breakdown, activity, and recent appointments", async () => {
  const today = utcDayOffset(0);
  const twoDaysAgo = utcDayOffset(-2);
  let customerCountWhere = null;
  let recentArgs = null;
  let activityArgs = null;

  const prisma = basePrisma({
    user: {
      count: async ({ where }) => {
        customerCountWhere = where;
        return 3;
      },
    },
    specialist: { count: async () => 4 },
    service: { count: async () => 12 },
    appointment: {
      groupBy: async (args) => {
        assert.deepEqual(args.by, ["status"]);
        return [
          { status: "pending", _count: { _all: 2 } },
          { status: "confirmed", _count: { _all: 3 } },
          { status: "completed", _count: { _all: 4 } },
          { status: "cancelled", _count: { _all: 1 } },
          { status: "rejected", _count: { _all: 1 } },
        ];
      },
      findMany: async (args) => {
        if (args.include) {
          recentArgs = args;
          return [appointmentRow(), appointmentRow({ id: "appt-2", reference: "APT-TEST02", status: "pending" })];
        }
        activityArgs = args;
        return [
          { createdAt: today },
          { createdAt: today },
          { createdAt: twoDaysAgo },
          { createdAt: utcDayOffset(-10) },
        ];
      },
    },
  });

  const { getDashboardStats } = freshControllerWithPrisma(prisma);
  const res = mockRes();
  await getDashboardStats({}, res, (err) => {
    throw err;
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.generatedAt);

  assert.deepEqual(res.body.stats, {
    totalCustomers: 3,
    totalProviders: 4,
    totalServices: 12,
    totalAppointments: 11,
    pendingAppointments: 2,
    confirmedAppointments: 3,
    completedAppointments: 4,
    cancelledAppointments: 1,
    rejectedAppointments: 1,
  });

  assert.deepEqual(res.body.statusBreakdown, [
    { status: "pending", label: "Pending", count: 2, percentage: 18.2 },
    { status: "confirmed", label: "Confirmed", count: 3, percentage: 27.3 },
    { status: "completed", label: "Completed", count: 4, percentage: 36.4 },
    { status: "cancelled", label: "Cancelled", count: 1, percentage: 9.1 },
    { status: "rejected", label: "Rejected", count: 1, percentage: 9.1 },
  ]);

  assert.equal(res.body.bookingActivity.length, 7);
  assert.deepEqual(res.body.bookingActivity.at(-1), {
    date: today.toISOString().slice(0, 10),
    label: today.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    count: 2,
  });
  assert.equal(res.body.bookingActivity.at(-3).count, 1);

  assert.equal(res.body.recentAppointments.length, 2);
  assert.deepEqual(res.body.recentAppointments[0], {
    id: "APT-TEST01",
    reference: "APT-TEST01",
    dbId: "appt-1",
    customerId: "cust-a",
    customer: "Melisha Thapa",
    customerName: "Melisha Thapa",
    customerEmail: "melisha@example.com",
    phone: "+9779819398682",
    customerPhone: "+9779819398682",
    email: "melisha@example.com",
    service: "Career Guidance",
    serviceId: "career-guidance",
    specialist: "Nabin K.C.",
    specialistId: "nabin-kc",
    date: "2026-11-11",
    time: "11:30 AM",
    status: "confirmed",
    notes: "First visit",
    createdAt: new Date("2026-11-08T10:00:00.000Z"),
  });

  // Customers only: administrators are never counted as customers.
  assert.deepEqual(customerCountWhere, { role: "CUSTOMER" });
  assert.deepEqual(recentArgs.include, { service: true, specialist: true });
  assert.deepEqual(recentArgs.orderBy, [{ createdAt: "desc" }]);
  assert.equal(recentArgs.take, 6);
  assert.deepEqual(activityArgs.select, { createdAt: true });
  assert.ok(activityArgs.where.createdAt.gte instanceof Date);
  assert.ok(!JSON.stringify(res.body).includes("passwordHash"));
});

test("getDashboardStats returns zeroed statistics and a stable 7-day chart for an empty database", async () => {
  const prisma = basePrisma();
  const { getDashboardStats } = freshControllerWithPrisma(prisma);
  const res = mockRes();
  await getDashboardStats({}, res, (err) => {
    throw err;
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.stats, {
    totalCustomers: 0,
    totalProviders: 0,
    totalServices: 0,
    totalAppointments: 0,
    pendingAppointments: 0,
    confirmedAppointments: 0,
    completedAppointments: 0,
    cancelledAppointments: 0,
    rejectedAppointments: 0,
  });
  assert.deepEqual(
    res.body.statusBreakdown.map((item) => [item.status, item.count, item.percentage]),
    [
      ["pending", 0, 0],
      ["confirmed", 0, 0],
      ["completed", 0, 0],
      ["cancelled", 0, 0],
      ["rejected", 0, 0],
    ]
  );
  assert.equal(res.body.bookingActivity.length, 7);
  assert.ok(res.body.bookingActivity.every((day) => day.count === 0));
  assert.deepEqual(res.body.recentAppointments, []);
});

test("summarizeStatusRows tolerates numeric _count values and unknown statuses", () => {
  const { summarizeStatusRows } = freshControllerWithPrisma(basePrisma());
  const result = summarizeStatusRows([
    { status: "pending", _count: 3 },
    { status: "confirmed", _count: { _all: 2 } },
    { status: "not-a-status", _count: { _all: 1 } },
  ]);

  assert.deepEqual(result.counts, {
    pending: 3,
    confirmed: 2,
    completed: 0,
    cancelled: 0,
    rejected: 0,
  });
  // Unknown rows still contribute to the overall appointment total.
  assert.equal(result.total, 6);
});

test("buildBookingActivity ignores missing/out-of-window timestamps and keeps oldest-first order", () => {
  const { buildBookingActivity } = freshControllerWithPrisma(basePrisma());
  const now = new Date("2026-11-12T15:30:00.000Z");
  const activity = buildBookingActivity(
    [
      { createdAt: new Date("2026-11-12T01:00:00.000Z") },
      { createdAt: new Date("2026-11-06T23:00:00.000Z") },
      { createdAt: new Date("2026-11-05T23:59:59.000Z") },
      { createdAt: null },
    ],
    { now }
  );

  assert.deepEqual(
    activity.map((day) => [day.date, day.count]),
    [
      ["2026-11-06", 1],
      ["2026-11-07", 0],
      ["2026-11-08", 0],
      ["2026-11-09", 0],
      ["2026-11-10", 0],
      ["2026-11-11", 0],
      ["2026-11-12", 1],
    ]
  );
});

test("getDashboardStats forwards database errors to the error handler", async () => {
  const boom = new Error("database exploded");
  const prisma = basePrisma({
    appointment: {
      groupBy: async () => {
        throw boom;
      },
      findMany: async () => [],
    },
  });

  const { getDashboardStats } = freshControllerWithPrisma(prisma);
  const res = mockRes();
  let received = null;
  await getDashboardStats({}, res, (err) => {
    received = err;
  });

  assert.equal(received, boom);
  assert.equal(res.body, null);
});
