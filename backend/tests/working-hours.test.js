// Working-hours controller tests with mocked Prisma (no real database).
// Verifies day/time normalization, schedule validation, date-exception
// validation, and the CRUD controller responses.

const test = require("node:test");
const assert = require("node:assert/strict");

function freshControllerWithPrisma(prismaMock) {
  process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb";
  const prismaPath = require.resolve("../src/lib/prisma");
  const controllerPath = require.resolve("../src/controllers/workingHoursController");
  const schedulingPath = require.resolve("../src/utils/scheduling");
  delete require.cache[controllerPath];
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prismaMock };
  delete require.cache[schedulingPath];
  return require("../src/controllers/workingHoursController");
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

const specialist = { id: "sp1", slug: "dr-a", name: "Dr A" };
const baseSchedule = {
  id: "wh1",
  specialistId: "sp1",
  days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  startTime: "09:00 AM",
  endTime: "05:00 PM",
  breakStart: "01:00 PM",
  breakEnd: "02:00 PM",
};

test("validateWeeklySchedule accepts full day names, dedupes, and sorts them", () => {
  const { validateWeeklySchedule } = freshControllerWithPrisma({});
  const result = validateWeeklySchedule({
    days: ["friday", "Monday", "WED", "monday"],
    start: "9:00 AM",
    end: "5:00 pm",
  });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.days, ["Mon", "Wed", "Fri"]);
  assert.equal(result.startTime, "09:00 AM");
  assert.equal(result.endTime, "05:00 PM");
  assert.equal(result.breakStart, null);
  assert.equal(result.breakEnd, null);
});

test("validateWeeklySchedule rejects missing/invalid days and empty selections", () => {
  const { validateWeeklySchedule } = freshControllerWithPrisma({});

  assert.match(validateWeeklySchedule({ days: "Mon", start: "09:00 AM", end: "05:00 PM" }).error, /array/i);
  assert.match(validateWeeklySchedule({ days: ["Funday"], start: "09:00 AM", end: "05:00 PM" }).error, /Invalid day/i);
  assert.match(validateWeeklySchedule({ days: [], start: "09:00 AM", end: "05:00 PM" }).error, /at least one working day/i);
});

test("validateWeeklySchedule enforces required, ordered, and valid times", () => {
  const { validateWeeklySchedule } = freshControllerWithPrisma({});

  assert.match(validateWeeklySchedule({ days: ["Mon"], start: "", end: "05:00 PM" }).error, /Opening time is required/i);
  assert.match(validateWeeklySchedule({ days: ["Mon"], start: "09:00 AM", end: "" }).error, /Closing time is required/i);
  assert.match(validateWeeklySchedule({ days: ["Mon"], start: "9 AM", end: "05:00 PM" }).error, /HH:MM AM\/PM/i);
  assert.match(validateWeeklySchedule({ days: ["Mon"], start: "05:00 PM", end: "09:00 AM" }).error, /after opening/i);
  assert.match(validateWeeklySchedule({ days: ["Mon"], start: "05:00 PM", end: "05:00 PM" }).error, /after opening/i);
});

test("validateWeeklySchedule enforces break pairing, ordering, and containment", () => {
  const { validateWeeklySchedule } = freshControllerWithPrisma({});

  assert.match(
    validateWeeklySchedule({ days: ["Mon"], start: "09:00 AM", end: "05:00 PM", breakStart: "01:00 PM" }).error,
    /Both break start and break end/i
  );
  assert.match(
    validateWeeklySchedule({ days: ["Mon"], start: "09:00 AM", end: "05:00 PM", breakStart: "02:00 PM", breakEnd: "01:00 PM" }).error,
    /after break start/i
  );
  assert.match(
    validateWeeklySchedule({ days: ["Mon"], start: "09:00 AM", end: "05:00 PM", breakStart: "08:00 AM", breakEnd: "09:30 AM" }).error,
    /within working hours/i
  );
  assert.match(
    validateWeeklySchedule({ days: ["Mon"], start: "09:00 AM", end: "05:00 PM", breakStart: "04:30 PM", breakEnd: "05:30 PM" }).error,
    /within working hours/i
  );

  const ok = validateWeeklySchedule({
    days: ["Mon"],
    start: "09:00 AM",
    end: "05:00 PM",
    breakStart: "12:00 PM",
    breakEnd: "01:00 PM",
  });
  assert.equal(ok.error, undefined);
  assert.equal(ok.breakStart, "12:00 PM");
  assert.equal(ok.breakEnd, "01:00 PM");
});

