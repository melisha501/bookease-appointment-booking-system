// Controller integration tests for appointment email notifications.
// Prisma and the email service are mocked, so no database or Resend API calls
// are made. These tests verify that emails are sent only after a successful
// database operation and that email failures never break the API response.

const test = require("node:test");
const assert = require("node:assert/strict");

const { minutesToLabel } = require("../src/utils/scheduling");

function freshController({ prisma, email }) {
  process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb";
  const prismaPath = require.resolve("../src/lib/prisma");
  const controllerPath = require.resolve("../src/controllers/appointmentController");
  const emailPath = require.resolve("../src/services/emailService");

  delete require.cache[controllerPath];
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
  require.cache[emailPath] = { id: emailPath, filename: emailPath, loaded: true, exports: email };

  return require("../src/controllers/appointmentController");
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

function makeEmailMock(events = []) {
  return {
    sendAppointmentConfirmation: async (appointment) => {
      events.push({ type: "customer-confirmation", appointment });
      return { sent: true, id: "customer_1" };
    },
    sendAppointmentApproved: async (appointment) => {
      events.push({ type: "customer-approved", appointment });
      return { sent: true, id: "approved_1" };
    },
    sendAppointmentStatusUpdate: async (appointment, previousStatus) => {
      events.push({ type: "customer-status", appointment, previousStatus });
      return { sent: true, id: "status_1" };
    },
    sendAdminNewBookingNotification: async (appointment) => {
      events.push({ type: "admin-notification", appointment });
      return { sent: true, id: "admin_1" };
    },
  };
}

const specialist = { id: "sp-1", slug: "dr-a", name: "Dr. A" };
const service = { id: "svc-1", slug: "svc-1", name: "Consultation", durationMins: 30 };

function makeCreatedAppointment(overrides = {}) {
  return {
    id: "appt-new",
    reference: "APT-NEW123",
    customerId: null,
    customerName: "New Customer",
    customerEmail: "new@example.test",
    customerPhone: null,
    serviceId: service.id,
    specialistId: specialist.id,
    date: "2099-01-06",
    time: "09:00 AM",
    status: "pending",
    notes: null,
    service,
    specialist,
    ...overrides,
  };
}

function makeCreatePrisma(events = [], overrides = {}) {
  const tx = {
    $executeRaw: async () => 1,
    workingHour: {
      findUnique: async () => ({
        days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        startTime: "09:00 AM",
        endTime: "05:00 PM",
        breakStart: "01:00 PM",
        breakEnd: "02:00 PM",
      }),
    },
    appointment: {
      findMany: async () => [],
      findUnique: async () => null,
      create: async ({ data }) => {
        events.push({ type: "database-create" });
        return makeCreatedAppointment({ ...data, reference: "APT-NEW123" });
      },
    },
  };

  return {
    service: { findFirst: async () => service },
    specialist: { findFirst: async () => specialist },
    specialistService: { findFirst: async () => ({ specialistId: specialist.id, serviceId: service.id }) },
    $transaction: async (fn) => fn(tx),
    ...overrides,
  };
}

function makeStatusPrisma(currentStatus, nextStatus, events = [], overrides = {}) {
  return {
    appointment: {
      findUnique: async () => makeCreatedAppointment({ status: currentStatus }),
      update: async ({ data }) => {
        events.push({ type: "database-update", status: data.status });
        return makeCreatedAppointment({ status: data.status });
      },
    },
    ...overrides,
  };
}

const bookingBody = {
  serviceId: "svc-1",
  specialistId: "dr-a",
  date: "2099-01-06",
  time: "09:00 AM",
  customerName: "New Customer",
  customerEmail: "new@example.test",
};

test("new booking sends customer confirmation and admin notification after the database write", async () => {
  const events = [];
  const email = makeEmailMock(events);
  const prisma = makeCreatePrisma(events);
  const { createAppointment } = freshController({ prisma, email });

  const res = mockRes();
  await createAppointment({ body: bookingBody }, res, (err) => { throw err; });

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.appointment.reference, "APT-NEW123");

  assert.deepEqual(events.map((event) => event.type), [
    "database-create",
    "customer-confirmation",
    "admin-notification",
  ]);

  const customerEvent = events.find((event) => event.type === "customer-confirmation");
  assert.equal(customerEvent.appointment.reference, "APT-NEW123");
  assert.equal(customerEvent.appointment.customerEmail, "new@example.test");
  assert.equal(customerEvent.appointment.service.name, "Consultation");
  assert.equal(customerEvent.appointment.specialist.name, "Dr. A");

  const adminEvent = events.find((event) => event.type === "admin-notification");
  assert.equal(adminEvent.appointment.reference, "APT-NEW123");
  assert.equal(adminEvent.appointment.customerName, "New Customer");
});

test("no email is sent when the booking database transaction fails", async () => {
  const events = [];
  const email = makeEmailMock(events);
  const prisma = makeCreatePrisma(events, {
    $transaction: async () => {
      throw Object.assign(new Error("database unavailable"), { code: "P1001" });
    },
  });
  const { createAppointment } = freshController({ prisma, email });

  const res = mockRes();
  let captured;
  await createAppointment({ body: bookingBody }, res, (err) => { captured = err; });

  assert.ok(captured, "the error should be forwarded to the error handler");
  assert.match(captured.message, /database unavailable/i);
  assert.equal(events.length, 0, "no email should be sent after a failed booking");
});

