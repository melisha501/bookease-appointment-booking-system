// Provider portal: self-service profile, services, availability, and bookings.
// Every provider-scoped query is filtered by the authenticated provider's id so
// one provider can never read or modify another provider's records.

const prisma = require("../lib/prisma");
const emailOutbox = require("../services/emailOutboxService");
const {
  uploadImageToUploadThing,
  deleteImageFromUploadThing,
} = require("../services/uploadthingService");
const {
  serviceToClient,
  providerToClient,
  uniqueSlug,
  parseNprToInt,
  resolveCategoryId,
  cleanupUnusedImage,
  withImageCleanup,
  discardNewUpload,
} = require("./catalogController");
const { appointmentToClient } = require("../utils/appointmentView");
const {
  normalizeStatus,
  canAdminTransition,
  statusLabel,
  ALL_APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS,
} = require("../utils/appointmentStatus");
const {
  validateWeeklySchedule,
  scheduleToClient,
  exceptionToClient,
} = require("./workingHoursController");

const PROVIDER_STATUSES = ["pending", "approved", "rejected"];
const APPROVAL_STATUSES = ["pending", "approved", "rejected"];

async function loadOwnProvider(userId) {
  if (!userId) return null;
  return prisma.provider.findUnique({
    where: { ownerId: userId },
    include: { owner: { select: { id: true, name: true, email: true, phone: true, address: true } } },
  });
}

async function requireOwnProvider(req, res) {
  const provider = await loadOwnProvider(req.user.id);
  if (!provider) {
    res.status(404).json({
      success: false,
      code: "NO_PROVIDER_PROFILE",
      message: "No provider profile is linked to this account.",
    });
    return null;
  }
  return provider;
}

function providerWithOwnerToClient(provider) {
  if (!provider) return null;
  return {
    ...providerToClient(provider),
    ownerId: provider.ownerId,
    ownerName: provider.owner?.name || "",
    ownerEmail: provider.owner?.email || "",
    ownerPhone: provider.owner?.phone || "",
    serviceCount: provider._count?.services ?? (Array.isArray(provider.services) ? provider.services.length : 0),
    specialistCount:
      provider._count?.specialists ?? (Array.isArray(provider.specialists) ? provider.specialists.length : 0),
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  };
}

async function publicProviderPayload(provider) {
  const visibleServices = Array.isArray(provider.services) ? provider.services : [];
  return {
    ...providerToClient(provider),
    services: visibleServices.map(serviceToClient),
    specialists: (provider.specialists || []).map((specialist) => ({
      id: specialist.slug || specialist.id,
      dbId: specialist.id,
      name: specialist.name,
      title: specialist.title,
      bio: specialist.bio || "",
      image: specialist.imageUrl || "",
      specialty: specialist.specialty || "",
      experience: specialist.experience ?? 0,
      rating: specialist.rating ?? 5,
    })),
    serviceCount: visibleServices.length,
  };
}

async function ensureProviderSpecialist(provider) {
  const existing = await prisma.specialist.findFirst({
    where: { providerId: provider.id },
    include: { schedules: true },
  });
  if (existing) return existing;

  const category = await prisma.category.findFirst({ orderBy: { name: "asc" } });
  const slug = await uniqueSlug("specialist", provider.name || provider.slug);
  const specialist = await prisma.specialist.create({
    data: {
      slug,
      name: provider.name,
      title: provider.type === "ORGANIZATION" ? "Provider team" : "Service provider",
      bio: provider.description || null,
      experience: 0,
      specialty: category?.name || "General",
      imageUrl: provider.logoUrl || null,
      providerId: provider.id,
      isActive: true,
    },
    include: { schedules: true },
  });

  await prisma.workingHour.upsert({
    where: { specialistId: specialist.id },
    create: {
      specialistId: specialist.id,
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      startTime: "09:00 AM",
      endTime: "05:00 PM",
      breakStart: "01:00 PM",
      breakEnd: "02:00 PM",
    },
    update: {},
  });

  return specialist;
}

async function findOwnService(providerId, key) {
  if (!key) return null;
  return prisma.service.findFirst({
    where: {
      providerId,
      OR: [{ slug: String(key) }, { id: String(key) }],
    },
    include: { category: true, provider: true, specialists: { include: { specialist: true } } },
  });
}

// ---------------------------------------------------------------------------
// Public provider directory / profile
// ---------------------------------------------------------------------------