test("getWorkingHours returns schedule and date exceptions for the specialist", async () => {
  const prisma = {
    specialist: { findFirst: async () => specialist },
    workingHour: { findUnique: async () => baseSchedule },
    specialistDateException: {
      findMany: async () => [
        { id: "ex1", specialistId: "sp1", date: "2099-12-25", type: "holiday", note: "Christmas" },
      ],
    },
  };
  const { getWorkingHours } = freshControllerWithPrisma(prisma);
  const res = mockRes();
  await getWorkingHours({ params: { id: "dr-a" } }, res, (e) => { throw e; });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.specialistId, "dr-a");
  assert.deepEqual(res.body.schedule.days, baseSchedule.days);
  assert.equal(res.body.schedule.start, "09:00 AM");
  assert.equal(res.body.schedule.end, "05:00 PM");
  assert.equal(res.body.dateExceptions.length, 1);
  assert.equal(res.body.dateExceptions[0].type, "holiday");
});

test("getWorkingHours returns 404 for unknown specialists", async () => {
  const { getWorkingHours } = freshControllerWithPrisma({ specialist: { findFirst: async () => null } });
  const res = mockRes();
  await getWorkingHours({ params: { id: "missing" } }, res, (e) => { throw e; });
  assert.equal(res.statusCode, 404);
});

test("upsertWorkingHours normalizes and persists a valid schedule", async () => {
  let upsertArgs = null;
  const prisma = {
    specialist: { findFirst: async () => specialist },
    workingHour: {
      upsert: async (args) => {
        upsertArgs = args;
        return { ...baseSchedule, ...args.create, updatedAt: new Date("2026-01-01T00:00:00Z") };
      },
    },
  };
  const { upsertWorkingHours } = freshControllerWithPrisma(prisma);
  const res = mockRes();
  await upsertWorkingHours(
    {
      params: { id: "sp1" },
      body: {
        days: ["Sunday", "Mon", "tue"],
        start: "8:30 AM",
        end: "6:00 PM",
        breakStart: "12:30 PM",
        breakEnd: "1:15 PM",
      },
    },
    res,
    (e) => { throw e; }
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(upsertArgs.create.days, ["Mon", "Tue", "Sun"]);
  assert.equal(upsertArgs.create.startTime, "08:30 AM");
  assert.equal(upsertArgs.create.endTime, "06:00 PM");
  assert.equal(upsertArgs.create.breakStart, "12:30 PM");
  assert.equal(upsertArgs.create.breakEnd, "01:15 PM");
  assert.deepEqual(res.body.schedule.days, ["Mon", "Tue", "Sun"]);
});

test("upsertWorkingHours rejects invalid payloads with 400 and does not write", async () => {
  let wrote = false;
  const prisma = {
    specialist: { findFirst: async () => specialist },
    workingHour: {
      upsert: async () => {
        wrote = true;
        return baseSchedule;
      },
    },
  };
  const { upsertWorkingHours } = freshControllerWithPrisma(prisma);
  const res = mockRes();
  await upsertWorkingHours(
    { params: { id: "sp1" }, body: { days: ["Mon"], start: "09:00 AM", end: "08:00 AM" } },
    res,
    (e) => { throw e; }
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /after opening/i);
  assert.equal(wrote, false);
});

test("deleteWorkingHours removes the schedule row", async () => {
  let where = null;
  const prisma = {
    specialist: { findFirst: async () => specialist },
    workingHour: {
      deleteMany: async (args) => {
        where = args.where;
        return { count: 1 };
      },
    },
  };
  const { deleteWorkingHours } = freshControllerWithPrisma(prisma);
  const res = mockRes();
  await deleteWorkingHours({ params: { id: "dr-a" } }, res, (e) => { throw e; });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(where, { specialistId: "sp1" });
  assert.equal(res.body.schedule, null);
});

test("createDateException creates a new exception with 201", async () => {
  let created = null;
  const prisma = {
    specialist: { findFirst: async () => specialist },
    specialistDateException: {
      findUnique: async () => null,
      upsert: async (args) => {
        created = args;
        return { id: "ex1", ...args.create };
      },
    },
  };
  const { createDateException } = freshControllerWithPrisma(prisma);
  const res = mockRes();
  await createDateException(
    { params: { id: "sp1" }, body: { date: "2099-12-25", type: "holiday", note: "Christmas" } },
    res,
    (e) => { throw e; }
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.dateException.type, "holiday");
  assert.equal(res.body.dateException.note, "Christmas");
  assert.equal(created.create.date, "2099-12-25");
});

test("createDateException updates an existing exception with 200", async () => {
  let updated = null;
  const prisma = {
    specialist: { findFirst: async () => specialist },
    specialistDateException: {
      findUnique: async () => ({ id: "ex1", specialistId: "sp1", date: "2099-12-25", type: "unavailable" }),
      upsert: async (args) => {
        updated = args;
        return { id: "ex1", specialistId: "sp1", date: "2099-12-25", ...args.update };
      },
    },
  };
  const { createDateException } = freshControllerWithPrisma(prisma);
  const res = mockRes();
  await createDateException(
    { params: { id: "sp1" }, body: { date: "2099-12-25", type: "holiday", note: "Updated" } },
    res,
    (e) => { throw e; }
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.dateException.type, "holiday");
  assert.equal(updated.update.type, "holiday");
  assert.equal(updated.update.note, "Updated");
});

test("createDateException rejects invalid dates and types", async () => {
  const prisma = {
    specialist: { findFirst: async () => specialist },
    specialistDateException: {
      findUnique: async () => null,
      upsert: async () => {
        throw new Error("should not be called");
      },
    },
  };
  const { createDateException } = freshControllerWithPrisma(prisma);

  let res = mockRes();
  await createDateException({ params: { id: "sp1" }, body: { date: "2099-02-30", type: "holiday" } }, res, (e) => { throw e; });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /real calendar date/i);

  res = mockRes();
  await createDateException({ params: { id: "sp1" }, body: { date: "2099-02-28", type: "vacation" } }, res, (e) => { throw e; });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /holiday.*unavailable/i);
});

