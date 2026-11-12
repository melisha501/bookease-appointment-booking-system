// Admin working-hours management for specialists (service providers).
// Handles weekly schedule CRUD and specific-date exceptions (holidays/unavailable).

const prisma = require("../lib/prisma");
const { toMinutes, isValidDateString } = require("../utils/scheduling");

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_ALIASES = new Map(
  DAY_ORDER.flatMap((day) => [
    [day.toLowerCase(), day],
    [
      {
        Mon: "monday",
        Tue: "tuesday",
        Wed: "wednesday",
        Thu: "thursday",
        Fri: "friday",
        Sat: "saturday",
        Sun: "sunday",
      }[day],
      day,
    ],
  ])
);
const TIME_RE = /^\d{1,2}:\d{2}\s*(AM|PM)$/i;

async function findSpecialistByKey(key) {
  if (!key) return null;
  return prisma.specialist.findFirst({
    where: { OR: [{ slug: String(key) }, { id: String(key) }] },
  });
}

function normalizeTime(value, fieldName) {
  if (value == null || String(value).trim() === "") return null;
  const s = String(value).replace(/\s+/g, " ").trim();
  if (!TIME_RE.test(s)) {
    return { error: `${fieldName} must be in HH:MM AM/PM format (e.g., 09:00 AM).` };
  }
  if (toMinutes(s) == null) {
    return { error: `${fieldName} is not a valid time.` };
  }
  // Normalize spacing/casing for consistent storage
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  return `${String(m[1]).padStart(2, "0")}:${m[2]} ${m[3].toUpperCase()}`;
}

function normalizeDays(input) {
  if (!Array.isArray(input)) return { error: "Working days must be an array (e.g., [\"Mon\",\"Tue\"])." };
  const out = [];
  const seen = new Set();
  for (const raw of input) {
    const key = String(raw ?? "").trim().toLowerCase();
    const day = DAY_ALIASES.get(key);
    if (!day) {
      return { error: `Invalid day "${raw}". Use Mon, Tue, Wed, Thu, Fri, Sat, or Sun (full day names are also accepted).` };
    }
    if (!seen.has(day)) {
      seen.add(day);
      out.push(day);
    }
  }
  if (out.length === 0) {
    return { error: "Select at least one working day, or delete the weekly schedule if this provider is unavailable." };
  }
  // Keep a stable week order for readability
  out.sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
  return out;
}

