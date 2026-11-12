// End-to-end authorisation tests for GET /api/dashboard/stats.
// Starts the real Express app with mocked Prisma so no database is required,
// then verifies guests, customers, and administrators against the live route.

const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "dashboard-test-secret";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb";

const adminUser = {
  id: "admin-1",
  name: "Admin User",
  email: "admin@example.com",
  phone: null,
  address: null,
  role: "ADMIN",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};
const customerUser = {
  ...adminUser,
  id: "cust-1",
  name: "Melisha Thapa",
  email: "melisha@example.com",
  role: "CUSTOMER",
};

const prismaMock = {
  user: {
    findUnique: async ({ where }) => {
      if (where.id === adminUser.id) return adminUser;
      if (where.id === customerUser.id) return customerUser;
      return null;
    },
    count: async ({ where }) => {
      assert.deepEqual(where, { role: "CUSTOMER" });
      return 1;
    },
  },
  specialist: { count: async () => 2 },
  service: { count: async () => 3 },
  appointment: {
    groupBy: async () => [{ status: "confirmed", _count: { _all: 1 } }],
    findMany: async (args) => {
      if (args.include) {
        return [
          {
            id: "appt-1",
            reference: "APT-ADMIN1",
            customerId: customerUser.id,
            customerName: customerUser.name,
            customerEmail: customerUser.email,
            customerPhone: null,
            serviceId: "svc-1",
            specialistId: "sp-1",
            service: { name: "Career Guidance", slug: "career-guidance" },
            specialist: { name: "Nabin K.C.", slug: "nabin-kc" },
            date: "2026-11-12",
            time: "10:00 AM",
            status: "confirmed",
            notes: null,
            createdAt: new Date(),
          },
        ];
      }
      return [{ createdAt: new Date() }];
    },
  },
};

// Prime the Prisma singleton before loading the app.
const prismaPath = require.resolve("../src/lib/prisma");
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
};

const app = require("../src/app");

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

test("dashboard statistics endpoint is restricted to authenticated administrators", async (t) => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise((resolve) => server.close(resolve)));

  // Guest: no token.
  let res = await fetch(`${base}/api/dashboard/stats`);
  assert.equal(res.status, 401);
  let body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.message, /authentication required/i);

  // Authenticated customer: blocked by requireAdmin.
  res = await fetch(`${base}/api/dashboard/stats`, {
    headers: { Authorization: `Bearer ${signToken(customerUser)}` },
  });
  assert.equal(res.status, 403);
  body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.message, /admin access required/i);

  // Administrator: full live statistics payload.
  res = await fetch(`${base}/api/dashboard/stats`, {
    headers: { Authorization: `Bearer ${signToken(adminUser)}` },
  });
  assert.equal(res.status, 200);
  body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.stats.totalCustomers, 1);
  assert.equal(body.stats.totalProviders, 2);
  assert.equal(body.stats.totalServices, 3);
  assert.equal(body.stats.totalAppointments, 1);
  assert.equal(body.stats.confirmedAppointments, 1);
  assert.equal(body.statusBreakdown.length, 5);
  assert.equal(body.bookingActivity.length, 7);
  assert.equal(body.recentAppointments.length, 1);
  assert.equal(body.recentAppointments[0].reference, "APT-ADMIN1");
  assert.ok(!JSON.stringify(body).includes("passwordHash"));
});
