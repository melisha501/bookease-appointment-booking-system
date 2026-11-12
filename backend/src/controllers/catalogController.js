// Public catalog: categories, services, specialists (and schedules).
// Responses are shaped to be easy for the frontend to consume.

const prisma = require("../lib/prisma");
const { uploadImageToUploadThing } = require("../services/uploadthingService");

function formatNpr(amount) {
  const n = Number(amount) || 0;
  return `NPR ${n.toLocaleString("en-IN")}`;
}

function serviceToClient(service) {
  if (!service) return null;
  return {
    id: service.slug || service.id,
    dbId: service.id,
    slug: service.slug,
    name: service.name,
    description: service.description,
    category: service.category?.slug || service.categoryId,
    categoryName: service.category?.name || "",
    price: formatNpr(service.priceNpr),
    priceNpr: service.priceNpr,
    duration: service.durationMins,
    rating: service.rating ?? 5,
    image: service.imageUrl || "",
    benefits: Array.isArray(service.benefits) ? service.benefits : [],
    isActive: service.isActive !== false,
  };
}

function specialistToClient(specialist, includeSchedule = false) {
  if (!specialist) return null;
  const out = {
    id: specialist.slug || specialist.id,
    dbId: specialist.id,
    slug: specialist.slug,
    name: specialist.name,
    title: specialist.title,
    bio: specialist.bio || "",
    experience: specialist.experience ?? 0,
    rating: specialist.rating ?? 5,
    specialty: specialist.specialty || "",
    image: specialist.imageUrl || "",
  };
  if (includeSchedule && specialist.schedules) {
    // schema has one WorkingHour per specialist (unique specialistId)
    const wh = Array.isArray(specialist.schedules) ? specialist.schedules[0] : specialist.schedules;
    if (wh) {
      out.schedule = {
        days: wh.days || [],
        start: wh.startTime,
        end: wh.endTime,
        breakStart: wh.breakStart || "",
        breakEnd: wh.breakEnd || "",
      };
    }
  }
  if (specialist.services) {
    out.serviceIds = specialist.services.map((ss) => ss.service?.slug || ss.serviceId);
    // Include basic service info when the relation was loaded with service details.
    out.services = specialist.services
      .map((ss) => (ss.service ? serviceToClient(ss.service) : null))
      .filter(Boolean);
  }
  return out;
}

async function listCategories(_req, res, next) {
  try {
    const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
    const items = [{ id: "all", slug: "all", name: "All" }].concat(
      categories.map((c) => ({ id: c.slug, slug: c.slug, name: c.name, dbId: c.id }))
    );
    res.json({ success: true, categories: items });
  } catch (err) {
    next(err);
  }
}

function categoryToClient(category) {
  if (!category) return null;
  return { id: category.slug || category.id, slug: category.slug, name: category.name, dbId: category.id };
}

async function createCategory(req, res, next) {
  try {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    if (!name) return res.status(400).json({ success: false, message: "Category name is required." });
    if (name.toLowerCase() === "all") {
      return res.status(400).json({ success: false, message: "\"All\" is reserved." });
    }
    const slug = await uniqueSlug("category", body.slug || name);
    const created = await prisma.category.create({ data: { slug, name } });
    res.status(201).json({ success: true, message: "Category created.", category: categoryToClient(created) });
  } catch (err) {
    if (err && err.code === "P2002") {
      return res.status(409).json({ success: false, message: "A category with this name or identifier already exists." });
    }
    next(err);
  }
}

async function updateCategory(req, res, next) {
  try {
    const key = req.params.id;
    if (String(key || "").toLowerCase() === "all") {
      return res.status(400).json({ success: false, message: "The \"All\" filter cannot be modified." });
    }
    const existing = await findCategoryByKey(key);
    if (!existing) return res.status(404).json({ success: false, message: "Category not found." });
    const body = req.body || {};
    const data = {};
    if (body.name != null) {
      const name = String(body.name).trim();
      if (!name) return res.status(400).json({ success: false, message: "Category name is required." });
      if (name.toLowerCase() === "all") return res.status(400).json({ success: false, message: "\"All\" is reserved." });
      data.name = name;
      if (!body.slug) data.slug = await uniqueSlug("category", name, existing.id);
    }
    if (body.slug != null) data.slug = await uniqueSlug("category", body.slug, existing.id);
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: "No valid category fields to update." });
    }
    const updated = await prisma.category.update({ where: { id: existing.id }, data });
    res.json({ success: true, message: "Category updated.", category: categoryToClient(updated) });
  } catch (err) {
    if (err && err.code === "P2002") {
      return res.status(409).json({ success: false, message: "A category with this name or identifier already exists." });
    }
    next(err);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const key = req.params.id;
    if (String(key || "").toLowerCase() === "all") {
      return res.status(400).json({ success: false, message: "The \"All\" filter cannot be deleted." });
    }
    const category = await findCategoryByKey(key);
    if (!category) return res.status(404).json({ success: false, message: "Category not found." });

    const serviceCount = await prisma.service.count({ where: { categoryId: category.id } });
    if (serviceCount > 0) {
      return res.status(409).json({
        success: false,
        code: "HAS_SERVICES",
        serviceCount,
        message:
          `Cannot delete this category because ${serviceCount} service(s) are assigned to it. ` +
          "Existing services were not changed or deleted. Reassign or remove those services first.",
      });
    }

    await prisma.category.delete({ where: { id: category.id } });
    res.json({ success: true, message: "Category deleted.", id: category.slug || category.id });
  } catch (err) {
    if (err && err.code === "P2003") {
      return res.status(409).json({
        success: false,
        code: "HAS_SERVICES",
        message:
          "Cannot delete this category because related services still reference it. " +
          "Existing services were not changed or deleted.",
      });
    }
    next(err);
  }
}

