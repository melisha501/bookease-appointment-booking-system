// Unit tests for pure scheduling logic (no database).
// Covers: different service durations, break overlap, past dates/times,
// and interval overlap detection (the basis for preventing overlapping bookings).

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  toMinutes,
  minutesToLabel,
  intervalsOverlap,
  fitsInWorkingHours,
  overlapsBreak,
  buildCandidateSlots,
  toOccupiedIntervals,
  findOverlappingOccupied,
  evaluateCandidate,
  isPastDate,
  isPastSlot,
  getWeekday,
} = require("../src/utils/scheduling");

test("toMinutes/minutesToLabel round-trip common labels", () => {
  assert.equal(toMinutes("09:00 AM"), 9 * 60);
  assert.equal(toMinutes("12:00 PM"), 12 * 60);
  assert.equal(toMinutes("12:00 AM"), 0);
  assert.equal(toMinutes("05:30 PM"), 17 * 60 + 30);
  assert.equal(minutesToLabel(9 * 60), "09:00 AM");
  assert.equal(minutesToLabel(13 * 60 + 5), "01:05 PM");
});

test("different service durations generate slots at the service interval and fit in hours", () => {
  const slots30 = buildCandidateSlots({
    startLabel: "09:00 AM",
    endLabel: "11:00 AM",
    durationMins: 30,
    stepMins: 30,
  });
  assert.deepEqual(
    slots30.map((s) => s.slot),
    ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM"]
  );

  const slots45 = buildCandidateSlots({
    startLabel: "09:00 AM",
    endLabel: "11:00 AM",
    durationMins: 45,
    stepMins: 45,
  });
  // 09:00-09:45 and 09:45-10:30 fit; 10:30-11:15 would extend beyond 11:00
  assert.deepEqual(slots45.map((s) => s.slot), ["09:00 AM", "09:45 AM"]);
  assert.ok(fitsInWorkingHours(slots45[1].startMins, slots45[1].endMins, toMinutes("09:00 AM"), toMinutes("11:00 AM")));
  assert.equal(fitsInWorkingHours(toMinutes("10:30 AM"), toMinutes("11:15 AM"), toMinutes("09:00 AM"), toMinutes("11:00 AM")), false);

  const slots60 = buildCandidateSlots({
    startLabel: "09:00 AM",
    endLabel: "12:00 PM",
    durationMins: 60,
    stepMins: 60,
  });
  assert.deepEqual(slots60.map((s) => s.slot), ["09:00 AM", "10:00 AM", "11:00 AM"]);
});

test("break overlap is detected for appointments that cross the break", () => {
  const breakStart = toMinutes("01:00 PM");
  const breakEnd = toMinutes("02:00 PM");

  assert.equal(overlapsBreak(toMinutes("12:30 PM"), toMinutes("01:30 PM"), breakStart, breakEnd), true);
  assert.equal(overlapsBreak(toMinutes("01:00 PM"), toMinutes("01:30 PM"), breakStart, breakEnd), true);
  assert.equal(overlapsBreak(toMinutes("01:30 PM"), toMinutes("02:30 PM"), breakStart, breakEnd), true);
  // Back-to-back with break is allowed (ends exactly when break starts, or starts when break ends)
  assert.equal(overlapsBreak(toMinutes("12:30 PM"), toMinutes("01:00 PM"), breakStart, breakEnd), false);
  assert.equal(overlapsBreak(toMinutes("02:00 PM"), toMinutes("02:30 PM"), breakStart, breakEnd), false);
  assert.equal(overlapsBreak(toMinutes("10:00 AM"), toMinutes("10:30 AM"), breakStart, breakEnd), false);
});

test("overlapping bookings are detected across different service durations", () => {
  // Existing: 10:00 AM for 60 mins (10:00-11:00)
  const occupied = toOccupiedIntervals([
    { time: "10:00 AM", service: { durationMins: 60 }, reference: "APT-A" },
  ]);

  // New 30-min at 10:30 overlaps existing 60-min appointment
  assert.equal(findOverlappingOccupied(toMinutes("10:30 AM"), toMinutes("11:00 AM"), occupied).length, 1);
  // New 30-min at 09:30 ends at 10:00 (back-to-back) - no overlap
  assert.equal(findOverlappingOccupied(toMinutes("09:30 AM"), toMinutes("10:00 AM"), occupied).length, 0);
  // New 45-min at 09:30 ends 10:15 - overlaps
  assert.equal(findOverlappingOccupied(toMinutes("09:30 AM"), toMinutes("10:15 AM"), occupied).length, 1);
  // Exact same start as existing - overlaps
  assert.equal(findOverlappingOccupied(toMinutes("10:00 AM"), toMinutes("10:30 AM"), occupied).length, 1);

  assert.equal(intervalsOverlap(600, 660, 630, 660), true);
  assert.equal(intervalsOverlap(570, 600, 600, 660), false);
});

test("pending and confirmed occupied intervals are both considered (via normalized input)", () => {
  // Controller loads status in pending/confirmed; normalization preserves any loaded rows.
  const occupied = toOccupiedIntervals([
    { time: "09:00 AM", durationMins: 30, status: "pending" },
    { time: "09:30 AM", durationMins: 30, status: "confirmed" },
  ]);
  assert.equal(occupied.length, 2);
  assert.equal(findOverlappingOccupied(toMinutes("09:15 AM"), toMinutes("09:45 AM"), occupied).length, 2);
});

test("past dates and past time slots are rejected", () => {
  const now = new Date(2026, 10, 9, 10, 0, 0); // Nov 9 2026 10:00 local
  assert.equal(isPastDate("2026-11-08", now), true);
  assert.equal(isPastDate("2026-11-09", now), false);
  assert.equal(isPastDate("2026-11-10", now), false);

  assert.equal(isPastSlot("2026-11-08", toMinutes("11:00 AM"), now), true);
  assert.equal(isPastSlot("2026-11-09", toMinutes("09:00 AM"), now), true);
  assert.equal(isPastSlot("2026-11-09", toMinutes("10:00 AM"), now), true); // exactly now => not bookable
  assert.equal(isPastSlot("2026-11-09", toMinutes("10:30 AM"), now), false);
  assert.equal(isPastSlot("2026-11-10", toMinutes("09:00 AM"), now), false);
});

test("evaluateCandidate preserves frontend slot shape and marks break/past/taken", () => {
  const now = new Date(2026, 10, 9, 10, 0, 0);
  const occupied = toOccupiedIntervals([{ time: "02:00 PM", durationMins: 30 }]);
  const candidate = { startMins: toMinutes("01:30 PM"), endMins: toMinutes("02:30 PM"), slot: "01:30 PM" };
  const result = evaluateCandidate({
    candidate,
    dateStr: "2026-11-10",
    now,
    breakStart: toMinutes("01:00 PM"),
    breakEnd: toMinutes("02:00 PM"),
    occupiedIntervals: occupied,
  });
  assert.deepEqual(Object.keys(result).sort(), ["available", "inBreak", "pastToday", "slot", "taken"]);
  assert.equal(result.slot, "01:30 PM");
  assert.equal(result.inBreak, true); // overlaps break
  assert.equal(result.taken, true); // overlaps occupied 2:00-2:30
  assert.equal(result.available, false);
});

test("getWeekday uses local calendar day", () => {
  assert.equal(getWeekday("2026-11-09"), "Mon"); // 2026-11-09 is a Monday
});
