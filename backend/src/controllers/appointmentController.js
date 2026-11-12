// Appointments: availability, booking creation, customer "mine", cancellation.
// Scheduling rules (duration-based slots, overlap checks, breaks, past times,
// and concurrency protection) live in ../utils/scheduling and are applied here.

const prisma = require("../lib/prisma");
const {
  sendAppointmentConfirmation,
  sendAppointmentApproved,
  sendAppointmentStatusUpdate,
  sendAdminNewBookingNotification,
} = require("../services/emailService");
const {
  toMinutes,
  minutesToLabel,
  to24hIso,
  isValidDateString,
  getWeekday,
  isPastDate,
  isPastSlot,
  fitsInWorkingHours,
  overlapsBreak,
  buildCandidateSlots,
  toOccupiedIntervals,
  findOverlappingOccupied,
  evaluateCandidate,
} = require("../utils/scheduling");
const {
  APPOINTMENT_STATUS,
  ALL_APPOINTMENT_STATUSES,
  OCCUPIED_STATUSES,
  normalizeStatus,
  statusLabel,
  canAdminTransition,
  isCustomerCancellableStatus,
  allowedAdminTransitions,
} = require("../utils/appointmentStatus");
const { appointmentToClient } = require("../utils/appointmentView");

// Email is always best-effort: a provider/network failure must never roll back
// or corrupt an appointment record that was already saved.
async function notifySafely(label, send) {
  try {
    return await send();
  } catch (err) {
    console.error(`[appointments] ${label} email failed:`, err && err.message ? err.message : err);
    return { sent: false, error: err && err.message ? err.message : "Email send failed" };
  }
}

function makeReference() {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `APT-${suffix}`;
}

async function uniqueReference(tx) {
  for (let i = 0; i < 20; i += 1) {
    const ref = makeReference();
    const exists = await tx.appointment.findUnique({ where: { reference: ref } });
    if (!exists) return ref;
  }
  return `APT-${Date.now().toString(36).toUpperCase()}`;
}

async function resolveSpecialist(key, options = {}) {
  if (!key) return null;
  return prisma.specialist.findFirst({
    where: { OR: [{ slug: String(key) }, { id: String(key) }] },
    include: { schedules: Boolean(options.includeSchedules) },
  });
}

function exceptionReason(ex) {
  if (!ex) return "Specialist is not available on this date.";
  if (ex.type === "holiday") return ex.note ? `Holiday: ${ex.note}` : "Holiday. Specialist is not available on this date.";
  return ex.note ? `Unavailable: ${ex.note}` : "Specialist is marked unavailable on this date.";
}

async function safeFindDateException(db, specialistId, date) {
  if (!db || !db.specialistDateException || typeof db.specialistDateException.findUnique !== "function") {
    return null;
  }
  try {
    return await db.specialistDateException.findUnique({
      where: { specialistId_date: { specialistId, date: String(date) } },
    });
  } catch (err) {
    // Table may not exist until migrations/db push are applied.
    if (err && (err.code === "P2021" || /specialistDateException|does not exist/i.test(String(err.message || "")))) {
      return null;
    }
    throw err;
  }
}

async function resolveService(key) {
  if (!key) return null;
  return prisma.service.findFirst({
    where: { OR: [{ slug: String(key) }, { id: String(key) }] },
  });
}

function canCancelByTime(date, time) {
  const dt = new Date(`${date}T${to24hIso(time)}`);
  if (Number.isNaN(dt.getTime())) return { allowed: false, reason: "Invalid appointment time." };
  const hours = (dt.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hours <= 24) {
    return { allowed: false, reason: "Cancellation is allowed only more than 24 hours before the appointment." };
  }
  return { allowed: true };
}

