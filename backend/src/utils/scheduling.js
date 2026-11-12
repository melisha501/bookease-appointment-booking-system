// Pure scheduling helpers (no database). Used by the appointment controller
// and covered by unit tests.

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Convert "HH:MM AM/PM" to minutes from midnight. Returns null if invalid. */
function toMinutes(label) {
  const normalized = String(label || "").replace(/\s+/g, " ").trim();
  const match = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let [, h, m, meridiem] = match;
  h = Number(h);
  const mins = Number(m);
  if (!Number.isFinite(h) || !Number.isFinite(mins) || h < 1 || h > 12 || mins < 0 || mins > 59) return null;
  if (meridiem.toUpperCase() === "PM" && h !== 12) h += 12;
  if (meridiem.toUpperCase() === "AM" && h === 12) h = 0;
  return h * 60 + mins;
}

/** Convert minutes from midnight to "HH:MM AM/PM". */
function minutesToLabel(total) {
  const t = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  let h = Math.floor(t / 60);
  const m = t % 60;
  const meridiem = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${meridiem}`;
}

/** "HH:MM AM/PM" -> "HH:MM:00" (24h) for building local datetimes. */
function to24hIso(timeLabel) {
  const mins = toMinutes(timeLabel);
  if (mins == null) return "00:00:00";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

function isValidDateString(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(date || ""));
}

function todayDateString(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getWeekday(dateStr) {
  // Use local midnight so weekday matches the selected calendar day.
  return WEEKDAYS[new Date(`${dateStr}T00:00:00`).getDay()];
}

function isPastDate(dateStr, now = new Date()) {
  if (!isValidDateString(dateStr)) return true;
  return dateStr < todayDateString(now);
}

function isPastSlot(dateStr, startMins, now = new Date()) {
  if (!isValidDateString(dateStr) || startMins == null) return true;
  const today = todayDateString(now);
  if (dateStr < today) return true;
  if (dateStr > today) return false;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return startMins <= nowMins;
}

/** Two half-open intervals [aStart,aEnd) and [bStart,bEnd) overlap? */
function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  if ([aStart, aEnd, bStart, bEnd].some((v) => v == null)) return false;
  return aStart < bEnd && aEnd > bStart;
}

function fitsInWorkingHours(startMins, endMins, workStart, workEnd) {
  if ([startMins, endMins, workStart, workEnd].some((v) => v == null)) return false;
  return startMins >= workStart && endMins <= workEnd;
}

function overlapsBreak(startMins, endMins, breakStart, breakEnd) {
  if (breakStart == null || breakEnd == null) return false;
  return intervalsOverlap(startMins, endMins, breakStart, breakEnd);
}

/**
 * Build candidate start times for a service.
 * stepMins controls spacing between start options (defaults to durationMins).
 * Only candidates whose full duration fits inside [workStart, workEnd) are returned.
 */
function buildCandidateSlots({ startLabel, endLabel, durationMins, stepMins }) {
  const workStart = toMinutes(startLabel);
  const workEnd = toMinutes(endLabel);
  const duration = Number(durationMins);
  const step = Number(stepMins || durationMins);
  if (
    workStart == null ||
    workEnd == null ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    !Number.isFinite(step) ||
    step <= 0 ||
    workEnd <= workStart
  ) {
    return [];
  }
  const slots = [];
  for (let t = workStart; t + duration <= workEnd; t += step) {
    slots.push({
      startMins: t,
      endMins: t + duration,
      slot: minutesToLabel(t),
      timeLabel: minutesToLabel(t),
    });
  }
  return slots;
}

/**
 * Normalize occupied appointments into minute intervals.
 * items: [{ time: "HH:MM AM/PM", service?: { durationMins }, durationMins? }]
 */
function toOccupiedIntervals(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const startMins = toMinutes(item.time || item.slot);
      const duration = Number(item.durationMins ?? item.service?.durationMins);
      if (startMins == null || !Number.isFinite(duration) || duration <= 0) return null;
      return {
        startMins,
        endMins: startMins + duration,
        reference: item.reference || item.id || null,
      };
    })
    .filter(Boolean);
}

function findOverlappingOccupied(startMins, endMins, occupiedIntervals) {
  return (occupiedIntervals || []).filter((occ) => intervalsOverlap(startMins, endMins, occ.startMins, occ.endMins));
}

/**
 * Evaluate a candidate slot for availability display.
 * Keeps the existing slot shape (slot/available/taken/inBreak/pastToday) for
 * frontend compatibility and adds a few safe flags.
 */
function evaluateCandidate({ candidate, dateStr, now = new Date(), breakStart, breakEnd, occupiedIntervals }) {
  const overlaps = findOverlappingOccupied(candidate.startMins, candidate.endMins, occupiedIntervals);
  const taken = overlaps.length > 0;
  const inBreak = overlapsBreak(candidate.startMins, candidate.endMins, breakStart, breakEnd);
  const pastToday = isPastSlot(dateStr, candidate.startMins, now);
  const available = !taken && !inBreak && !pastToday;
  return {
    slot: candidate.slot,
    available,
    taken,
    inBreak,
    pastToday,
  };
}

module.exports = {
  WEEKDAYS,
  toMinutes,
  minutesToLabel,
  to24hIso,
  isValidDateString,
  todayDateString,
  getWeekday,
  isPastDate,
  isPastSlot,
  intervalsOverlap,
  fitsInWorkingHours,
  overlapsBreak,
  buildCandidateSlots,
  toOccupiedIntervals,
  findOverlappingOccupied,
  evaluateCandidate,
};
