// Admin dashboard statistics (admin only).
//
// All numbers are read live from PostgreSQL on every request so the dashboard
// always reflects the current customers, providers, services, and appointments.
// The queries are independent and run in parallel to keep the endpoint fast.

const prisma = require("../lib/prisma");
const { appointmentToClient } = require("../utils/appointmentView");
const {
  ALL_APPOINTMENT_STATUSES,
  STATUS_LABELS,
} = require("../utils/appointmentStatus");

const RECENT_APPOINTMENT_LIMIT = 6;
const BOOKING_ACTIVITY_DAYS = 7;

function rowCount(row) {
  if (!row || !row._count) return 0;
  if (typeof row._count === "number") return row._count;
  return Number(row._count._all || 0);
}

function emptyStatusCounts() {
  return Object.fromEntries(ALL_APPOINTMENT_STATUSES.map((status) => [status, 0]));
}

function isoDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function startOfUtcDay(value) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function summarizeStatusRows(rows = []) {
  const counts = emptyStatusCounts();
  let total = 0;

  for (const row of rows) {
    const count = rowCount(row);
    if (Object.prototype.hasOwnProperty.call(counts, row.status)) {
      counts[row.status] += count;
    }
    total += count;
  }

  return { counts, total };
}

function buildStatusBreakdown(counts, total) {
  return ALL_APPOINTMENT_STATUSES.map((status) => {
    const count = Number(counts?.[status] || 0);
    return {
      status,
      label: STATUS_LABELS[status],
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    };
  });
}

// Buckets bookings by the UTC day they were created. Always returns exactly
// BOOKING_ACTIVITY_DAYS entries (oldest first), including zero-count days, so
// the chart keeps a stable shape even when there are no recent bookings.
function buildBookingActivity(appointments = [], { now = new Date(), days = BOOKING_ACTIVITY_DAYS } = {}) {
  const buckets = new Map();
  const firstDay = startOfUtcDay(now);
  firstDay.setUTCDate(firstDay.getUTCDate() - (days - 1));

  for (let index = 0; index < days; index += 1) {
    const day = new Date(firstDay);
    day.setUTCDate(firstDay.getUTCDate() + index);
    buckets.set(isoDate(day), 0);
  }

  for (const appointment of appointments) {
    if (!appointment?.createdAt) continue;
    const key = isoDate(appointment.createdAt);
    if (buckets.has(key)) buckets.set(key, buckets.get(key) + 1);
  }

  return Array.from(buckets.entries()).map(([date, count]) => {
    const day = new Date(`${date}T00:00:00.000Z`);
    return {
      date,
      label: day.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      count,
    };
  });
}

// GET /api/dashboard/stats
async function getDashboardStats(_req, res, next) {
  try {
    const now = new Date();
    const activityStart = startOfUtcDay(now);
    activityStart.setUTCDate(activityStart.getUTCDate() - (BOOKING_ACTIVITY_DAYS - 1));

    const [
      totalCustomers,
      totalProviders,
      totalServices,
      providerAccounts,
      pendingProviderAccounts,
      pendingServiceApprovals,
      statusRows,
      recentAppointments,
      activityAppointments,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.specialist.count(),
      prisma.service.count(),
      prisma.provider.count(),
      prisma.provider.count({ where: { status: "pending" } }),
      prisma.service.count({ where: { approvalStatus: "pending" } }),
      prisma.appointment.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.appointment.findMany({
        include: { service: true, specialist: true },
        orderBy: [{ createdAt: "desc" }],
        take: RECENT_APPOINTMENT_LIMIT,
      }),
      prisma.appointment.findMany({
        where: { createdAt: { gte: activityStart } },
        select: { createdAt: true },
      }),
    ]);

    const { counts, total: totalAppointments } = summarizeStatusRows(statusRows);
    const statusBreakdown = buildStatusBreakdown(counts, totalAppointments);

    return res.json({
      success: true,
      generatedAt: now.toISOString(),
      stats: {
        totalCustomers,
        totalProviders,
        totalServices,
        providerAccounts,
        pendingProviderAccounts,
        pendingServiceApprovals,
        totalAppointments,
        pendingAppointments: counts.pending,
        confirmedAppointments: counts.confirmed,
        completedAppointments: counts.completed,
        cancelledAppointments: counts.cancelled,
        rejectedAppointments: counts.rejected,
      },
      statusBreakdown,
      bookingActivity: buildBookingActivity(activityAppointments, { now }),
      recentAppointments: recentAppointments.map(appointmentToClient),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboardStats,
  // Exported for unit tests.
  buildBookingActivity,
  buildStatusBreakdown,
  summarizeStatusRows,
};
