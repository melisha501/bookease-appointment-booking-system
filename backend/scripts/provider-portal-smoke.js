#!/usr/bin/env node
/*
 * BookEase provider portal smoke test
 * -----------------------------------
 * Exercises the real HTTP API end-to-end for the customer + provider portals:
 *
 *   - provider registration + login (PROVIDER role)
 *   - role protection (customers/providers cannot reach admin review routes)
 *   - provider profile update + weekly availability
 *   - provider service create (pending) -> hidden from public catalog
 *   - cross-provider ownership protection (404/403)
 *   - image upload validation failures
 *   - admin provider + service approval -> public catalog visibility
 *   - provider appointment visibility + status update
 *   - existing admin endpoints still work
 *
 * It creates clearly named records with a unique suffix and removes them from
 * the local database at the end (requires the backend DATABASE_URL).
 *
 * Usage:
 *   cd backend
 *   SMOKE_ADMIN_EMAIL="admin@yourdomain.com" \
 *   SMOKE_ADMIN_PASSWORD="<the admin password>" \
 *   npm run smoke:provider
 *
 * No default administrator credentials are used; set the variables above or
 * provide ADMIN_EMAIL / ADMIN_PASSWORD in backend/.env.
 */

require("dotenv").config();

const prisma = require("../src/lib/prisma");

const API_BASE = (process.env.SMOKE_API_BASE || "http://localhost:5000/api").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "";
const RUN_ID = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
const PREFIX = `provider-portal-smoke-${RUN_ID}`;
const PASSWORD = "SmokeTest@123";

const results = [];
let failures = 0;

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
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

async function request(path, { method = "GET", token, body, form } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: form || (body !== undefined ? JSON.stringify(body) : undefined),
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

async function findSlot(serviceId, specialistId) {
  for (let i = 2; i <= 21; i += 1) {
    const date = formatDate(addDays(i));
    const { status, data } = await request(
      `/appointments/availability?specialistId=${encodeURIComponent(specialistId)}` +
        `&serviceId=${encodeURIComponent(serviceId)}&date=${date}`
    );
    if (status !== 200 || !data || data.closed) continue;
    const slot = (data.slots || []).find((item) => item.available);
    if (slot) return { date, time: slot.slot };
  }
  throw new Error("No available slot found for the provider service in the next 21 days.");
}

let providerA;
let providerB;
let customer;
let adminToken;
let service;
let specialist;
let reference;

async function cleanup() {
  try {
    const users = await prisma.user.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    const providers = await prisma.provider.findMany({
      where: { ownerId: { in: userIds.length ? userIds : ["__none__"] } },
      select: { id: true },
    });
    const providerIds = providers.map((p) => p.id);
    const services = await prisma.service.findMany({
      where: { providerId: { in: providerIds.length ? providerIds : ["__none__"] } },
      select: { id: true },
    });
    const serviceIds = services.map((s) => s.id);

    if (serviceIds.length) {
      await prisma.appointment.deleteMany({ where: { serviceId: { in: serviceIds } } });
      await prisma.specialistService.deleteMany({ where: { serviceId: { in: serviceIds } } });
      await prisma.service.deleteMany({ where: { id: { in: serviceIds } } });
    }
    if (providerIds.length) {
      const specialists = await prisma.specialist.findMany({
        where: { providerId: { in: providerIds } },
        select: { id: true },
      });
      const specialistIds = specialists.map((s) => s.id);
      if (specialistIds.length) {
        await prisma.specialistService.deleteMany({ where: { specialistId: { in: specialistIds } } });
        await prisma.workingHour.deleteMany({ where: { specialistId: { in: specialistIds } } });
        await prisma.specialistDateException.deleteMany({ where: { specialistId: { in: specialistIds } } });
        await prisma.specialist.deleteMany({ where: { id: { in: specialistIds } } });
      }
      await prisma.provider.deleteMany({ where: { id: { in: providerIds } } });
    }
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (userIds.length || providerIds.length) {
      console.log(`\nCleaned up ${userIds.length} test user(s), ${providerIds.length} provider(s), ${serviceIds.length} service(s).`);
    }
  } catch (err) {
    console.error("Cleanup failed:", err && err.message ? err.message : err);
  }
}

function assertAdminCredentials() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      "Provider smoke test requires SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD (or ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env). No default admin credentials are used."
    );
  }
}