async function listPublicProviders(_req, res, next) {
  try {
    const providers = await prisma.provider.findMany({
      where: { status: "approved", isActive: true },
      include: {
        services: {
          where: { isActive: true, approvalStatus: "approved" },
          include: { category: true, provider: true },
          orderBy: { name: "asc" },
        },
        specialists: { where: { isActive: true } },
      },
      orderBy: { name: "asc" },
    });
    const items = await Promise.all(providers.map(publicProviderPayload));
    res.json({ success: true, providers: items });
  } catch (err) {
    next(err);
  }
}

async function getPublicProvider(req, res, next) {
  try {
    const key = req.params.id;
    const provider = await prisma.provider.findFirst({
      where: {
        AND: [
          { OR: [{ slug: String(key) }, { id: String(key) }], status: "approved", isActive: true },
        ],
      },
      include: {
        services: {
          where: { isActive: true, approvalStatus: "approved" },
          include: { category: true, provider: true },
          orderBy: { name: "asc" },
        },
        specialists: { where: { isActive: true } },
      },
    });
    if (!provider) return res.status(404).json({ success: false, message: "Provider not found." });
    res.json({ success: true, provider: await publicProviderPayload(provider) });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Provider self-service profile
// ---------------------------------------------------------------------------

async function getMyProvider(req, res, next) {
  try {
    const provider = await requireOwnProvider(req, res);
    if (!provider) return;
    const [services, appointmentCounts] = await Promise.all([
      prisma.service.findMany({
        where: { providerId: provider.id },
        include: { category: true, provider: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.appointment.groupBy({
        by: ["status"],
        where: { service: { providerId: provider.id } },
        _count: { _all: true },
      }),
    ]);
    const counts = Object.fromEntries(ALL_APPOINTMENT_STATUSES.map((status) => [status, 0]));
    for (const row of appointmentCounts) {
      if (Object.prototype.hasOwnProperty.call(counts, row.status)) counts[row.status] = row._count._all;
    }
    res.json({
      success: true,
      provider: providerWithOwnerToClient(provider),
      services: services.map(serviceToClient),
      stats: {
        services: services.length,
        publishedServices: services.filter(
          (service) =>
            service.isActive &&
            service.approvalStatus === "approved" &&
            provider.status === "approved" &&
            provider.isActive
        ).length,
        pendingServices: services.filter((service) => service.approvalStatus === "pending").length,
        appointments: Object.values(counts).reduce((sum, value) => sum + value, 0),
        appointmentCounts: counts,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function updateMyProvider(req, res, next) {
  try {
    const provider = await requireOwnProvider(req, res);
    if (!provider) return;
    const body = req.body || {};
    const data = {};

    if (body.name != null) {
      const name = String(body.name).trim();
      if (!name) return res.status(400).json({ success: false, message: "Provider name is required." });
      data.name = name;
      if (!body.slug) data.slug = await uniqueSlug("provider", name, provider.id);
    }
    if (body.slug != null) data.slug = await uniqueSlug("provider", body.slug, provider.id);
    if (body.type != null) {
      const type = String(body.type).toUpperCase();
      if (!["INDIVIDUAL", "ORGANIZATION"].includes(type)) {
        return res.status(400).json({ success: false, message: "Provider type must be INDIVIDUAL or ORGANIZATION." });
      }
      data.type = type;
    }
    if (body.description != null) data.description = String(body.description).trim() || null;
    if (body.email != null) data.email = String(body.email).trim() || null;
    if (body.phone != null) data.phone = String(body.phone).trim() || null;
    if (body.address != null) data.address = String(body.address).trim() || null;
    if (body.website != null) data.website = String(body.website).trim() || null;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: "No valid provider fields to update." });
    }

    const updated = await prisma.provider.update({
      where: { id: provider.id },
      data,
      include: { owner: { select: { id: true, name: true, email: true, phone: true, address: true } } },
    });

    // Keep the bookable specialist identity in sync with the provider profile.
    if (data.name || data.description != null || data.logoUrl != null) {
      await prisma.specialist.updateMany({
        where: { providerId: provider.id },
        data: {
          ...(data.name ? { name: data.name } : {}),
          ...(data.description != null ? { bio: data.description } : {}),
        },
      });
    }

    if (body.ownerName != null && String(body.ownerName).trim()) {
      await prisma.user.update({
        where: { id: provider.ownerId },
        data: { name: String(body.ownerName).trim() },
      });
    }

    res.json({
      success: true,
      message: "Provider profile updated.",
      provider: providerWithOwnerToClient(updated),
    });
  } catch (err) {
    if (err && err.code === "P2002") {
      return res.status(409).json({ success: false, message: "That provider identifier is already in use." });
    }
    next(err);
  }
}

async function uploadMyLogo(req, res, next) {
  try {
    const provider = await requireOwnProvider(req, res);
    if (!provider) return;
    const previousLogo = provider.logoUrl || null;
    const upload = await uploadImageToUploadThing(req.file);
    if (!upload.ok) return res.status(upload.status || 400).json({ success: false, message: upload.message });

    let updated;
    try {
      updated = await prisma.provider.update({
        where: { id: provider.id },
        data: { logoUrl: upload.url },
        include: { owner: { select: { id: true, name: true, email: true, phone: true, address: true } } },
      });
      await prisma.specialist.updateMany({
        where: { providerId: provider.id },
        data: { imageUrl: upload.url },
      });
    } catch (err) {
      await discardNewUpload(upload.url);
      throw err;
    }

    const cleanup =
      previousLogo && previousLogo !== upload.url
        ? await cleanupUnusedImage(previousLogo)
        : { status: "none" };
    const payload = {
      success: true,
      message: "Provider logo updated.",
      provider: providerWithOwnerToClient(updated),
    };
    withImageCleanup(payload, cleanup, "Provider logo was updated");
    res.json(payload);
  } catch (err) {
    next(err);
  }
}

async function removeMyLogo(req, res, next) {
  try {
    const provider = await requireOwnProvider(req, res);
    if (!provider) return;
    const previousLogo = provider.logoUrl || null;
    const updated = await prisma.provider.update({
      where: { id: provider.id },
      data: { logoUrl: null },
      include: { owner: { select: { id: true, name: true, email: true, phone: true, address: true } } },
    });
    const cleanup = await cleanupUnusedImage(previousLogo);
    const payload = {
      success: true,
      message: "Provider logo removed.",
      provider: providerWithOwnerToClient(updated),
    };
    withImageCleanup(payload, cleanup, "Provider logo was removed");
    res.json(payload);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Provider services
// ---------------------------------------------------------------------------

async function listMyServices(req, res, next) {
  try {
    const provider = await requireOwnProvider(req, res);
    if (!provider) return;
    const services = await prisma.service.findMany({
      where: { providerId: provider.id },
      include: { category: true, provider: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, services: services.map(serviceToClient) });
  } catch (err) {
    next(err);
  }
}

async function createMyService(req, res, next) {
  try {
    const provider = await requireOwnProvider(req, res);
    if (!provider) return;
    if (provider.status === "rejected") {
      return res.status(403).json({
        success: false,
        message: "Your provider profile was rejected. Contact support before adding services.",
      });
    }

    const body = req.body || {};
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    if (!name) return res.status(400).json({ success: false, message: "Service name is required." });
    if (!description) return res.status(400).json({ success: false, message: "Service description is required." });

    const categoryId = await resolveCategoryId(body.categoryId || body.category || body.categorySlug);
    if (!categoryId) return res.status(400).json({ success: false, message: "A valid category is required." });

    const priceNpr = parseNprToInt(body.priceNpr ?? body.price);
    if (!(priceNpr > 0)) return res.status(400).json({ success: false, message: "A valid price (NPR) is required." });

    const durationMins = Math.max(1, Math.round(Number(body.durationMins ?? body.duration) || 0));
    if (!(durationMins > 0)) return res.status(400).json({ success: false, message: "A valid duration is required." });

    const specialist = await ensureProviderSpecialist(provider);
    const slug = await uniqueSlug("service", body.slug || name);
    const created = await prisma.service.create({
      data: {
        slug,
        name,
        description,
        categoryId,
        priceNpr,
        durationMins,
        rating: Number.isFinite(Number(body.rating)) ? Number(body.rating) : 5,
        benefits: Array.isArray(body.benefits) ? body.benefits.map(String) : [],
        isActive: body.isActive !== false,
        providerId: provider.id,
        approvalStatus: "pending",
      },
      include: { category: true, provider: true },
    });

    await prisma.specialistService.upsert({
      where: { specialistId_serviceId: { specialistId: specialist.id, serviceId: created.id } },
      create: { specialistId: specialist.id, serviceId: created.id },
      update: {},
    });

    res.status(201).json({
      success: true,
      message: "Service created. It will appear in the customer portal after admin approval.",
      service: serviceToClient(created),
    });
  } catch (err) {
    if (err && err.code === "P2002") {
      return res.status(409).json({ success: false, message: "A service with this identifier already exists." });
    }
    next(err);
  }
}

async function updateMyService(req, res, next) {
  try {
    const provider = await requireOwnProvider(req, res);
    if (!provider) return;
    const existing = await findOwnService(provider.id, req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Service not found." });

    const body = req.body || {};
    const data = {};
    if (body.name != null) {
      const name = String(body.name).trim();
      if (!name) return res.status(400).json({ success: false, message: "Service name is required." });
      data.name = name;
      if (!body.slug) data.slug = await uniqueSlug("service", name, existing.id);
    }
    if (body.slug != null) data.slug = await uniqueSlug("service", body.slug, existing.id);
    if (body.description != null) {
      const description = String(body.description).trim();
      if (!description) return res.status(400).json({ success: false, message: "Service description is required." });
      data.description = description;
    }
    if (body.category != null || body.categoryId != null || body.categorySlug != null) {
      const categoryId = await resolveCategoryId(body.categoryId || body.category || body.categorySlug);
      if (!categoryId) return res.status(400).json({ success: false, message: "A valid category is required." });
      data.categoryId = categoryId;
    }
    if (body.price != null || body.priceNpr != null) {
      const priceNpr = parseNprToInt(body.priceNpr ?? body.price);
      if (!(priceNpr > 0)) return res.status(400).json({ success: false, message: "A valid price (NPR) is required." });
      data.priceNpr = priceNpr;
    }
    if (body.duration != null || body.durationMins != null) {
      const durationMins = Math.max(1, Math.round(Number(body.durationMins ?? body.duration) || 0));
      if (!(durationMins > 0)) return res.status(400).json({ success: false, message: "A valid duration is required." });
      data.durationMins = durationMins;
    }
    if (body.rating != null && Number.isFinite(Number(body.rating))) data.rating = Number(body.rating);
    if (body.benefits != null) data.benefits = Array.isArray(body.benefits) ? body.benefits.map(String) : [];
    if (body.isActive != null) data.isActive = Boolean(body.isActive);

    // Rejected services must be reviewed again after the provider changes them.
    if (existing.approvalStatus === "rejected" && Object.keys(data).length > 0) {
      data.approvalStatus = "pending";
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: "No valid service fields to update." });
    }

    const updated = await prisma.service.update({
      where: { id: existing.id },
      data,
      include: { category: true, provider: true },
    });
    res.json({ success: true, message: "Service updated.", service: serviceToClient(updated) });
  } catch (err) {
    if (err && err.code === "P2002") {
      return res.status(409).json({ success: false, message: "A service with this identifier already exists." });
    }
    next(err);
  }
}

async function deleteMyService(req, res, next) {
  try {
    const provider = await requireOwnProvider(req, res);
    if (!provider) return;
    const service = await findOwnService(provider.id, req.params.id);
    if (!service) return res.status(404).json({ success: false, message: "Service not found." });

    const appointmentCount = await prisma.appointment.count({ where: { serviceId: service.id } });
    if (appointmentCount > 0) {
      return res.status(409).json({
        success: false,
        code: "HAS_APPOINTMENTS",
        appointmentCount,
        message:
          `This service has ${appointmentCount} appointment(s), so it cannot be deleted. ` +
          "Unpublish it instead to hide it from customers while preserving booking history.",
      });
    }

    await prisma.service.delete({ where: { id: service.id } });
    const cleanup = await cleanupUnusedImage(service.imageUrl || null);
    const payload = { success: true, message: "Service deleted.", id: service.slug || service.id };
    withImageCleanup(payload, cleanup, "Service was deleted");
    res.json(payload);
  } catch (err) {
    next(err);
  }
}

async function setMyServicePublish(req, res, next) {
  try {
    const provider = await requireOwnProvider(req, res);
    if (!provider) return;
    const service = await findOwnService(provider.id, req.params.id);
    if (!service) return res.status(404).json({ success: false, message: "Service not found." });
    const body = req.body || {};
    const isActive = body.isActive != null ? Boolean(body.isActive) : !service.isActive;
    const updated = await prisma.service.update({
      where: { id: service.id },
      data: { isActive },
      include: { category: true, provider: true },
    });
    res.json({
      success: true,
      message: isActive ? "Service published." : "Service unpublished.",
      service: serviceToClient(updated),
    });
  } catch (err) {
    next(err);
  }
}

async function uploadMyServiceImage(req, res, next) {
  try {
    const provider = await requireOwnProvider(req, res);
    if (!provider) return;
    const service = await findOwnService(provider.id, req.params.id);
    if (!service) return res.status(404).json({ success: false, message: "Service not found." });

    const previousImageUrl = service.imageUrl || null;
    const upload = await uploadImageToUploadThing(req.file);
    if (!upload.ok) return res.status(upload.status || 400).json({ success: false, message: upload.message });

    let updated;
    try {
      updated = await prisma.service.update({
        where: { id: service.id },
        data: { imageUrl: upload.url },
        include: { category: true, provider: true },
      });
    } catch (err) {
      await discardNewUpload(upload.url);
      throw err;
    }

    const cleanup =
      previousImageUrl && previousImageUrl !== upload.url
        ? await cleanupUnusedImage(previousImageUrl)
        : { status: "none" };
    const payload = {
      success: true,
      message: "Service image updated.",
      service: serviceToClient(updated),
    };
    withImageCleanup(payload, cleanup, "Service image was updated");
    res.json(payload);
  } catch (err) {
    next(err);
  }
}

async function removeMyServiceImage(req, res, next) {
  try {
    const provider = await requireOwnProvider(req, res);
    if (!provider) return;
    const service = await findOwnService(provider.id, req.params.id);
    if (!service) return res.status(404).json({ success: false, message: "Service not found." });

    const previousImageUrl = service.imageUrl || null;
    const updated = await prisma.service.update({
      where: { id: service.id },
      data: { imageUrl: null },
      include: { category: true, provider: true },
    });
    const cleanup = await cleanupUnusedImage(previousImageUrl);
    const payload = {
      success: true,
      message: "Service image removed.",
      service: serviceToClient(updated),
    };
    withImageCleanup(payload, cleanup, "Service image was removed");
    res.json(payload);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Provider appointments
// ---------------------------------------------------------------------------

async function listMyAppointments(req, res, next) {
  try {
    const provider = await requireOwnProvider(req, res);
    if (!provider) return;
    const { status } = req.query;
    const where = { service: { providerId: provider.id } };
    const normalized = normalizeStatus(status);
    if (normalized) where.status = normalized;

    const items = await prisma.appointment.findMany({
      where,
      include: {
        service: { include: { provider: true } },
        specialist: true,
        customer: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    res.json({ success: true, appointments: items.map(appointmentToClient) });
  } catch (err) {
    next(err);
  }
}

async function updateMyAppointmentStatus(req, res, next) {
  try {
    const provider = await requireOwnProvider(req, res);
    if (!provider) return;
    const { reference } = req.params;
    const nextStatus = normalizeStatus(req.body?.status);
    if (!nextStatus) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${ALL_APPOINTMENT_STATUSES.join(", ")}.`,
      });
    }

    const appointment = await prisma.appointment.findFirst({
      where: { reference, service: { providerId: provider.id } },
      include: { service: { include: { provider: true } }, specialist: true },
    });
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found." });

    const previousStatus = normalizeStatus(appointment.status);
    if (previousStatus === nextStatus) {
      return res.status(400).json({
        success: false,
        message: `Appointment is already ${statusLabel(nextStatus).toLowerCase()}.`,
      });
    }
    if (!canAdminTransition(previousStatus, nextStatus)) {
      return res.status(400).json({
        success: false,
        message: `A ${statusLabel(previousStatus).toLowerCase()} appointment cannot be changed to ${statusLabel(
          nextStatus
        ).toLowerCase()}.`,
      });
    }

    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: nextStatus },
      include: { service: { include: { provider: true } }, specialist: true },
    });

    try {
      if (nextStatus === APPOINTMENT_STATUS.CONFIRMED) {
        await emailOutbox.queueAppointmentApproved(updated, previousStatus);
      } else {
        await emailOutbox.queueAppointmentStatusUpdate(updated, previousStatus);
      }
    } catch (emailError) {
      console.error(
        "[provider-appointments] status email failed:",
        emailError && emailError.message ? emailError.message : emailError
      );
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

// ---------------------------------------------------------------------------
// Provider availability
// ---------------------------------------------------------------------------

async function getMyAvailability(req, res, next) {
  try {
    const provider = await requireOwnProvider(req, res);
    if (!provider) return;
    const specialist = await prisma.specialist.findFirst({ where: { providerId: provider.id } });
    if (!specialist) {
      return res.json({ success: true, specialistId: null, schedule: null, dateExceptions: [] });
    }
    const [wh, exceptions] = await Promise.all([
      prisma.workingHour.findUnique({ where: { specialistId: specialist.id } }),
      prisma.specialistDateException.findMany({
        where: { specialistId: specialist.id },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
    ]);
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

async function updateMyAvailability(req, res, next) {
  try {
    const provider = await requireOwnProvider(req, res);
    if (!provider) return;
    const validated = validateWeeklySchedule(req.body || {});
    if (validated.error) return res.status(400).json({ success: false, message: validated.error });

    const specialist = await ensureProviderSpecialist(provider);
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
      message: "Availability saved.",
      specialistId: specialist.slug || specialist.id,
      schedule: scheduleToClient(wh),
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Admin review endpoints
// ---------------------------------------------------------------------------

async function adminListProviders(req, res, next) {
  try {
    const { status } = req.query;
    const where = {};
    if (status && PROVIDER_STATUSES.includes(String(status))) where.status = String(status);
    const providers = await prisma.provider.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true, phone: true, address: true } },
        services: {
          include: { category: true, provider: true },
          orderBy: { createdAt: "desc" },
        },
        specialists: { select: { id: true, slug: true, name: true, isActive: true } },
        _count: { select: { services: true, specialists: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    res.json({
      success: true,
      providers: providers.map((provider) => ({
        ...providerWithOwnerToClient(provider),
        services: (provider.services || []).map(serviceToClient),
        specialists: provider.specialists || [],
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function adminUpdateProvider(req, res, next) {
  try {
    const body = req.body || {};
    const data = {};
    if (body.status != null) {
      const status = String(body.status);
      if (!PROVIDER_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid provider status." });
      }
      data.status = status;
    }
    if (body.isActive != null) data.isActive = Boolean(body.isActive);
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: "No valid provider fields to update." });
    }
    const provider = await prisma.provider.update({
      where: { id: req.params.id },
      data,
      include: {
        owner: { select: { id: true, name: true, email: true, phone: true, address: true } },
        services: { include: { category: true, provider: true } },
        _count: { select: { services: true, specialists: true } },
      },
    });
    res.json({
      success: true,
      message: `Provider ${provider.status === "approved" ? "approved" : provider.status}.`,
      provider: {
        ...providerWithOwnerToClient(provider),
        services: (provider.services || []).map(serviceToClient),
      },
    });
  } catch (err) {
    if (err && err.code === "P2025") {
      return res.status(404).json({ success: false, message: "Provider not found." });
    }
    next(err);
  }
}

async function adminListServices(req, res, next) {
  try {
    const { approvalStatus, providerId } = req.query;
    const where = {};
    if (approvalStatus && APPROVAL_STATUSES.includes(String(approvalStatus))) {
      where.approvalStatus = String(approvalStatus);
    }
    if (providerId) where.providerId = String(providerId);
    const services = await prisma.service.findMany({
      where,
      include: { category: true, provider: { include: { owner: { select: { name: true, email: true } } } } },
      orderBy: [{ approvalStatus: "asc" }, { createdAt: "desc" }],
    });
    res.json({ success: true, services: services.map(serviceToClient) });
  } catch (err) {
    next(err);
  }
}

async function adminUpdateServiceApproval(req, res, next) {
  try {
    const status = String(req.body?.status || "");
    if (!APPROVAL_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid approval status." });
    }
    const existing = await prisma.service.findFirst({
      where: { OR: [{ id: req.params.id }, { slug: req.params.id }] },
    });
    if (!existing) return res.status(404).json({ success: false, message: "Service not found." });

    const updated = await prisma.service.update({
      where: { id: existing.id },
      data: { approvalStatus: status },
      include: { category: true, provider: true },
    });
    res.json({
      success: true,
      message:
        status === "approved"
          ? "Service approved. It is visible in the customer portal when published."
          : `Service marked ${status}.`,
      service: serviceToClient(updated),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPublicProviders,
  getPublicProvider,
  getMyProvider,
  updateMyProvider,
  uploadMyLogo,
  removeMyLogo,
  listMyServices,
  createMyService,
  updateMyService,
  deleteMyService,
  setMyServicePublish,
  uploadMyServiceImage,
  removeMyServiceImage,
  listMyAppointments,
  updateMyAppointmentStatus,
  getMyAvailability,
  updateMyAvailability,
  adminListProviders,
  adminUpdateProvider,
  adminListServices,
  adminUpdateServiceApproval,
  providerWithOwnerToClient,
  loadOwnProvider,
};