function isValidCalendarDate(date) {
  if (!isValidDateString(date)) return false;
  const [year, month, day] = String(date).split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

function validateWeeklySchedule(body) {
  const daysResult = normalizeDays(body.days);
  if (daysResult && daysResult.error) return daysResult;

  const start = normalizeTime(body.startTime ?? body.start, "Opening time");
  if (start && start.error) return start;
  const end = normalizeTime(body.endTime ?? body.end, "Closing time");
  if (end && end.error) return end;

  if (!start) return { error: "Opening time is required." };
  if (!end) return { error: "Closing time is required." };

  const startM = toMinutes(start);
  const endM = toMinutes(end);
  if (startM == null || endM == null) return { error: "Opening/closing times are invalid." };
  if (endM <= startM) return { error: "Closing time must be after opening time." };

  const hasBreakStart = body.breakStart != null && String(body.breakStart).trim() !== "";
  const hasBreakEnd = body.breakEnd != null && String(body.breakEnd).trim() !== "";
  if (hasBreakStart !== hasBreakEnd) {
    return { error: "Both break start and break end are required when setting a break, or leave both empty." };
  }

  let breakStart = null;
  let breakEnd = null;
  if (hasBreakStart && hasBreakEnd) {
    const bs = normalizeTime(body.breakStart, "Break start time");
    if (bs && bs.error) return bs;
    const be = normalizeTime(body.breakEnd, "Break end time");
    if (be && be.error) return be;
    const bsM = toMinutes(bs);
    const beM = toMinutes(be);
    if (beM <= bsM) return { error: "Break end time must be after break start time." };
    if (bsM < startM || beM > endM) {
      return { error: "Break must be within working hours." };
    }
    breakStart = bs;
    breakEnd = be;
  }

  return {
    days: daysResult,
    startTime: start,
    endTime: end,
    breakStart,
    breakEnd,
  };
}

function scheduleToClient(wh) {
  if (!wh) return null;
  return {
    days: Array.isArray(wh.days) ? wh.days : [],
    start: wh.startTime,
    end: wh.endTime,
    startTime: wh.startTime,
    endTime: wh.endTime,
    breakStart: wh.breakStart || "",
    breakEnd: wh.breakEnd || "",
    updatedAt: wh.updatedAt,
  };
}

function exceptionToClient(ex) {
  if (!ex) return null;
  return {
    id: ex.id,
    specialistId: ex.specialistId,
    date: ex.date,
    type: ex.type || "unavailable",
    note: ex.note || "",
    createdAt: ex.createdAt,
    updatedAt: ex.updatedAt,
  };
}

async function listWorkingHours(_req, res, next) {
  try {
    const specialists = await prisma.specialist.findMany({
      include: {
        schedules: true,
        dateExceptions: { orderBy: [{ date: "asc" }, { createdAt: "asc" }] },
      },
      orderBy: { name: "asc" },
    });

    res.json({
      success: true,
      workingHours: specialists.map((specialist) => ({
        specialistId: specialist.slug || specialist.id,
        specialistName: specialist.name,
        schedule: scheduleToClient(specialist.schedules?.[0]),
        dateExceptions: (specialist.dateExceptions || []).map(exceptionToClient),
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function getWorkingHours(req, res, next) {
  try {
    const specialist = await findSpecialistByKey(req.params.id);
    if (!specialist) return res.status(404).json({ success: false, message: "Specialist not found." });

    const wh = await prisma.workingHour.findUnique({ where: { specialistId: specialist.id } });
    let exceptions = [];
    try {
      exceptions = await prisma.specialistDateException.findMany({
        where: { specialistId: specialist.id },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      });
    } catch (err) {
      if (!(err && (err.code === "P2021" || /specialistDateException|does not exist/i.test(String(err.message || ""))))) {
        throw err;
      }
    }

    res.json({
      success: true,
      specialistId: specialist.slug || specialist.id,
      specialistName: specialist.name,
      schedule: scheduleToClient(wh),
      dateExceptions: exceptions.map(exceptionToClient),
    });
  } catch (err) {
    next(err);
  }
}

async function upsertWorkingHours(req, res, next) {
  try {
    const specialist = await findSpecialistByKey(req.params.id);
    if (!specialist) return res.status(404).json({ success: false, message: "Specialist not found." });

    const validated = validateWeeklySchedule(req.body || {});
    if (validated.error) return res.status(400).json({ success: false, message: validated.error });

    const wh = await prisma.workingHour.upsert({
      where: { specialistId: specialist.id },
      create: {
        specialistId: specialist.id,
        days: validated.days,
        startTime: validated.startTime,
        endTime: validated.endTime,
        breakStart: validated.breakStart,
        breakEnd: validated.breakEnd,
      },
      update: {
        days: validated.days,
        startTime: validated.startTime,
        endTime: validated.endTime,
        breakStart: validated.breakStart,
        breakEnd: validated.breakEnd,
      },
    });

    res.json({
      success: true,
      message: "Working hours saved.",
      specialistId: specialist.slug || specialist.id,
      schedule: scheduleToClient(wh),
    });
  } catch (err) {
    next(err);
  }
}

async function deleteWorkingHours(req, res, next) {
  try {
    const specialist = await findSpecialistByKey(req.params.id);
    if (!specialist) return res.status(404).json({ success: false, message: "Specialist not found." });

    await prisma.workingHour.deleteMany({ where: { specialistId: specialist.id } });

    res.json({
      success: true,
      message: "Working hours deleted.",
      specialistId: specialist.slug || specialist.id,
      schedule: null,
    });
  } catch (err) {
    next(err);
  }
}

function validateDateException(body, options = {}) {
  const partial = Boolean(options.partial);
  const data = {};

  if (!partial || Object.prototype.hasOwnProperty.call(body, "date")) {
    const date = String(body.date ?? "").trim();
    if (!isValidCalendarDate(date)) return { error: "Date is required in YYYY-MM-DD format and must be a real calendar date." };
    data.date = date;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, "type")) {
    const rawType = String(body.type ?? "unavailable").trim().toLowerCase();
    if (rawType !== "holiday" && rawType !== "unavailable") {
      return { error: "Type must be either \"holiday\" or \"unavailable\"." };
    }
    data.type = rawType;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, "note")) {
    const note = body.note != null ? String(body.note).trim().slice(0, 200) : null;
    data.note = note || null;
  }

  if (partial && Object.keys(data).length === 0) {
    return { error: "No valid fields to update." };
  }

  return { data };
}

async function createDateException(req, res, next) {
  try {
    const specialist = await findSpecialistByKey(req.params.id);
    if (!specialist) return res.status(404).json({ success: false, message: "Specialist not found." });

    const validated = validateDateException(req.body || {});
    if (validated.error) return res.status(400).json({ success: false, message: validated.error });

    const existing = await prisma.specialistDateException.findUnique({
      where: { specialistId_date: { specialistId: specialist.id, date: validated.data.date } },
    });

    const ex = await prisma.specialistDateException.upsert({
      where: { specialistId_date: { specialistId: specialist.id, date: validated.data.date } },
      create: {
        specialistId: specialist.id,
        date: validated.data.date,
        type: validated.data.type,
        note: validated.data.note,
      },
      update: {
        type: validated.data.type,
        note: validated.data.note,
      },
    });

    res.status(existing ? 200 : 201).json({
      success: true,
      message: existing ? "Unavailable date updated." : "Unavailable date saved.",
      dateException: exceptionToClient(ex),
    });
  } catch (err) {
    next(err);
  }
}

async function updateDateException(req, res, next) {
  try {
    const specialist = await findSpecialistByKey(req.params.id);
    if (!specialist) return res.status(404).json({ success: false, message: "Specialist not found." });

    const exceptionId = req.params.exceptionId;
    const existing = await prisma.specialistDateException.findFirst({
      where: {
        specialistId: specialist.id,
        OR: [{ id: exceptionId }, { date: String(exceptionId) }],
      },
    });
    if (!existing) return res.status(404).json({ success: false, message: "Date exception not found." });

    const validated = validateDateException(req.body || {}, { partial: true });
    if (validated.error) return res.status(400).json({ success: false, message: validated.error });

    const ex = await prisma.specialistDateException.update({ where: { id: existing.id }, data: validated.data });
    res.json({ success: true, message: "Date exception updated.", dateException: exceptionToClient(ex) });
  } catch (err) {
    if (err && err.code === "P2002") {
      return res.status(409).json({ success: false, message: "An exception already exists for that date." });
    }
    next(err);
  }
}

async function deleteDateException(req, res, next) {
  try {
    const specialist = await findSpecialistByKey(req.params.id);
    if (!specialist) return res.status(404).json({ success: false, message: "Specialist not found." });

    const exceptionId = req.params.exceptionId;
    const existing = await prisma.specialistDateException.findFirst({
      where: {
        specialistId: specialist.id,
        OR: [{ id: exceptionId }, { date: String(exceptionId) }],
      },
    });
    if (!existing) return res.status(404).json({ success: false, message: "Date exception not found." });

    await prisma.specialistDateException.delete({ where: { id: existing.id } });
    res.json({ success: true, message: "Date exception deleted.", id: existing.id, date: existing.date });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listWorkingHours,
  getWorkingHours,
  upsertWorkingHours,
  deleteWorkingHours,
  createDateException,
  updateDateException,
  deleteDateException,
  validateWeeklySchedule,
  scheduleToClient,
  exceptionToClient,
};