async function main() {
  assertAdminCredentials();
  console.log("BookEase provider portal smoke test");
  console.log(`API: ${API_BASE}`);
  console.log(`Test records: ${PREFIX}*`);
  console.log("");

  await check("Health check reports API and PostgreSQL reachable", async () => {
    const { status, data } = await request("/health");
    assert(status === 200 && data?.database === "ok", `health failed: ${JSON.stringify(data)}`);
    return "API + DB ok";
  });

  const providerEmailA = `${PREFIX}.a@example.com`;
  const providerEmailB = `${PREFIX}.b@example.com`;
  const customerEmail = `${PREFIX}.customer@example.com`;

  await check("Provider registration creates a PROVIDER account with a pending profile", async () => {
    const { status, data } = await request("/auth/register-provider", {
      method: "POST",
      body: {
        name: "Smoke Provider A",
        email: providerEmailA,
        password: PASSWORD,
        providerName: `Smoke Studio ${RUN_ID}`,
        type: "ORGANIZATION",
        description: "Provider smoke test organization.",
        phone: "9811111111",
        address: "Kathmandu, Nepal",
        website: "https://example.com",
      },
    });
    assert(status === 201, `expected 201, got ${status}: ${JSON.stringify(data)}`);
    assert(data?.user?.role === "PROVIDER", `unexpected role ${data?.user?.role}`);
    assert(data?.provider?.status === "pending", `expected pending provider, got ${data?.provider?.status}`);
    providerA = { token: data.token, provider: data.provider, email: providerEmailA };
    return `role PROVIDER, provider status pending, slug ${data.provider.slug}`;
  });

  await check("Provider login and /auth/me expose the PROVIDER role", async () => {
    const login = await request("/auth/login", {
      method: "POST",
      body: { email: providerEmailA, password: PASSWORD },
    });
    assert(login.status === 200 && login.data?.token, `login failed: ${JSON.stringify(login.data)}`);
    providerA.token = login.data.token;
    const me = await request("/auth/me", { token: providerA.token });
    assert(me.status === 200 && me.data?.user?.role === "PROVIDER", `unexpected /auth/me: ${JSON.stringify(me.data)}`);
    return "PROVIDER token accepted";
  });

  await check("Provider self-service profile returns the pending profile", async () => {
    const { status, data } = await request("/providers/me", { token: providerA.token });
    assert(status === 200 && data?.provider, `expected 200 provider, got ${status}: ${JSON.stringify(data)}`);
    assert(data.provider.id === providerA.provider.slug, "provider id should be the public slug");
    assert(data.provider.status === "pending", "provider should still be pending");
    return `${data.provider.name} (${data.provider.status})`;
  });

  await check("Provider can update their own profile", async () => {
    const { status, data } = await request("/providers/me", {
      method: "PATCH",
      token: providerA.token,
      body: { description: "Updated provider description.", phone: "9822222222", website: "https://smoke.example.com" },
    });
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.provider.phone === "9822222222", "phone was not updated");
    return "profile updated";
  });

  await check("Provider can save weekly availability", async () => {
    const { status, data } = await request("/providers/me/availability", {
      method: "PUT",
      token: providerA.token,
      body: {
        days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        startTime: "09:00 AM",
        endTime: "05:00 PM",
        breakStart: "01:00 PM",
        breakEnd: "02:00 PM",
      },
    });
    assert(status === 200 && data?.schedule, `expected 200 schedule, got ${status}: ${JSON.stringify(data)}`);
    return `${data.schedule.days.join(", ")} ${data.schedule.start}-${data.schedule.end}`;
  });

  await check("Provider creates a service that starts pending approval", async () => {
    const { status, data } = await request("/providers/me/services", {
      method: "POST",
      token: providerA.token,
      body: {
        name: `Smoke Service ${RUN_ID}`,
        description: "A service created by the provider portal smoke test.",
        category: "massage-spa",
        priceNpr: 2500,
        durationMins: 60,
        benefits: ["Smoke test benefit"],
        isActive: true,
      },
    });
    assert(status === 201, `expected 201, got ${status}: ${JSON.stringify(data)}`);
    service = data.service;
    assert(service.approvalStatus === "pending", `expected pending, got ${service.approvalStatus}`);
    assert(service.providerName, "service payload is missing providerName");
    return `${service.id} — ${service.approvalStatus}`;
  });

  await check("Pending provider service is hidden from the public catalog", async () => {
    const [services, providers] = await Promise.all([request("/services"), request("/providers")]);
    assert(services.status === 200 && providers.status === 200, "public catalog request failed");
    const inServices = (services.data.services || []).some((item) => item.dbId === service.dbId);
    const inProviders = (providers.data.providers || []).some((item) => item.slug === providerA.provider.slug);
    assert(!inServices, "pending service is visible in /services");
    assert(!inProviders, "pending provider is visible in /providers");
    return "pending service and provider hidden";
  });

  await check("A second provider cannot modify another provider's service", async () => {
    const registered = await request("/auth/register-provider", {
      method: "POST",
      body: {
        name: "Smoke Provider B",
        email: providerEmailB,
        password: PASSWORD,
        providerName: `Smoke Other ${RUN_ID}`,
        type: "INDIVIDUAL",
      },
    });
    assert(registered.status === 201, `provider B registration failed: ${JSON.stringify(registered.data)}`);
    providerB = { token: registered.data.token, email: providerEmailB };

    const update = await request(`/providers/me/services/${encodeURIComponent(service.id)}`, {
      method: "PATCH",
      token: providerB.token,
      body: { priceNpr: 1 },
    });
    assert(update.status === 404, `expected 404 cross-provider update, got ${update.status}`);

    const remove = await request(`/providers/me/services/${encodeURIComponent(service.id)}`, {
      method: "DELETE",
      token: providerB.token,
    });
    assert(remove.status === 404, `expected 404 cross-provider delete, got ${remove.status}`);

    const ownList = await request("/providers/me/services", { token: providerB.token });
    assert(ownList.status === 200 && ownList.data.services.length === 0, "provider B should not see provider A's services");
    return "404 on update/delete, own list empty";
  });

  await check("Customers cannot use provider or admin routes", async () => {
    const registered = await request("/auth/register", {
      method: "POST",
      body: { name: "Smoke Customer", email: customerEmail, phone: "9844444444", password: PASSWORD },
    });
    assert(registered.status === 201, `customer registration failed: ${JSON.stringify(registered.data)}`);
    customer = { token: registered.data.token, email: customerEmail };

    const create = await request("/providers/me/services", {
      method: "POST",
      token: customer.token,
      body: { name: "Nope", description: "Nope", category: "massage-spa", priceNpr: 100, durationMins: 30 },
    });
    assert(create.status === 403, `expected 403 for customer service creation, got ${create.status}`);

    const adminProviders = await request("/admin/providers", { token: customer.token });
    assert(adminProviders.status === 403, `expected 403 for customer admin access, got ${adminProviders.status}`);

    const adminServices = await request("/admin/services", { token: providerA.token });
    assert(adminServices.status === 403, `expected 403 for provider admin access, got ${adminServices.status}`);
    return "403 for customer service creation and admin review routes";
  });

  await check("Image upload rejects non-image and missing files", async () => {
    const form = new FormData();
    form.append("image", new Blob(["not an image"], { type: "text/plain" }), "note.txt");
    const invalid = await request(`/providers/me/services/${encodeURIComponent(service.id)}/image`, {
      method: "POST",
      token: providerA.token,
      form,
    });
    assert(invalid.status === 400, `expected 400 invalid type, got ${invalid.status}: ${JSON.stringify(invalid.data)}`);

    const missing = await request(`/providers/me/services/${encodeURIComponent(service.id)}/image`, {
      method: "POST",
      token: providerA.token,
      form: new FormData(),
    });
    assert(missing.status === 400, `expected 400 missing file, got ${missing.status}`);
    return "400 for invalid/missing uploads";
  });

  await check("Admin login and provider approval", async () => {
    const login = await request("/auth/login", {
      method: "POST",
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    assert(login.status === 200 && login.data?.user?.role === "ADMIN", `admin login failed: ${JSON.stringify(login.data)}`);
    adminToken = login.data.token;

    const list = await request("/admin/providers?status=pending", { token: adminToken });
    assert(list.status === 200, `admin provider list failed: ${list.status}`);
    const pending = (list.data.providers || []).find((item) => item.slug === providerA.provider.slug);
    assert(pending, "provider A is missing from the pending review queue");

    const approved = await request(`/admin/providers/${pending.dbId}`, {
      method: "PATCH",
      token: adminToken,
      body: { status: "approved", isActive: true },
    });
    assert(approved.status === 200 && approved.data?.provider?.status === "approved", `approval failed: ${JSON.stringify(approved.data)}`);
    return `${approved.data.provider.name} approved`;
  });

  await check("Admin can approve the provider service", async () => {
    const list = await request("/admin/services?approvalStatus=pending", { token: adminToken });
    assert(list.status === 200, `admin service list failed: ${list.status}`);
    const pending = (list.data.services || []).find((item) => item.dbId === service.dbId);
    assert(pending, "provider service is missing from the pending approval queue");

    const approved = await request(`/admin/services/${service.dbId}/approval`, {
      method: "PATCH",
      token: adminToken,
      body: { status: "approved" },
    });
    assert(approved.status === 200 && approved.data?.service?.approvalStatus === "approved", `approval failed: ${JSON.stringify(approved.data)}`);
    return `${approved.data.service.name} approved`;
  });

  await check("Approved + published provider service appears in the customer catalog", async () => {
    const [services, providers] = await Promise.all([request("/services"), request("/providers")]);
    const publicService = (services.data.services || []).find((item) => item.dbId === service.dbId);
    assert(publicService, "approved service is missing from /services");
    assert(publicService.providerName === `Smoke Studio ${RUN_ID}`, `providerName mismatch: ${publicService.providerName}`);

    const publicProvider = (providers.data.providers || []).find((item) => item.slug === providerA.provider.slug);
    assert(publicProvider, "approved provider is missing from /providers");
    assert(publicProvider.services.some((item) => item.dbId === service.dbId), "provider profile does not list the service");

    const profile = await request(`/providers/${encodeURIComponent(providerA.provider.slug)}`);
    assert(profile.status === 200 && profile.data?.provider?.services?.length === 1, `provider profile failed: ${JSON.stringify(profile.data)}`);
    return `visible with providerName "${publicService.providerName}"`;
  });

  await check("Provider's bookable specialist is publicly available", async () => {
    const list = await request("/specialists");
    assert(list.status === 200, `specialist list failed: ${list.status}`);
    specialist = (list.data.specialists || []).find(
      (item) => item.providerSlug === providerA.provider.slug && (item.serviceIds || []).includes(service.id)
    );
    assert(specialist, "provider specialist is missing or not linked to the service");
    assert(specialist.schedule, "provider specialist has no schedule");
    return `${specialist.name} (${specialist.id})`;
  });

  await check("Provider unpublish removes the service and republish restores it", async () => {
    const unpublished = await request(`/providers/me/services/${encodeURIComponent(service.id)}/publish`, {
      method: "PATCH",
      token: providerA.token,
      body: { isActive: false },
    });
    assert(unpublished.status === 200 && unpublished.data.service.isActive === false, `unpublish failed: ${JSON.stringify(unpublished.data)}`);
    let services = await request("/services");
    assert(!(services.data.services || []).some((item) => item.dbId === service.dbId), "unpublished service is still public");

    const republished = await request(`/providers/me/services/${encodeURIComponent(service.id)}/publish`, {
      method: "PATCH",
      token: providerA.token,
      body: { isActive: true },
    });
    assert(republished.status === 200 && republished.data.service.isActive === true, `republish failed: ${JSON.stringify(republished.data)}`);
    services = await request("/services");
    assert((services.data.services || []).some((item) => item.dbId === service.dbId), "republished service is not public");
    return "hidden then visible again";
  });

  await check("Provider service can be booked through the customer flow", async () => {
    const slot = await findSlot(service.id, specialist.id);
    const { status, data } = await request("/appointments", {
      method: "POST",
      token: customer.token,
      body: {
        serviceId: service.id,
        specialistId: specialist.id,
        date: slot.date,
        time: slot.time,
        customerName: "Smoke Customer",
        customerEmail,
        customerPhone: "9844444444",
        notes: "Provider portal smoke test booking",
      },
    });
    assert(status === 201, `booking failed (${status}): ${JSON.stringify(data)}`);
    reference = data.appointment.reference;
    assert(data.appointment.providerName === `Smoke Studio ${RUN_ID}`, "appointment payload is missing providerName");
    return `${reference} on ${slot.date} at ${slot.time}`;
  });

  await check("Provider sees only their own appointments and can confirm them", async () => {
    const mine = await request("/providers/me/appointments", { token: providerA.token });
    assert(mine.status === 200, `provider appointments failed: ${mine.status}`);
    const appointment = (mine.data.appointments || []).find((item) => item.reference === reference);
    assert(appointment, "provider cannot see the new appointment");

    const other = await request("/providers/me/appointments", { token: providerB.token });
    assert(other.status === 200 && !(other.data.appointments || []).some((item) => item.reference === reference), "provider B can see provider A's appointment");

    const confirmed = await request(`/providers/me/appointments/${encodeURIComponent(reference)}/status`, {
      method: "PATCH",
      token: providerA.token,
      body: { status: "confirmed" },
    });
    assert(confirmed.status === 200 && confirmed.data?.appointment?.status === "confirmed", `confirm failed: ${JSON.stringify(confirmed.data)}`);

    const foreignUpdate = await request(`/providers/me/appointments/${encodeURIComponent(reference)}/status`, {
      method: "PATCH",
      token: providerB.token,
      body: { status: "cancelled" },
    });
    assert(foreignUpdate.status === 404, `expected 404 cross-provider status update, got ${foreignUpdate.status}`);
    return `${reference}: pending -> confirmed`;
  });

  await check("Customer booking history shows provider identity and confirmed status", async () => {
    const mine = await request("/appointments/mine", { token: customer.token });
    assert(mine.status === 200, `customer appointments failed: ${mine.status}`);
    const appointment = (mine.data.appointments || []).find((item) => item.reference === reference);
    assert(appointment, "customer cannot see the appointment");
    assert(appointment.providerName === `Smoke Studio ${RUN_ID}`, "customer appointment is missing providerName");
    assert(appointment.status === "confirmed", `expected confirmed, got ${appointment.status}`);
    return `${reference} — ${appointment.providerName}`;
  });

  await check("Provider cannot delete a service that has appointments", async () => {
    const { status, data } = await request(`/providers/me/services/${encodeURIComponent(service.id)}`, {
      method: "DELETE",
      token: providerA.token,
    });
    assert(status === 409 && data?.code === "HAS_APPOINTMENTS", `expected 409 HAS_APPOINTMENTS, got ${status}: ${JSON.stringify(data)}`);
    return "409 with preserved booking history";
  });

  await check("Existing admin endpoints still work for providers and appointments", async () => {
    const [appointments, stats, providers] = await Promise.all([
      request("/appointments", { token: adminToken }),
      request("/dashboard/stats", { token: adminToken }),
      request("/providers", { token: adminToken }),
    ]);
    assert(appointments.status === 200 && Array.isArray(appointments.data.appointments), "admin appointments failed");
    assert(stats.status === 200, `admin stats failed (${stats.status})`);
    assert(providers.status === 200 && Array.isArray(providers.data.providers), "admin providers failed");
    const found = appointments.data.appointments.find((item) => item.reference === reference);
    assert(found, "admin appointment list is missing the provider booking");
    assert(found.providerName === `Smoke Studio ${RUN_ID}`, "admin appointment payload is missing providerName");
    return `${appointments.data.appointments.length} appointments, ${providers.data.providers.length} providers`;
  });

  await check("Provider can delete their own service after appointments are removed", async () => {
    await prisma.appointment.deleteMany({ where: { reference } });
    const { status } = await request(`/providers/me/services/${encodeURIComponent(service.id)}`, {
      method: "DELETE",
      token: providerA.token,
    });
    assert(status === 200, `expected 200 delete, got ${status}`);
    service = { ...service, deleted: true };
    return "deleted";
  });

  console.log("");
  const passed = results.filter((item) => item.ok).length;
  console.log(`${passed}/${results.length} checks passed.`);
  if (failures > 0) {
    console.log("Provider portal smoke test FAILED.");
  } else {
    console.log("Provider portal smoke test PASSED.");
  }
  return failures;
}

main()
  .then(async (failed) => {
    await cleanup();
    await prisma.$disconnect();
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error("Provider portal smoke test crashed:", err && err.message ? err.message : err);
    await cleanup();
    await prisma.$disconnect();
    process.exit(1);
  });