test("email failures do not reverse a successful booking", async () => {
  const email = {
    sendAppointmentConfirmation: async () => { throw new Error("email provider down"); },
    sendAdminNewBookingNotification: async () => { throw new Error("email provider down"); },
    sendAppointmentApproved: async () => { throw new Error("email provider down"); },
    sendAppointmentStatusUpdate: async () => { throw new Error("email provider down"); },
  };
  const prisma = makeCreatePrisma([]);
  const { createAppointment } = freshController({ prisma, email });

  const res = mockRes();
  await createAppointment({ body: bookingBody }, res, (err) => { throw err; });

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.appointment.status, "pending");
});

test("admin approval sends the confirmation email after the status update", async () => {
  const events = [];
  const email = makeEmailMock(events);
  const prisma = makeStatusPrisma("pending", "confirmed", events);
  const { updateStatus } = freshController({ prisma, email });

  const res = mockRes();
  await updateStatus({ params: { reference: "APT-NEW123" }, body: { status: "confirmed" } }, res, (err) => { throw err; });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.appointment.status, "confirmed");
  assert.deepEqual(events.map((event) => event.type), ["database-update", "customer-approved"]);
});

test("rejection, cancellation, and completion send a status update after the database write", async () => {
  for (const [currentStatus, nextStatus] of [
    ["pending", "rejected"],
    ["pending", "cancelled"],
    ["confirmed", "completed"],
  ]) {
    const events = [];
    const email = makeEmailMock(events);
    const prisma = makeStatusPrisma(currentStatus, nextStatus, events);
    const { updateStatus } = freshController({ prisma, email });

    const res = mockRes();
    await updateStatus({ params: { reference: "APT-NEW123" }, body: { status: nextStatus } }, res, (err) => { throw err; });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.appointment.status, nextStatus);
    assert.deepEqual(events.map((event) => event.type), ["database-update", "customer-status"]);

    const emailEvent = events.find((event) => event.type === "customer-status");
    assert.equal(emailEvent.appointment.status, nextStatus);
    assert.equal(emailEvent.previousStatus, currentStatus);
  }
});

test("no email is sent when the status has not changed", async () => {
  const events = [];
  const email = makeEmailMock(events);
  const prisma = makeStatusPrisma("confirmed", "confirmed", events);
  const { updateStatus } = freshController({ prisma, email });

  const res = mockRes();
  await updateStatus({ params: { reference: "APT-NEW123" }, body: { status: "confirmed" } }, res, (err) => { throw err; });

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /already confirmed/i);
  assert.equal(events.length, 0);
});

test("no email is sent when the status update fails", async () => {
  const events = [];
  const email = makeEmailMock(events);
  const prisma = makeStatusPrisma("pending", "confirmed", events, {
    appointment: {
      findUnique: async () => makeCreatedAppointment({ status: "pending" }),
      update: async () => { throw new Error("update failed"); },
    },
  });
  const { updateStatus } = freshController({ prisma, email });

  const res = mockRes();
  let captured;
  await updateStatus({ params: { reference: "APT-NEW123" }, body: { status: "confirmed" } }, res, (err) => { captured = err; });

  assert.ok(captured);
  assert.match(captured.message, /update failed/i);
  assert.equal(events.length, 0);
});

test("email failures do not reverse a successful status update", async () => {
  const email = {
    sendAppointmentApproved: async () => { throw new Error("email provider down"); },
    sendAppointmentStatusUpdate: async () => { throw new Error("email provider down"); },
    sendAppointmentConfirmation: async () => { throw new Error("email provider down"); },
    sendAdminNewBookingNotification: async () => { throw new Error("email provider down"); },
  };
  const prisma = makeStatusPrisma("pending", "confirmed", []);
  const { updateStatus } = freshController({ prisma, email });

  const res = mockRes();
  await updateStatus({ params: { reference: "APT-NEW123" }, body: { status: "confirmed" } }, res, (err) => { throw err; });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.appointment.status, "confirmed");
});

test("customer cancellation sends a status email after the database update", async () => {
  const events = [];
  const email = makeEmailMock(events);
  const dt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const time = minutesToLabel(dt.getHours() * 60 + dt.getMinutes());
  const appointment = makeCreatedAppointment({ status: "pending", date, time });

  const prisma = {
    appointment: {
      findFirst: async () => appointment,
      update: async ({ data }) => {
        events.push({ type: "database-update", status: data.status });
        return { ...appointment, status: data.status };
      },
    },
  };
  const { cancelMine } = freshController({ prisma, email });

  const res = mockRes();
  await cancelMine({ params: { reference: "APT-NEW123" }, user: { id: "cust-1" } }, res, (err) => { throw err; });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.appointment.status, "cancelled");
  assert.deepEqual(events.map((event) => event.type), ["database-update", "customer-status"]);
  assert.equal(events[1].previousStatus, "pending");
});