test("updateDateException supports partial updates and validates fields", async () => {
  let updateData = null;
  const prisma = {
    specialist: { findFirst: async () => specialist },
    specialistDateException: {
      findFirst: async () => ({ id: "ex1", specialistId: "sp1", date: "2099-12-25", type: "unavailable" }),
      update: async (args) => {
        updateData = args.data;
        return { id: "ex1", specialistId: "sp1", date: "2099-12-25", ...args.data };
      },
    },
  };
  const { updateDateException } = freshControllerWithPrisma(prisma);

  let res = mockRes();
  await updateDateException({ params: { id: "sp1", exceptionId: "ex1" }, body: { type: "holiday" } }, res, (e) => { throw e; });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(updateData, { type: "holiday" });

  res = mockRes();
  await updateDateException({ params: { id: "sp1", exceptionId: "ex1" }, body: { type: "vacation" } }, res, (e) => { throw e; });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /holiday.*unavailable/i);
});

test("updateDateException returns 404 when the exception does not exist", async () => {
  const prisma = {
    specialist: { findFirst: async () => specialist },
    specialistDateException: { findFirst: async () => null },
  };
  const { updateDateException } = freshControllerWithPrisma(prisma);
  const res = mockRes();
  await updateDateException({ params: { id: "sp1", exceptionId: "nope" }, body: { type: "holiday" } }, res, (e) => { throw e; });
  assert.equal(res.statusCode, 404);
});

test("deleteDateException deletes the matching exception", async () => {
  let deletedId = null;
  const prisma = {
    specialist: { findFirst: async () => specialist },
    specialistDateException: {
      findFirst: async () => ({ id: "ex1", specialistId: "sp1", date: "2099-12-25" }),
      delete: async (args) => {
        deletedId = args.where.id;
        return { id: "ex1" };
      },
    },
  };
  const { deleteDateException } = freshControllerWithPrisma(prisma);
  const res = mockRes();
  await deleteDateException({ params: { id: "sp1", exceptionId: "2099-12-25" } }, res, (e) => { throw e; });

  assert.equal(res.statusCode, 200);
  assert.equal(deletedId, "ex1");
  assert.equal(res.body.date, "2099-12-25");
});

test("listWorkingHours returns every specialist with schedule and exceptions", async () => {
  const prisma = {
    specialist: {
      findMany: async () => [
        { ...specialist, schedules: [baseSchedule], dateExceptions: [{ id: "ex1", specialistId: "sp1", date: "2099-12-25", type: "holiday" }] },
        { id: "sp2", slug: "dr-b", name: "Dr B", schedules: [], dateExceptions: [] },
      ],
    },
  };
  const { listWorkingHours } = freshControllerWithPrisma(prisma);
  const res = mockRes();
  await listWorkingHours({}, res, (e) => { throw e; });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.workingHours.length, 2);
  assert.equal(res.body.workingHours[0].specialistId, "dr-a");
  assert.deepEqual(res.body.workingHours[0].schedule.days, baseSchedule.days);
  assert.equal(res.body.workingHours[0].dateExceptions.length, 1);
  assert.equal(res.body.workingHours[1].schedule, null);
});