async function listServices(req, res, next) {
  try {
    const { category } = req.query;
    const where = {};
    if (category && category !== "all") {
      where.category = { slug: String(category) };
    }
    // Public catalog shows active services by default
    where.isActive = true;
    const services = await prisma.service.findMany({
      where,
      include: { category: true },
      orderBy: { name: "asc" },
    });
    res.json({ success: true, services: services.map(serviceToClient) });
  } catch (err) {
    next(err);
  }
}

async function getService(req, res, next) {
  try {
    const key = req.params.id; // slug or cuid
    const service = await prisma.service.findFirst({
      where: { OR: [{ slug: key }, { id: key }], isActive: true },
      include: {
        category: true,
        specialists: {
          where: { specialist: { isActive: true } },
          include: {
            specialist: { include: { schedules: true } },
          },
        },
      },
    });
    if (!service) {
      return res.status(404).json({ success: false, message: "Service not found." });
    }
    const data = serviceToClient(service);
    data.specialists = (service.specialists || [])
      .map((ss) => specialistToClient(ss.specialist, true))
      .filter(Boolean);
    res.json({ success: true, service: data });
  } catch (err) {
    next(err);
  }
}

async function listSpecialists(req, res, next) {
  try {
    const { serviceId, service: serviceSlug } = req.query;
    const where = { isActive: true };
    const svcKey = serviceId || serviceSlug;
    if (svcKey) {
      where.services = {
        some: {
          service: {
            isActive: true,
            OR: [{ slug: String(svcKey) }, { id: String(svcKey) }],
          },
        },
      };
    }
    const specialists = await prisma.specialist.findMany({
      where,
      include: { schedules: true, services: { include: { service: { select: { slug: true, isActive: true } } } } },
      orderBy: { name: "asc" },
    });
    res.json({
      success: true,
      specialists: specialists.map((s) => specialistToClient(s, true)),
    });
  } catch (err) {
    next(err);
  }
}

async function getSpecialist(req, res, next) {
  try {
    const key = req.params.id; // slug or cuid
    const specialist = await prisma.specialist.findFirst({
      where: { OR: [{ slug: key }, { id: key }], isActive: true },
      include: {
        schedules: true,
        services: {
          where: { service: { isActive: true } },
          include: { service: { include: { category: true } } },
        },
      },
    });
    if (!specialist) {
      return res.status(404).json({ success: false, message: "Specialist not found." });
    }
    res.json({ success: true, specialist: specialistToClient(specialist, true) });
  } catch (err) {
    next(err);
  }
}

async function listSchedules(_req, res, next) {
  try {
    const specialists = await prisma.specialist.findMany({
      include: { schedules: true },
      orderBy: { name: "asc" },
    });
    const schedules = {};
    for (const s of specialists) {
      const wh = s.schedules?.[0];
      if (wh) {
        schedules[s.slug || s.id] = {
          specialistId: s.slug || s.id,
          specialistName: s.name,
          days: wh.days || [],
          start: wh.startTime,
          end: wh.endTime,
          breakStart: wh.breakStart || "",
          breakEnd: wh.breakEnd || "",
        };
      }
    }
    res.json({ success: true, schedules });
  } catch (err) {
    next(err);
  }
}

async function findServiceByKey(key) {
  if (!key) return null;
  return prisma.service.findFirst({
    where: { OR: [{ slug: String(key) }, { id: String(key) }] },
  });
}

async function findSpecialistByKey(key) {
  if (!key) return null;
  return prisma.specialist.findFirst({
    where: { OR: [{ slug: String(key) }, { id: String(key) }] },
  });
}

