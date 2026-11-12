#!/usr/bin/env node
/*
 * BookEase API smoke test
 * -----------------------
 * Exercises the real HTTP API (local or deployed). It does not mock anything.
 *
 * Basic usage (local backend):
 *   cd backend
 *   npm run smoke
 *
 * Deployed backend:
 *   $env:SMOKE_API_BASE="https://your-api.onrender.com/api"
 *   $env:SMOKE_ADMIN_EMAIL="admin@example.com"
 *   $env:SMOKE_ADMIN_PASSWORD="your-admin-password"
 *   npm run smoke
 *
 * On macOS/Linux:
 *   SMOKE_API_BASE="https://your-api.onrender.com/api" \
 *   SMOKE_ADMIN_EMAIL="admin@example.com" \
 *   SMOKE_ADMIN_PASSWORD="your-admin-password" \
 *   npm run smoke
 *
 * What it checks:
 *   - health endpoint + PostgreSQL connectivity
 *   - public categories/services/specialists catalog
 *   - availability calculation
 *   - customer registration, login, /auth/me
 *   - protected-route enforcement
 *   - appointment creation and booking history
 *   - overlapping/double-booking prevention (409)
 *   - customer cancellation
 *   - released slot becomes available again
 *   - admin login, appointment list, dashboard, customers (when admin env vars are set)
 *   - admin confirm -> complete transition and terminal-status protection
 *
 * Email delivery is best-effort by design. This script confirms the booking was
 * saved; verify the actual messages in the Resend dashboard or backend logs.
 *
 * The script never prints tokens or passwords. It creates one clearly named test
 * customer using a unique email address so it can be run repeatedly.
 */

require("dotenv").config();

const API_BASE = (
  process.env.SMOKE_API_BASE ||
  process.env.API_BASE_URL ||
  "http://localhost:5000/api"
).replace(/\/+$/, "");

const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD =
  process.env.SMOKE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "";

// Use a real inbox domain when testing Resend delivery in production:
//   SMOKE_EMAIL_DOMAIN=yourdomain.com
// The default example.com is deliberately non-deliverable, so a local run does
// not send real email. The booking itself still succeeds because email is
// best-effort.
const CUSTOMER_EMAIL_DOMAIN = (
  process.env.SMOKE_EMAIL_DOMAIN || "example.com"
)
  .trim()
  .replace(/^@/, "");

