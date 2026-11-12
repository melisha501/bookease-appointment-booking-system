// Customer management (admin only).
//
// Customers are User rows with role CUSTOMER. These endpoints provide:
// - list/search/filter customers with appointment totals
// - individual customer details with appointment statistics
// - a paginated appointment history for one customer
//
// Every response uses an explicit select/serializer so password hashes, tokens,
// and other sensitive fields can never be returned.

const prisma = require("../lib/prisma");
const { appointmentToClient } = require("../utils/appointmentView");
const {
  APPOINTMENT_STATUS,
  ALL_APPOINTMENT_STATUSES,
  normalizeStatus,
} = require("../utils/appointmentStatus");

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parsePositiveInt(value, fallback, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return max ? Math.min(parsed, max) : parsed;
}

function parsePagination(query = {}) {
  const page = parsePositiveInt(query.page, 1);
  const limit = parsePositiveInt(query.limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  return { page, limit, skip: (page - 1) * limit };
}

function paginationMeta({ page, limit, total }) {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page * limit < total,
    hasPreviousPage: page > 1,
  };
}

function parseHasAppointments(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["yes", "true", "1", "with"].includes(normalized)) return "yes";
  if (["no", "false", "0", "without"].includes(normalized)) return "no";
  return "all";
}

function parseSort(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "oldest") return "oldest";
  if (normalized === "name") return "name";
  return "newest";
}

function parseStatusFilter(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized || normalized === "all") return { status: null, error: null };
  const status = normalizeStatus(normalized);
  if (!status) {
    return {
      status: null,
      error: `Invalid appointment status. Allowed values: ${ALL_APPOINTMENT_STATUSES.join(", ")}.`,
    };
  }
  return { status, error: null };
}

function buildCustomerWhere({ search, status, hasAppointments }) {
  const where = { role: "CUSTOMER" };
  const term = String(search ?? "").trim();

  if (term) {
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
    ];
  }

  const appointmentClauses = [];
  if (status) appointmentClauses.push({ appointments: { some: { status } } });
  if (hasAppointments === "yes") appointmentClauses.push({ appointments: { some: {} } });
  if (hasAppointments === "no") appointmentClauses.push({ appointments: { none: {} } });
  if (appointmentClauses.length) where.AND = appointmentClauses;

  return where;
}

function buildOrderBy(sort) {
  if (sort === "oldest") return { createdAt: "asc" };
  if (sort === "name") return { name: "asc" };
  return { createdAt: "desc" };
}

function rowCount(row) {
  if (!row || !row._count) return 0;
  if (typeof row._count === "number") return row._count;
  return Number(row._count._all || 0);
}

function emptyStatusCounts() {
  return Object.fromEntries(ALL_APPOINTMENT_STATUSES.map((status) => [status, 0]));
}

function summarizeStats(rows = []) {
  const byStatus = emptyStatusCounts();
  let total = 0;
  let lastAppointmentDate = null;

  for (const row of rows) {
    const count = rowCount(row);
    if (row.status && Object.prototype.hasOwnProperty.call(byStatus, row.status)) {
      byStatus[row.status] += count;
    }
    total += count;
    const maxDate = row._max?.date;
    if (maxDate && (!lastAppointmentDate || maxDate > lastAppointmentDate)) {
      lastAppointmentDate = maxDate;
    }
  }

  return { total, byStatus, lastAppointmentDate };
}

async function loadAppointmentStats(customerIds) {
  if (!Array.isArray(customerIds) || customerIds.length === 0) return new Map();

  const rows = await prisma.appointment.groupBy({
    by: ["customerId", "status"],
    where: { customerId: { in: customerIds } },
    _count: { _all: true },
    _max: { date: true },
  });

  const byCustomer = new Map();
  for (const row of rows) {
    if (!row.customerId) continue;
    const current = byCustomer.get(row.customerId) || [];
    current.push(row);
    byCustomer.set(row.customerId, current);
  }

  const result = new Map();
  for (const [customerId, customerRows] of byCustomer.entries()) {
    result.set(customerId, summarizeStats(customerRows));
  }
  return result;
}