async function findCategoryByKey(key) {
  if (!key) return null;
  return prisma.category.findFirst({
    where: { OR: [{ slug: String(key) }, { id: String(key) }] },
  });
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

async function uniqueSlug(model, base, excludeId) {
  const root = slugify(base) || `${String(model || "item").toLowerCase()}-${Date.now().toString(36)}`;
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const where = { slug: candidate };
    if (excludeId) where.NOT = { id: excludeId };
    const exists = await prisma[model].findFirst({ where, select: { id: true } });
    if (!exists) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

function parseNprToInt(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  const digits = String(value ?? "").replace(/[^0-9]/g, "");
  const n = Number(digits);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

async function resolveCategoryId(key) {
  if (!key) return null;
  const cat = await prisma.category.findFirst({
    where: { OR: [{ slug: String(key) }, { id: String(key) }] },
    select: { id: true },
  });
  return cat?.id || null;
}

async function uploadServiceImage(req, res, next) {
  try {
    const service = await findServiceByKey(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: "Service not found." });

    const upload = await uploadImageToUploadThing(req.file);
    if (!upload.ok) return res.status(upload.status || 400).json({ success: false, message: upload.message });

    const updated = await prisma.service.update({
      where: { id: service.id },
      data: { imageUrl: upload.url },
      include: { category: true },
    });
    res.json({
      success: true,
      message: "Service image updated.",
      service: serviceToClient(updated),
    });
  } catch (err) {
    next(err);
  }
}

async function uploadSpecialistImage(req, res, next) {
  try {
    const specialist = await findSpecialistByKey(req.params.id);
    if (!specialist) return res.status(404).json({ success: false, message: "Specialist not found." });

    const upload = await uploadImageToUploadThing(req.file);
    if (!upload.ok) return res.status(upload.status || 400).json({ success: false, message: upload.message });

    const updated = await prisma.specialist.update({
      where: { id: specialist.id },
      data: { imageUrl: upload.url },
      include: { schedules: true, services: { include: { service: { select: { slug: true, isActive: true } } } } },
    });
    res.json({
      success: true,
      message: "Specialist image updated.",
      specialist: specialistToClient(updated, true),
    });
  } catch (err) {
    next(err);
  }
}

async function removeServiceImage(req, res, next) {
  try {
    const service = await findServiceByKey(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: "Service not found." });
    const updated = await prisma.service.update({
      where: { id: service.id },
      data: { imageUrl: null }, // remove reference only; record preserved
      include: { category: true },
    });
    res.json({ success: true, message: "Service image removed.", service: serviceToClient(updated) });
  } catch (err) {
    next(err);
  }
}

async function removeSpecialistImage(req, res, next) {
  try {
    const specialist = await findSpecialistByKey(req.params.id);
    if (!specialist) return res.status(404).json({ success: false, message: "Specialist not found." });
    const updated = await prisma.specialist.update({
      where: { id: specialist.id },
      data: { imageUrl: null }, // remove reference only; record preserved
      include: { schedules: true, services: { include: { service: { select: { slug: true, isActive: true } } } } },
    });
    res.json({ success: true, message: "Specialist image removed.", specialist: specialistToClient(updated, true) });
  } catch (err) {
    next(err);
  }
}

async function deleteService(req, res, next) {
  try {
    const service = await findServiceByKey(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: "Service not found." });

    const appointmentCount = await prisma.appointment.count({ where: { serviceId: service.id } });
    if (appointmentCount > 0) {
      return res.status(409).json({
        success: false,
        code: "HAS_APPOINTMENTS",
        appointmentCount,
        message:
          `Cannot permanently delete this service because it has ${appointmentCount} appointment(s). ` +
          "Appointment history must be preserved, so the service was not deleted. " +
          "You can edit the service and set it inactive to hide it from the public site.",
      });
    }

    await prisma.service.delete({ where: { id: service.id } }); // cascades SpecialistService joins
    res.json({ success: true, message: "Service deleted.", id: service.slug || service.id });
  } catch (err) {
    if (err && err.code === "P2003") {
      return res.status(409).json({
        success: false,
        code: "HAS_APPOINTMENTS",
        message:
          "Cannot delete this service because related records (such as appointments) still reference it. " +
          "Appointment history must be preserved, so the service was not deleted.",
      });
    }
    next(err);
  }
}

async function deleteSpecialist(req, res, next) {
  try {
    const specialist = await findSpecialistByKey(req.params.id);
    if (!specialist) return res.status(404).json({ success: false, message: "Specialist not found." });

    const appointmentCount = await prisma.appointment.count({ where: { specialistId: specialist.id } });
    if (appointmentCount > 0) {
      return res.status(409).json({
        success: false,
        code: "HAS_APPOINTMENTS",
        appointmentCount,
        message:
          `Cannot permanently delete this specialist because they have ${appointmentCount} appointment(s). ` +
          "Appointment history must be preserved, so the specialist was not deleted. " +
          "You can edit the specialist and set them inactive to hide them from the public site.",
      });
    }

    await prisma.specialist.delete({ where: { id: specialist.id } }); // cascades WorkingHour/SpecialistService
    res.json({ success: true, message: "Specialist deleted.", id: specialist.slug || specialist.id });
  } catch (err) {
    if (err && err.code === "P2003") {
      return res.status(409).json({
        success: false,
        code: "HAS_APPOINTMENTS",
        message:
          "Cannot delete this specialist because related records (such as appointments) still reference them. " +
          "Appointment history must be preserved, so the specialist was not deleted.",
      });
    }
    next(err);
  }
}