async function lockSpecialistDate(tx, specialistId, date) {
  // PostgreSQL transaction-scoped advisory lock. This serializes booking checks
  // for the same specialist+date so two requests cannot both pass the overlap
  // check at the same moment (protects against simultaneous bookings).
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${String(specialistId)}), hashtext(${String(date)}))`;
}

async function loadOccupiedIntervals(tx, { specialistId, date }) {
  const booked = await tx.appointment.findMany({
    where: {
      specialistId,
      date: String(date),
      status: { in: OCCUPIED_STATUSES },
    },
    select: {
      reference: true,
      time: true,
      service: { select: { durationMins: true } },
    },
  });
  return toOccupiedIntervals(booked);
}

async function getAvailability(req, res, next) {
  try {
    const { specialistId, date } = req.query;
    const serviceKey = req.query.serviceId || req.query.service;

    if (!specialistId || !date) {
      return res.status(400).json({ success: false, message: "specialistId and date are required." });
    }
    if (!serviceKey) {
      return res.status(400).json({ success: false, message: "serviceId is required to generate duration-based time slots." });
    }
    if (!isValidDateString(date)) {
      return res.status(400).json({ success: false, message: "date must be YYYY-MM-DD." });
    }
    if (isPastDate(String(date))) {
      return res.json({
        success: true,
        specialistId: String(specialistId),
        date: String(date),
        closed: true,
        slots: [],
        reason: "Past dates are not available.",
      });
    }

    const [specialist, service] = await Promise.all([
      resolveSpecialist(specialistId, { includeSchedules: true }),
      resolveService(serviceKey),
    ]);
    if (!specialist) return res.status(404).json({ success: false, message: "Specialist not found." });
    if (!service) return res.status(404).json({ success: false, message: "Service not found." });
    if (!Number.isFinite(Number(service.durationMins)) || Number(service.durationMins) <= 0) {
      return res.status(400).json({ success: false, message: "Service duration is not configured." });
    }

    const wh = specialist.schedules?.[0];
    if (!wh) {
      return res.json({ success: true, specialistId: specialist.slug, date: String(date), closed: true, slots: [], reason: "No schedule configured." });
    }

    const dateException = await safeFindDateException(prisma, specialist.id, date);
    if (dateException) {
      return res.json({
        success: true,
        specialistId: specialist.slug,
        date: String(date),
        closed: true,
        slots: [],
        reason: exceptionReason(dateException),
      });
    }

    const day = getWeekday(String(date));
    if (!Array.isArray(wh.days) || !wh.days.includes(day)) {
      return res.json({ success: true, specialistId: specialist.slug, date: String(date), closed: true, slots: [], reason: "Specialist is not available on this day." });
    }

    const breakStart = toMinutes(wh.breakStart);
    const breakEnd = toMinutes(wh.breakEnd);
    const candidates = buildCandidateSlots({
      startLabel: wh.startTime,
      endLabel: wh.endTime,
      durationMins: service.durationMins,
      stepMins: service.durationMins, // interval follows selected service duration
    });

    if (!candidates.length) {
      return res.json({
        success: true,
        specialistId: specialist.slug,
        specialistName: specialist.name,
        date: String(date),
        closed: true,
        serviceId: service.slug || service.id,
        durationMins: service.durationMins,
        schedule: { days: wh.days, start: wh.startTime, end: wh.endTime, breakStart: wh.breakStart, breakEnd: wh.breakEnd },
        slots: [],
        reason: "No time slots fit within working hours for this service duration.",
      });
    }

    const occupiedIntervals = await loadOccupiedIntervals(prisma, {
      specialistId: specialist.id,
      date: String(date),
    });
    const now = new Date();
    const slots = candidates.map((candidate) =>
      evaluateCandidate({ candidate, dateStr: String(date), now, breakStart, breakEnd, occupiedIntervals })
    );

    res.json({
      success: true,
      specialistId: specialist.slug,
      specialistName: specialist.name,
      date: String(date),
      closed: false,
      serviceId: service.slug || service.id,
      durationMins: service.durationMins,
      schedule: { days: wh.days, start: wh.startTime, end: wh.endTime, breakStart: wh.breakStart, breakEnd: wh.breakEnd },
      slots,
    });
  } catch (err) {
    next(err);
  }
}

async function createAppointment(req, res, next) {
  try {
    const body = req.body || {};
    const serviceKey = body.serviceId || body.service;
    const specialistKey = body.specialistId || body.specialist;
    const { date, time, notes } = body;
    const customerName = body.customerName || body.name || body.customer;
    const customerEmail = body.customerEmail || body.email;
    const customerPhone = body.customerPhone || body.phone || "";

    if (!serviceKey || !specialistKey || !date || !time) {
      return res.status(400).json({ success: false, message: "Service, specialist, date, and time are required." });
    }
    if (!customerName || !String(customerName).trim()) {
      return res.status(400).json({ success: false, message: "Customer name is required." });
    }
    if (!customerEmail || !/^\S+@\S+\.\S+$/.test(String(customerEmail))) {
      return res.status(400).json({ success: false, message: "A valid email is required." });
    }
    if (!isValidDateString(date)) {
      return res.status(400).json({ success: false, message: "Invalid date." });
    }

    if (isPastDate(String(date))) {
      return res.status(400).json({ success: false, message: "Past dates are not allowed." });
    }

    const slotStartMins = toMinutes(time);
    if (slotStartMins == null) {
      return res.status(400).json({ success: false, message: "Invalid time format." });
    }
    if (isPastSlot(String(date), slotStartMins)) {
      return res.status(400).json({ success: false, message: "Past time slots are not allowed." });
    }

    const [service, specialist] = await Promise.all([resolveService(serviceKey), resolveSpecialist(specialistKey)]);
    if (!service) return res.status(404).json({ success: false, message: "Service not found." });
    if (!specialist) return res.status(404).json({ success: false, message: "Specialist not found." });
    const durationMins = Number(service.durationMins);
    if (!Number.isFinite(durationMins) || durationMins <= 0) {
      return res.status(400).json({ success: false, message: "Service duration is not configured." });
    }

    // Validate specialist is assigned to service
    const assignment = await prisma.specialistService.findFirst({
      where: { specialistId: specialist.id, serviceId: service.id },
    });
    if (!assignment) {
      return res.status(400).json({ success: false, message: "Selected specialist does not provide this service." });
    }

    // Validate schedule and conflicts inside a transaction. A PostgreSQL advisory
    // lock serializes checks for the same specialist+date so simultaneous requests
    // cannot double-book (requirement 7). Both pending and confirmed appointments
    // are treated as occupied (requirement 3).
    const appointment = await prisma.$transaction(async (tx) => {
      await lockSpecialistDate(tx, specialist.id, String(date));

      const dateException = await safeFindDateException(tx, specialist.id, date);
      if (dateException) {
        throw Object.assign(new Error(exceptionReason(dateException)), { status: 400 });
      }

      const wh = await tx.workingHour.findUnique({ where: { specialistId: specialist.id } });
      if (!wh) throw Object.assign(new Error("Specialist schedule is not configured."), { status: 400 });

      const day = getWeekday(String(date));
      if (!Array.isArray(wh.days) || !wh.days.includes(day)) {
        throw Object.assign(new Error("Specialist is not available on the selected date."), { status: 400 });
      }

      const workStart = toMinutes(wh.startTime);
      const workEnd = toMinutes(wh.endTime);
      const breakStart = toMinutes(wh.breakStart);
      const breakEnd = toMinutes(wh.breakEnd);
      const slotEndMins = slotStartMins + durationMins;

      if (!fitsInWorkingHours(slotStartMins, slotEndMins, workStart, workEnd)) {
        throw Object.assign(new Error("Selected time does not fit within working hours for this service."), { status: 400 });
      }
      if (overlapsBreak(slotStartMins, slotEndMins, breakStart, breakEnd)) {
        throw Object.assign(new Error("Selected time overlaps with a break."), { status: 400 });
      }

      const occupiedIntervals = await loadOccupiedIntervals(tx, {
        specialistId: specialist.id,
        date: String(date),
      });
      const overlaps = findOverlappingOccupied(slotStartMins, slotEndMins, occupiedIntervals);
      if (overlaps.length) {
        throw Object.assign(new Error("This time slot is no longer available. Please choose another slot."), { status: 409 });
      }

      const reference = await uniqueReference(tx);
      return tx.appointment.create({
        data: {
          reference,
          customerId: req.user?.id || null,
          customerName: String(customerName).trim(),
          customerEmail: String(customerEmail).trim().toLowerCase(),
          customerPhone: customerPhone ? String(customerPhone).trim() : null,
          serviceId: service.id,
          specialistId: specialist.id,
          date: String(date),
          time: minutesToLabel(slotStartMins), // normalize for consistent storage
          status: "pending",
          notes: notes ? String(notes) : null,
        },
        include: { service: true, specialist: true },
      });
    });

    // Best-effort notifications, sent only after the booking is persisted.
    // A send failure must never undo or invalidate the booking.
    await Promise.all([
      notifySafely("booking confirmation", () => sendAppointmentConfirmation(appointment)),
      notifySafely("admin new-booking notification", () => sendAdminNewBookingNotification(appointment)),
    ]);

    res.status(201).json({
      success: true,
      message: "Appointment booked successfully.",
      appointment: appointmentToClient(appointment),
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
}

async function listMine(req, res, next) {
  try {
    const items = await prisma.appointment.findMany({
      where: { customerId: req.user.id },
      include: { service: true, specialist: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    res.json({ success: true, appointments: items.map(appointmentToClient) });
  } catch (err) {
    next(err);
  }
}

function customerCancellationBlockedReason(status) {
  const normalized = normalizeStatus(status);
  if (normalized === APPOINTMENT_STATUS.COMPLETED) return "Completed appointments cannot be cancelled.";
  if (normalized === APPOINTMENT_STATUS.CANCELLED) return "This appointment has already been cancelled.";
  if (normalized === APPOINTMENT_STATUS.REJECTED) return "This appointment was rejected and cannot be cancelled.";
  if (!isCustomerCancellableStatus(normalized)) return "Only pending or confirmed appointments can be cancelled.";
  return null;
}

async function cancelMine(req, res, next) {
  try {
    const { reference } = req.params;
    const appt = await prisma.appointment.findFirst({
      where: { reference, customerId: req.user.id },
      include: { service: true, specialist: true },
    });
    if (!appt) return res.status(404).json({ success: false, message: "Appointment not found." });

    const blockedReason = customerCancellationBlockedReason(appt.status);
    if (blockedReason) {
      return res.status(400).json({ success: false, message: blockedReason });
    }

    const rule = canCancelByTime(appt.date, appt.time);
    if (!rule.allowed) return res.status(400).json({ success: false, message: rule.reason });

    const updated = await prisma.appointment.update({
      where: { id: appt.id },
      data: { status: APPOINTMENT_STATUS.CANCELLED },
      include: { service: true, specialist: true },
    });

    // Best-effort cancellation email; the status update is already persisted.
    await notifySafely("cancellation", () => sendAppointmentStatusUpdate(updated, appt.status));

    res.json({ success: true, message: "Appointment cancelled.", appointment: appointmentToClient(updated) });
  } catch (err) {
    next(err);
  }
}

// Admin: list all + update status (basic, for dashboard integration)
async function listAll(_req, res, next) {
  try {
    const items = await prisma.appointment.findMany({
      include: { service: true, specialist: true, customer: { select: { id: true, name: true, email: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    res.json({ success: true, appointments: items.map(appointmentToClient) });
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { reference } = req.params;
    const nextStatus = normalizeStatus(req.body?.status);
    if (!nextStatus) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${ALL_APPOINTMENT_STATUSES.join(", ")}.`,
      });
    }

    const appt = await prisma.appointment.findUnique({ where: { reference } });
    if (!appt) return res.status(404).json({ success: false, message: "Appointment not found." });

    const previousStatus = normalizeStatus(appt.status);
    if (previousStatus === nextStatus) {
      return res.status(400).json({
        success: false,
        message: `Appointment is already ${statusLabel(nextStatus).toLowerCase()}.`,
      });
    }
    if (!canAdminTransition(previousStatus, nextStatus)) {
      const allowed = allowedAdminTransitions(previousStatus)
        .map((s) => statusLabel(s).toLowerCase())
        .join(", ");
      return res.status(400).json({
        success: false,
        message: allowed
          ? `Cannot change a ${statusLabel(previousStatus).toLowerCase()} appointment to ${statusLabel(nextStatus).toLowerCase()}. Allowed: ${allowed}.`
          : `A ${statusLabel(previousStatus).toLowerCase()} appointment cannot be changed.`,
      });
    }

    const updated = await prisma.appointment.update({
      where: { id: appt.id },
      data: { status: nextStatus },
      include: { service: true, specialist: true },
    });

    // Best-effort emails. Approval gets its own confirmation email; other
    // status changes (rejected/cancelled/completed) get a status update email.
    if (nextStatus === APPOINTMENT_STATUS.CONFIRMED) {
      await notifySafely("approval", () => sendAppointmentApproved(updated));
    } else {
      await notifySafely("status update", () => sendAppointmentStatusUpdate(updated, previousStatus));
    }

    res.json({
      success: true,
      message: `Appointment marked as ${statusLabel(nextStatus).toLowerCase()}.`,
      appointment: appointmentToClient(updated),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAvailability,
  createAppointment,
  listMine,
  cancelMine,
  listAll,
  updateStatus,
};
