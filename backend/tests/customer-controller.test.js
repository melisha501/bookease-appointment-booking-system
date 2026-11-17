// Customer management controller tests with mocked Prisma (no real database).
// Covers listing, search/filter/pagination, customer details, appointment
// history, sensitive-field protection, and validation errors.

const test = require("node:test");
const assert = require("node:assert/strict");

function freshControllerWithPrisma(prismaMock) {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb";
  const prismaPath = require.resolve("../src/lib/prisma");
  const controllerPath = require.resolve("../src/controllers/customerController");
  delete require.cache[controllerPath];
  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: prismaMock,
  };
  return require("../src/controllers/customerController");
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

const customerA = {
  id: "cust-a",
  name: "Melisha Thapa",
  email: "melisha@example.com",
  phone: "+9779819398682",
  address: "Kathmandu",
  role: "CUSTOMER",
  createdAt: new Date("2026-11-07T07:14:01.196Z"),
};
const customerB = {
  id: "cust-b",
  name: "Aarav Sharma",
  email: "aarav@example.com",
  phone: null,
  address: null,
  role: "CUSTOMER",
  createdAt: new Date("2026-10-01T09:00:00.000Z"),
};

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

test("listCustomers returns real customers with appointment totals and pagination", async () => {
  let findManyArgs = null;
  const prisma = {
    user: {
      count: async () => 2,
      findMany: async (args) => {
        findManyArgs = args;
        return [customerA, customerB];
      },
    },
    appointment: {
      groupBy: async (args) => {
        assert.deepEqual(args.by, ["customerId", "status"]);
        assert.deepEqual(args.where, { customerId: { in: ["cust-a", "cust-b"] } });
        return [
          { customerId: "cust-a", status: "confirmed", _count: { _all: 1 }, _max: { date: "2026-11-11" } },
          { customerId: "cust-a", status: "completed", _count: { _all: 2 }, _max: { date: "2026-09-01" } },
          { customerId: "cust-b", status: "cancelled", _count: { _all: 1 }, _max: { date: "2026-10-05" } },
        ];
      },
    },
  };

  const { listCustomers } = freshControllerWithPrisma(prisma);
  const res = mockRes();
  await listCustomers({ query: {} }, res, (err) => {
    throw err;
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.customers.length, 2);

  const first = res.body.customers.find((c) => c.id === "cust-a");
  assert.equal(first.name, "Melisha Thapa");
  assert.equal(first.email, "melisha@example.com");
  assert.equal(first.phone, "+9779819398682");
  assert.equal(first.totalAppointments, 3);
  assert.equal(first.confirmedAppointments, 1);
  assert.equal(first.completedAppointments, 2);
  assert.equal(first.lastAppointmentDate, "2026-11-11");
  assert.deepEqual(first.registeredAt, customerA.createdAt);

  const second = res.body.customers.find((c) => c.id === "cust-b");
  assert.equal(second.phone, null);
  assert.equal(second.totalAppointments, 1);
  assert.equal(second.cancelledAppointments, 1);

  assert.deepEqual(res.body.pagination, {
    page: 1,
    limit: 20,
    total: 2,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  // Only customer-safe fields are selected.
  assert.equal(findManyArgs.where.role, "CUSTOMER");
  assert.equal(findManyArgs.select.passwordHash, undefined);
  assert.equal(findManyArgs.skip, 0);
  assert.equal(findManyArgs.take, 20);
  assert.deepEqual(findManyArgs.orderBy, { createdAt: "desc" });
  assert.ok(!JSON.stringify(res.body).includes("passwordHash"));
});

test("listCustomers searches by name/email and applies filters, sort, and paging", async () => {
  let findManyArgs = null;
  let countWhere = null;
  const prisma = {
    user: {
      count: async ({ where }) => {
        countWhere = where;
        return 12;
      },
      findMany: async (args) => {
        findManyArgs = args;
        return [customerA];
      },
    },
    appointment: {
      groupBy: async () => [
        { customerId: "cust-a", status: "confirmed", _count: { _all: 1 }, _max: { date: "2026-11-11" } },
      ],
    },
  };

  const { listCustomers } = freshControllerWithPrisma(prisma);
  const res = mockRes();
  await listCustomers(
    {
      query: {
        search: "mel",
        status: "confirmed",
        hasAppointments: "yes",
        sort: "name",
        page: "2",
        limit: "5",
      },
    },
    res,
    (err) => {
      throw err;
    }
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(countWhere.OR, [
    { name: { contains: "mel", mode: "insensitive" } },
    { email: { contains: "mel", mode: "insensitive" } },
  ]);
  assert.deepEqual(countWhere.AND, [
    { appointments: { some: { status: "confirmed" } } },
    { appointments: { some: {} } },
  ]);
  assert.equal(countWhere.role, "CUSTOMER");
  assert.deepEqual(findManyArgs.orderBy, { name: "asc" });
  assert.equal(findManyArgs.skip, 5);
  assert.equal(findManyArgs.take, 5);
  assert.deepEqual(res.body.filters, {
    search: "mel",
    status: "confirmed",
    hasAppointments: "yes",
    sort: "name",
  });
  assert.deepEqual(res.body.pagination, {
    page: 2,
    limit: 5,
    total: 12,
    totalPages: 3,
    hasNextPage: true,
    hasPreviousPage: true,
  });
});

test("listCustomers supports filtering customers without appointments", async () => {
  let countWhere = null;
  const prisma = {
    user: {
      count: async ({ where }) => {
        countWhere = where;
        return 0;
      },
      findMany: async () => [],
    },
    appointment: { groupBy: async () => [] },
  };

  const { listCustomers } = freshControllerWithPrisma(prisma);
  const res = mockRes();
  await listCustomers({ query: { hasAppointments: "no" } }, res, (err) => {
    throw err;
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(countWhere.AND, [{ appointments: { none: {} } }]);
  assert.deepEqual(res.body.customers, []);
  assert.equal(res.body.pagination.totalPages, 0);
});

test("listCustomers rejects an invalid status filter", async () => {
  const prisma = { user: { count: async () => 0, findMany: async () => [] } };
  const { listCustomers } = freshControllerWithPrisma(prisma);
  const res = mockRes();
  await listCustomers({ query: { status: "not-a-status" } }, res, (err) => {
    throw err;
  });

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /invalid appointment status/i);
});

test("getCustomer returns details, statistics, and upcoming count", async () => {
  let groupByArgs = null;
  let upcomingWhere = null;
  const prisma = {
    user: {
      findFirst: async (args) => {
        assert.deepEqual(args.where, { id: "cust-a", role: "CUSTOMER" });
        assert.equal(args.select.passwordHash, undefined);
        return customerA;
      },
    },
    appointment: {
      groupBy: async (args) => {
        groupByArgs = args;
        return [
          { status: "completed", _count: { _all: 2 }, _max: { date: "2026-09-01" } },
          { status: "confirmed", _count: { _all: 1 }, _max: { date: "2026-11-11" } },
        ];
      },
      count: async ({ where }) => {
        upcomingWhere = where;
        return 1;
      },
    },
  };

  const { getCustomer } = freshControllerWithPrisma(prisma);
  const res = mockRes();
  await getCustomer({ params: { id: "cust-a" } }, res, (err) => {
    throw err;
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.customer.id, "cust-a");
  assert.equal(res.body.customer.name, "Melisha Thapa");
  assert.equal(res.body.customer.totalAppointments, 3);
  assert.equal(res.body.customer.completedAppointments, 2);
  assert.equal(res.body.customer.confirmedAppointments, 1);
  assert.equal(res.body.customer.lastAppointmentDate, "2026-11-11");
  assert.equal(res.body.customer.upcomingAppointments, 1);
  assert.deepEqual(groupByArgs.where, { customerId: "cust-a" });
  assert.deepEqual(upcomingWhere.status.in, ["pending", "confirmed"]);
  assert.ok(upcomingWhere.date.gte);
  assert.ok(!JSON.stringify(res.body).includes("passwordHash"));
});

test("getCustomer returns 404 for unknown or non-customer users", async () => {
  const prisma = { user: { findFirst: async () => null } };
  const { getCustomer } = freshControllerWithPrisma(prisma);
  const res = mockRes();
  await getCustomer({ params: { id: "admin-id" } }, res, (err) => {
    throw err;
  });

  assert.equal(res.statusCode, 404);
  assert.match(res.body.message, /customer not found/i);
});

test("getCustomerAppointments returns paginated history with summary", async () => {
  let findManyArgs = null;
  const prisma = {
    user: {
      findFirst: async () => ({
        id: "cust-a",
        name: "Melisha Thapa",
        email: "melisha@example.com",
      }),
    },
    appointment: {
      count: async ({ where }) => {
        assert.deepEqual(where, { customerId: "cust-a", status: "confirmed" });
        return 1;
      },
      findMany: async (args) => {
        findManyArgs = args;
        return [appointmentRow()];
      },
      groupBy: async ({ where }) => {
        assert.deepEqual(where, { customerId: "cust-a" });
        return [
          { status: "confirmed", _count: { _all: 1 } },
          { status: "completed", _count: { _all: 2 } },
          { status: "cancelled", _count: { _all: 1 } },
        ];
      },
    },
  };

  const { getCustomerAppointments } = freshControllerWithPrisma(prisma);
  const res = mockRes();
  await getCustomerAppointments(
    { params: { id: "cust-a" }, query: { status: "confirmed", page: "1", limit: "10" } },
    res,
    (err) => {
      throw err;
    }
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.customer.id, "cust-a");
  assert.equal(res.body.appointments.length, 1);
  assert.deepEqual(res.body.appointments[0], {
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
    serviceDbId: "svc-1",
    serviceImage: "",
    specialist: "Nabin K.C.",
    specialistId: "nabin-kc",
    providerId: null,
    providerDbId: null,
    providerName: "",
    providerLogo: "",
    providerType: "",
    date: "2026-11-11",
    time: "11:30 AM",
    status: "confirmed",
    notes: "First visit",
    createdAt: new Date("2026-11-08T10:00:00.000Z"),
  });
  assert.deepEqual(res.body.summary, {
    pending: 0,
    confirmed: 1,
    completed: 2,
    cancelled: 1,
    rejected: 0,
    total: 4,
  });
  assert.deepEqual(res.body.pagination, {
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  assert.deepEqual(res.body.filters, { status: "confirmed" });
  assert.deepEqual(findManyArgs.where, { customerId: "cust-a", status: "confirmed" });
  assert.deepEqual(findManyArgs.include, { service: true, specialist: true });
  assert.deepEqual(findManyArgs.orderBy, [{ date: "desc" }, { createdAt: "desc" }]);
  assert.equal(findManyArgs.skip, 0);
  assert.equal(findManyArgs.take, 10);
});

test("getCustomerAppointments validates status and returns 404 for missing customers", async () => {
  const prisma = {
    user: { findFirst: async () => ({ id: "cust-a", name: "A", email: "a@example.com" }) },
    appointment: { count: async () => 0, findMany: async () => [], groupBy: async () => [] },
  };
  const { getCustomerAppointments } = freshControllerWithPrisma(prisma);

  let res = mockRes();
  await getCustomerAppointments(
    { params: { id: "cust-a" }, query: { status: "bogus" } },
    res,
    (err) => {
      throw err;
    }
  );
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /invalid appointment status/i);

  const missing = {
    user: { findFirst: async () => null },
    appointment: {},
  };
  const missingController = freshControllerWithPrisma(missing);
  res = mockRes();
  await missingController.getCustomerAppointments(
    { params: { id: "missing" }, query: {} },
    res,
    (err) => {
      throw err;
    }
  );
  assert.equal(res.statusCode, 404);
});

test("pagination is capped and invalid page/limit values fall back safely", async () => {
  let findManyArgs = null;
  const prisma = {
    user: {
      count: async () => 0,
      findMany: async (args) => {
        findManyArgs = args;
        return [];
      },
    },
    appointment: { groupBy: async () => [] },
  };
  const { listCustomers } = freshControllerWithPrisma(prisma);
  const res = mockRes();
  await listCustomers(
    { query: { page: "0", limit: "9999" } },
    res,
    (err) => {
      throw err;
    }
  );

  assert.equal(res.statusCode, 200);
  assert.equal(findManyArgs.skip, 0);
  assert.equal(findManyArgs.take, 100);
  assert.equal(res.body.pagination.limit, 100);
});