async function createService(req, res, next) {
  try {
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
      },
      include: { category: true },
    });
    res.status(201).json({ success: true, message: "Service created.", service: serviceToClient(created) });
  } catch (err) {
    if (err && err.code === "P2002") return res.status(409).json({ success: false, message: "A service with this identifier already exists." });
    next(err);
  }
}

async function updateService(req, res, next) {
  try {
    const existing = await findServiceByKey(req.params.id);
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
    if (body.description != null) data.description = String(body.description).trim();
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
    // imageUrl is managed exclusively by the UploadThing endpoint below.
    // Omitting it here ensures editing other fields never removes an image.

    const updated = await prisma.service.update({ where: { id: existing.id }, data, include: { category: true } });
    res.json({ success: true, message: "Service updated.", service: serviceToClient(updated) });
  } catch (err) {
    if (err && err.code === "P2002") return res.status(409).json({ success: false, message: "A service with this identifier already exists." });
    next(err);
  }
}

async function createSpecialist(req, res, next) {
  try {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    const title = String(body.title || "").trim();
    const specialty = String(body.specialty || body.specialtyName || "").trim();
    if (!name) return res.status(400).json({ success: false, message: "Specialist name is required." });
    if (!title) return res.status(400).json({ success: false, message: "Specialist title is required." });
    if (!specialty) return res.status(400).json({ success: false, message: "Specialist specialty is required." });
    const slug = await uniqueSlug("specialist", body.slug || name);
    const created = await prisma.specialist.create({
      data: {
        slug,
        name,
        title,
        bio: body.bio != null ? String(body.bio) : null,
        experience: Math.max(0, Math.round(Number(body.experience) || 0)),
        rating: Number.isFinite(Number(body.rating)) ? Number(body.rating) : 5,
        specialty,
        isActive: body.isActive !== false,
      },
      include: { schedules: true, services: { include: { service: { select: { slug: true, isActive: true } } } } },
    });
    res.status(201).json({ success: true, message: "Specialist created.", specialist: specialistToClient(created, true) });
  } catch (err) {
    if (err && err.code === "P2002") return res.status(409).json({ success: false, message: "A specialist with this identifier already exists." });
    next(err);
  }
}

async function updateSpecialist(req, res, next) {
  try {
    const existing = await findSpecialistByKey(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Specialist not found." });
    const body = req.body || {};
    const data = {};
    if (body.name != null) {
      const name = String(body.name).trim();
      if (!name) return res.status(400).json({ success: false, message: "Specialist name is required." });
      data.name = name;
      if (!body.slug) data.slug = await uniqueSlug("specialist", name, existing.id);
    }
    if (body.slug != null) data.slug = await uniqueSlug("specialist", body.slug, existing.id);
    if (body.title != null) data.title = String(body.title).trim();
    if (body.bio != null) data.bio = body.bio ? String(body.bio) : null;
    if (body.specialty != null || body.specialtyName != null) data.specialty = String(body.specialty || body.specialtyName || "").trim();
    if (body.experience != null) data.experience = Math.max(0, Math.round(Number(body.experience) || 0));
    if (body.rating != null && Number.isFinite(Number(body.rating))) data.rating = Number(body.rating);
    if (body.isActive != null) data.isActive = Boolean(body.isActive);
    // imageUrl is managed exclusively by the UploadThing endpoint below.
    const updated = await prisma.specialist.update({
      where: { id: existing.id },
      data,
      include: { schedules: true, services: { include: { service: { select: { slug: true, isActive: true } } } } },
    });
    res.json({ success: true, message: "Specialist updated.", specialist: specialistToClient(updated, true) });
  } catch (err) {
    if (err && err.code === "P2002") return res.status(409).json({ success: false, message: "A specialist with this identifier already exists." });
    next(err);
  }
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listServices,
  getService,
  getSpecialist,
  listSpecialists,
  listSchedules,
  createService,
  updateService,
  deleteService,
  createSpecialist,
  updateSpecialist,
  deleteSpecialist,
  uploadServiceImage,
  uploadSpecialistImage,
  removeServiceImage,
  removeSpecialistImage,
  serviceToClient,
  specialistToClient,
  formatNpr,
};