const CUSTOMER_PASSWORD = "SmokeTest@123";
const results = [];
let failures = 0;

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const label = ok ? "PASS" : "FAIL";
  console.log(`${label}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function check(name, fn) {
  try {
    const detail = await fn();
    record(name, true, detail);
    return true;
  } catch (err) {
    record(name, false, err && err.message ? err.message : String(err));
    failures += 1;
    return false;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, { method = "GET", token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

async function findAvailableSlot(serviceId, specialistId) {
  // Start at least two calendar days ahead so the appointment is outside the
  // 24-hour cancellation window. This lets the smoke test exercise cancellation.
  for (let i = 2; i <= 21; i += 1) {
    const date = formatDate(addDays(i));
    const { status, data } = await request(
      `/appointments/availability?specialistId=${encodeURIComponent(
        specialistId
      )}&serviceId=${encodeURIComponent(serviceId)}&date=${date}`
    );
    if (status !== 200 || !data || data.closed) continue;
    const slot = (data.slots || []).find((item) => item.available);
    if (slot) return { date, time: slot.slot };
  }
  throw new Error(
    "No available slot found in the next 21 days. Check provider working hours and existing bookings."
  );
}

async function main() {
  console.log("BookEase API smoke test");
  console.log(`API: ${API_BASE}`);
  console.log("");

  let service;
  let specialist;
  let slot;
  let customerEmail;
  let customerToken;
  let reference;

  await check("Health check reports API and PostgreSQL reachable", async () => {
    const { status, data } = await request("/health");
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data && data.database === "ok", "database is not reported as ok");
    return `${data.status}, database ${data.database}`;
  });

  await check("Public catalog returns categories, services and specialists", async () => {
    const [categories, services, specialists] = await Promise.all([
      request("/categories"),
      request("/services"),
      request("/specialists"),
    ]);

    assert(
      categories.status === 200 && Array.isArray(categories.data?.categories),
      "categories endpoint failed"
    );
    assert(
      services.status === 200 &&
        Array.isArray(services.data?.services) &&
        services.data.services.length > 0,
      "services endpoint returned no services"
    );
    assert(
      specialists.status === 200 &&
        Array.isArray(specialists.data?.specialists) &&
        specialists.data.specialists.length > 0,
      "specialists endpoint returned no specialists"
    );

    for (const candidate of services.data.services) {
      const match = specialists.data.specialists.find(
        (item) =>
          Array.isArray(item.serviceIds) && item.serviceIds.includes(candidate.id)
      );
      if (match) {
        service = candidate;
        specialist = match;
        break;
      }
    }

    assert(
      service && specialist,
      "could not find a service/specialist pair assigned to each other"
    );

    return `${categories.data.categories.length} categories, ${
      services.data.services.length
    } services, ${specialists.data.specialists.length} specialists`;
  });

  if (!service || !specialist) {
    console.log("\nCannot continue without catalog data.");
    process.exit(1);
  }

  await check("Availability calculation returns a bookable slot", async () => {
    slot = await findAvailableSlot(service.id, specialist.id);
    return `${service.name} with ${specialist.name} on ${slot.date} at ${slot.time}`;
  });

  if (!slot) {
    console.log("\nCannot continue without an available slot.");
    process.exit(1);
  }

  await check("Customer registration", async () => {
    customerEmail = `smoke.${Date.now()}@${CUSTOMER_EMAIL_DOMAIN}`;
    const { status, data } = await request("/auth/register", {
      method: "POST",
      body: {
        name: "Smoke Test Customer",
        email: customerEmail,
        phone: "9800000000",
        password: CUSTOMER_PASSWORD,
      },
    });
    assert(
      status === 201,
      `expected 201, got ${status}: ${JSON.stringify(data)}`
    );
    assert(data?.token, "registration did not return a token");
    customerToken = data.token;
    return customerEmail;
  });

  await check("Customer login and authenticated profile", async () => {
    const login = await request("/auth/login", {
      method: "POST",
      body: { email: customerEmail, password: CUSTOMER_PASSWORD },
    });
    assert(
      login.status === 200 && login.data?.token,
      `login failed: ${JSON.stringify(login.data)}`
    );
    customerToken = login.data.token;

    const me = await request("/auth/me", { token: customerToken });
    assert(me.status === 200, `expected 200, got ${me.status}`);
    assert(me.data?.user?.role === "CUSTOMER", "unexpected role");
    return "token accepted";
  });

  await check("Protected endpoints reject anonymous requests", async () => {
    const mine = await request("/appointments/mine");
    assert(mine.status === 401, `expected 401, got ${mine.status}`);

    const image = await request(`/services/${service.dbId}/image`, {
      method: "POST",
    });
    assert(image.status === 401, `expected 401, got ${image.status}`);
    return "401 for booking history and image upload";
  });

  const bookingPayload = () => ({
    serviceId: service.id,
    specialistId: specialist.id,
    date: slot.date,
    time: slot.time,
    customerName: "Smoke Test Customer",
    customerEmail,
    customerPhone: "9800000000",
    notes: "Automated smoke test booking",
  });

  await check("Create appointment", async () => {
    const { status, data } = await request("/appointments", {
      method: "POST",
      token: customerToken,
      body: bookingPayload(),
    });
    assert(
      status === 201,
      `expected 201, got ${status}: ${JSON.stringify(data)}`
    );
    reference = data?.appointment?.reference;
    assert(reference, "response did not include a booking reference");
    assert(
      data.appointment.status === "pending",
      `expected pending, got ${data.appointment.status}`
    );
    return reference;
  });

  await check("Overlapping appointment is rejected (double-booking)", async () => {
    const { status, data } = await request("/appointments", {
      method: "POST",
      token: customerToken,
      body: bookingPayload(),
    });
    assert(
      status === 409,
      `expected 409, got ${status}: ${JSON.stringify(data)}`
    );
    return "409 conflict";
  });

  await check("Customer booking history includes the appointment", async () => {
    const { status, data } = await request("/appointments/mine", {
      token: customerToken,
    });
    assert(status === 200, `expected 200, got ${status}`);
    assert(
      Array.isArray(data?.appointments) &&
        data.appointments.some((item) => item.reference === reference),
      "booking history does not contain the new reference"
    );
    return reference;
  });

  await check("Customer token cannot access admin routes", async () => {
    const { status } = await request("/appointments", { token: customerToken });
    assert(status === 403, `expected 403, got ${status}`);
    return "403";
  });

  await check("Customer can cancel an eligible appointment", async () => {
    const { status, data } = await request(
      `/appointments/${reference}/cancel`,
      { method: "PATCH", token: customerToken }
    );
    assert(
      status === 200,
      `expected 200, got ${status}: ${JSON.stringify(data)}`
    );
    assert(
      data?.appointment?.status === "cancelled",
      `expected cancelled, got ${data?.appointment?.status}`
    );
    return reference;
  });

  await check("Cancelled slot becomes available again", async () => {
    const { status, data } = await request(
      `/appointments/availability?specialistId=${encodeURIComponent(
        specialist.id
      )}&serviceId=${encodeURIComponent(service.id)}&date=${slot.date}`
    );
    assert(status === 200, `expected 200, got ${status}`);
    const released = (data?.slots || []).find(
      (item) => item.slot === slot.time
    );
    assert(released, "the previously booked slot is missing from availability");
    assert(
      released.available === true,
      "the cancelled slot is still marked unavailable"
    );
    return `${slot.date} ${slot.time}`;
  });

  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    let adminToken;

    await check("Admin login", async () => {
      const { status, data } = await request("/auth/login", {
        method: "POST",
        body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      });
      assert(
        status === 200 && data?.token,
        `admin login failed: ${JSON.stringify(data)}`
      );
      assert(data.user?.role === "ADMIN", "account is not an administrator");
      adminToken = data.token;
      return "ADMIN";
    });

    await check("Admin can list appointments, customers and dashboard stats", async () => {
      const [appointments, customers, stats] = await Promise.all([
        request("/appointments", { token: adminToken }),
        request("/customers", { token: adminToken }),
        request("/dashboard/stats", { token: adminToken }),
      ]);
      assert(
        appointments.status === 200 &&
          Array.isArray(appointments.data?.appointments),
        "appointment list failed"
      );
      assert(
        customers.status === 200 && Array.isArray(customers.data?.customers),
        "customer list failed"
      );
      assert(stats.status === 200, `dashboard stats failed (${stats.status})`);
      return `${appointments.data.appointments.length} appointments, ${customers.data.customers.length} customers`;
    });

    await check("Admin can confirm, complete, and cannot change a completed appointment", async () => {
      const created = await request("/appointments", {
        method: "POST",
        token: customerToken,
        body: bookingPayload(),
      });
      assert(
        created.status === 201,
        `rebooking failed: ${JSON.stringify(created.data)}`
      );
      const ref = created.data.appointment.reference;

      const confirmed = await request(`/appointments/${ref}/status`, {
        method: "PATCH",
        token: adminToken,
        body: { status: "confirmed" },
      });
      assert(
        confirmed.status === 200 &&
          confirmed.data?.appointment?.status === "confirmed",
        `confirm failed: ${JSON.stringify(confirmed.data)}`
      );

      const completed = await request(`/appointments/${ref}/status`, {
        method: "PATCH",
        token: adminToken,
        body: { status: "completed" },
      });
      assert(
        completed.status === 200 &&
          completed.data?.appointment?.status === "completed",
        `complete failed: ${JSON.stringify(completed.data)}`
      );

      const customerCancel = await request(
        `/appointments/${ref}/cancel`,
        { method: "PATCH", token: customerToken }
      );
      assert(
        customerCancel.status === 400,
        `expected completed cancellation to be rejected, got ${customerCancel.status}`
      );

      const adminChange = await request(`/appointments/${ref}/status`, {
        method: "PATCH",
        token: adminToken,
        body: { status: "cancelled" },
      });
      assert(
        adminChange.status === 400,
        `expected terminal-status change to be rejected, got ${adminChange.status}`
      );

      return `${ref}: pending -> confirmed -> completed`;
    });
  } else {
    console.log(
      "SKIP  Admin workflow — set SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD to test admin login and status changes."
    );
  }

  console.log("");
  const passed = results.filter((item) => item.ok).length;
  console.log(`${passed}/${results.length} checks passed.`);
  console.log(
    "Email delivery is best-effort: confirm booking messages in the Resend dashboard or backend logs."
  );

  if (failures > 0) {
    console.log("Smoke test FAILED.");
    process.exit(1);
  }
  console.log("Smoke test PASSED.");
}

main().catch((err) => {
  console.error("Smoke test crashed:", err && err.message ? err.message : err);
  process.exit(1);
});