function customerToClient(user, stats) {
  const byStatus = stats?.byStatus || emptyStatusCounts();
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    address: user.address || null,
    registeredAt: user.createdAt,
    totalAppointments: stats?.total || 0,
    pendingAppointments: byStatus.pending || 0,
    confirmedAppointments: byStatus.confirmed || 0,
    completedAppointments: byStatus.completed || 0,
    cancelledAppointments: byStatus.cancelled || 0,
    rejectedAppointments: byStatus.rejected || 0,
    lastAppointmentDate: stats?.lastAppointmentDate || null,
  };
}

async function findCustomerById(id) {
  return prisma.user.findFirst({
    where: { id: String(id), role: "CUSTOMER" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      address: true,
      role: true,
      createdAt: true,
    },
  });
}

// GET /api/customers?search=&status=&hasAppointments=&sort=&page=&limit=
async function listCustomers(req, res, next) {
  try {
    const query = req.query || {};
    const { status, error } = parseStatusFilter(query.status);
    if (error) return res.status(400).json({ success: false, message: error });

    const search = String(query.search ?? "").trim();
    const hasAppointments = parseHasAppointments(query.hasAppointments);
    const sort = parseSort(query.sort);
    const { page, limit, skip } = parsePagination(query);
    const where = buildCustomerWhere({ search, status, hasAppointments });
    const orderBy = buildOrderBy(sort);

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          role: true,
          createdAt: true,
        },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    const statsByCustomer = await loadAppointmentStats(users.map((user) => user.id));
    const customers = users.map((user) =>
      customerToClient(user, statsByCustomer.get(user.id))
    );

    return res.json({
      success: true,
      customers,
      pagination: paginationMeta({ page, limit, total }),
      filters: { search, status: status || "all", hasAppointments, sort },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/customers/:id
async function getCustomer(req, res, next) {
  try {
    const customer = await findCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found." });
    }

    const today = new Date().toISOString().slice(0, 10);
    const [statsRows, upcomingAppointments] = await Promise.all([
      prisma.appointment.groupBy({
        by: ["status"],
        where: { customerId: customer.id },
        _count: { _all: true },
        _max: { date: true },
      }),
      prisma.appointment.count({
        where: {
          customerId: customer.id,
          date: { gte: today },
          status: { in: [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED] },
        },
      }),
    ]);

    const stats = summarizeStats(statsRows);
    return res.json({
      success: true,
      customer: {
        ...customerToClient(customer, stats),
        upcomingAppointments,
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/customers/:id/appointments?status=&page=&limit=
async function getCustomerAppointments(req, res, next) {
  try {
    const customer = await findCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found." });
    }

    const query = req.query || {};
    const { status, error } = parseStatusFilter(query.status);
    if (error) return res.status(400).json({ success: false, message: error });

    const { page, limit, skip } = parsePagination(query);
    const where = {
      customerId: customer.id,
      ...(status ? { status } : {}),
    };

    const [total, appointments, summaryRows] = await Promise.all([
      prisma.appointment.count({ where }),
      prisma.appointment.findMany({
        where,
        include: { service: true, specialist: true },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.appointment.groupBy({
        by: ["status"],
        where: { customerId: customer.id },
        _count: { _all: true },
      }),
    ]);

    const summary = emptyStatusCounts();
    let totalAll = 0;
    for (const row of summaryRows) {
      const count = rowCount(row);
      if (Object.prototype.hasOwnProperty.call(summary, row.status)) summary[row.status] = count;
      totalAll += count;
    }

    return res.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
      },
      appointments: appointments.map(appointmentToClient),
      summary: { ...summary, total: totalAll },
      pagination: paginationMeta({ page, limit, total }),
      filters: { status: status || "all" },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCustomers,
  getCustomer,
  getCustomerAppointments,
  // Exported for unit tests.
  buildCustomerWhere,
  parsePagination,
  summarizeStats,
};
