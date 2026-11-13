// Catalog image controller tests with mocked Prisma + mocked UploadThing.
// Verifies that successful uploads persist the returned URL in PostgreSQL and
// that editing other fields never clears an existing image.

const test = require("node:test");
const assert = require("node:assert/strict");

function defaultParseUploadThingImageUrl(imageUrl) {
  if (typeof imageUrl !== "string" || !imageUrl) return { ok: false, reason: "missing-url" };
  let parsed;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return { ok: false, reason: "invalid-url" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "invalid-url" };
  }
  const host = parsed.hostname.toLowerCase();
  if (!(host === "utfs.io" || host === "ufs.sh" || host.endsWith(".ufs.sh"))) {
    return { ok: false, reason: "external-url", host };
  }
  const match = /^\/f\/([^/]+)$/.exec(parsed.pathname);
  if (!match) return { ok: false, reason: "unsupported-path", host };
  try {
    return { ok: true, key: decodeURIComponent(match[1]), host };
  } catch {
    return { ok: false, reason: "invalid-key", host };
  }
}

function freshController({
  prisma,
  upload,
  removeImage = async () => ({ ok: true, deleted: true, key: "deleted-key" }),
  parseUrl = defaultParseUploadThingImageUrl,
}) {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb";

  const prismaPath = require.resolve("../src/lib/prisma");
  const uploadPath = require.resolve("../src/services/uploadthingService");
  const controllerPath = require.resolve("../src/controllers/catalogController");

  delete require.cache[controllerPath];
  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: prisma,
  };
  require.cache[uploadPath] = {
    id: uploadPath,
    filename: uploadPath,
    loaded: true,
    exports: {
      imageUploadMiddleware: (_req, _res, next) => next(),
      uploadImageToUploadThing: upload,
      deleteImageFromUploadThing: removeImage,
      parseUploadThingImageUrl: parseUrl,
    },
  };

  return require("../src/controllers/catalogController");
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

function serviceRow(overrides = {}) {
  return {
    id: "svc-db-1",
    slug: "haircut",
    name: "Haircut",
    description: "A haircut",
    categoryId: "cat-1",
    category: { id: "cat-1", slug: "salons", name: "Salons" },
    priceNpr: 1500,
    durationMins: 60,
    rating: 4.8,
    benefits: [],
    imageUrl: "https://old.example/image.png",
    isActive: true,
    ...overrides,
  };
}

function specialistRow(overrides = {}) {
  return {
    id: "sp-db-1",
    slug: "sita-sharma",
    name: "Sita Sharma",
    title: "Senior Stylist",
    bio: "Bio",
    experience: 5,
    rating: 4.9,
    specialty: "Salons",
    imageUrl: "https://old.example/avatar.png",
    isActive: true,
    schedules: [],
    services: [],
    ...overrides,
  };
}

test("uploadServiceImage persists the UploadThing URL in PostgreSQL", async () => {
  let updateArgs;
  const prisma = {
    service: {
      findFirst: async () => serviceRow(),
      update: async (args) => {
        updateArgs = args;
        return serviceRow({ imageUrl: args.data.imageUrl });
      },
    },
  };
  const controller = freshController({
    prisma,
    upload: async () => ({ ok: true, url: "https://app.ufs.sh/f/service-key.png" }),
  });

  const res = mockRes();
  await controller.uploadServiceImage(
    { params: { id: "haircut" }, file: { originalname: "service.png" } },
    res,
    (err) => {
      throw err;
    }
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.service.image, "https://app.ufs.sh/f/service-key.png");
  assert.equal(updateArgs.where.id, "svc-db-1");
  assert.equal(updateArgs.data.imageUrl, "https://app.ufs.sh/f/service-key.png");
});

test("uploadSpecialistImage persists the UploadThing URL in PostgreSQL", async () => {
  let updateArgs;
  const prisma = {
    specialist: {
      findFirst: async () => specialistRow(),
      update: async (args) => {
        updateArgs = args;
        return specialistRow({ imageUrl: args.data.imageUrl });
      },
    },
  };
  const controller = freshController({
    prisma,
    upload: async () => ({ ok: true, url: "https://app.ufs.sh/f/avatar-key.png" }),
  });

  const res = mockRes();
  await controller.uploadSpecialistImage(
    { params: { id: "sita-sharma" }, file: { originalname: "avatar.png" } },
    res,
    (err) => {
      throw err;
    }
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.specialist.image, "https://app.ufs.sh/f/avatar-key.png");
  assert.equal(updateArgs.where.id, "sp-db-1");
  assert.equal(updateArgs.data.imageUrl, "https://app.ufs.sh/f/avatar-key.png");
});

test("uploadServiceImage returns the upload error and does not update the database", async () => {
  let updated = false;
  const prisma = {
    service: {
      findFirst: async () => serviceRow(),
      update: async () => {
        updated = true;
        return serviceRow();
      },
    },
  };
  const controller = freshController({
    prisma,
    upload: async () => ({ ok: false, status: 400, message: "Invalid image type." }),
  });

  const res = mockRes();
  await controller.uploadServiceImage(
    { params: { id: "haircut" }, file: { originalname: "bad.pdf" } },
    res,
    (err) => {
      throw err;
    }
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /Invalid image type/i);
  assert.equal(updated, false);
});

test("updateService does not clear an existing image when editing other fields", async () => {
  let updateArgs;
  const prisma = {
    service: {
      findFirst: async () => serviceRow(),
      update: async (args) => {
        updateArgs = args;
        return serviceRow({ ...args.data, imageUrl: serviceRow().imageUrl });
      },
    },
  };
  const controller = freshController({
    prisma,
    upload: async () => ({ ok: false, status: 503, message: "not configured" }),
  });

  const res = mockRes();
  await controller.updateService(
    { params: { id: "haircut" }, body: { description: "Updated description" } },
    res,
    (err) => {
      throw err;
    }
  );

  assert.equal(res.statusCode, 200);
  assert.equal(updateArgs.data.description, "Updated description");
  assert.equal(Object.prototype.hasOwnProperty.call(updateArgs.data, "imageUrl"), false);
  assert.equal(res.body.service.image, "https://old.example/image.png");
});

test("updateSpecialist does not clear an existing image when editing other fields", async () => {
  let updateArgs;
  const prisma = {
    specialist: {
      findFirst: async () => specialistRow(),
      update: async (args) => {
        updateArgs = args;
        return specialistRow({ ...args.data, imageUrl: specialistRow().imageUrl });
      },
    },
  };
  const controller = freshController({
    prisma,
    upload: async () => ({ ok: false, status: 503, message: "not configured" }),
  });

  const res = mockRes();
  await controller.updateSpecialist(
    { params: { id: "sita-sharma" }, body: { title: "Lead Stylist" } },
    res,
    (err) => {
      throw err;
    }
  );

  assert.equal(res.statusCode, 200);
  assert.equal(updateArgs.data.title, "Lead Stylist");
  assert.equal(Object.prototype.hasOwnProperty.call(updateArgs.data, "imageUrl"), false);
  assert.equal(res.body.specialist.image, "https://old.example/avatar.png");
});

test("deleteService deletes the database row before deleting its unused UploadThing image", async () => {
  const calls = [];
  const prisma = {
    service: {
      findFirst: async () => serviceRow({ imageUrl: "https://app.ufs.sh/f/svc-key.png" }),
      count: async () => 0,
      delete: async () => {
        calls.push("service.delete");
      },
    },
    specialist: { count: async () => 0 },
    appointment: { count: async () => 0 },
  };

  let deletedUrl;
  const controller = freshController({
    prisma,
    upload: async () => ({ ok: false, status: 500, message: "unused" }),
    removeImage: async (url) => {
      assert.deepEqual(calls, ["service.delete"], "cloud deletion must happen after DB deletion");
      deletedUrl = url;
      return { ok: true, deleted: true, key: "svc-key.png" };
    },
  });

  const res = mockRes();
  await controller.deleteService({ params: { id: "haircut" } }, res, (err) => {
    throw err;
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, "Service deleted.");
  assert.equal(deletedUrl, "https://app.ufs.sh/f/svc-key.png");
  assert.equal(res.body.imageCleanup.status, "deleted");
  assert.equal(res.body.warning, undefined);
});

test("deleteSpecialist deletes the database row before deleting its unused UploadThing image", async () => {
  const calls = [];
  const prisma = {
    specialist: {
      findFirst: async () => specialistRow({ imageUrl: "https://app.ufs.sh/f/sp-key.png" }),
      count: async () => 0,
      delete: async () => {
        calls.push("specialist.delete");
      },
    },
    service: { count: async () => 0 },
    appointment: { count: async () => 0 },
  };

  let deletedUrl;
  const controller = freshController({
    prisma,
    upload: async () => ({ ok: false, status: 500, message: "unused" }),
    removeImage: async (url) => {
      assert.deepEqual(calls, ["specialist.delete"], "cloud deletion must happen after DB deletion");
      deletedUrl = url;
      return { ok: true, deleted: true, key: "sp-key.png" };
    },
  });

  const res = mockRes();
  await controller.deleteSpecialist({ params: { id: "sita-sharma" } }, res, (err) => {
    throw err;
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(deletedUrl, "https://app.ufs.sh/f/sp-key.png");
  assert.equal(res.body.imageCleanup.status, "deleted");
});

test("cloud files still referenced by another record are never deleted", async () => {
  const prisma = {
    service: {
      findFirst: async () => serviceRow({ imageUrl: "https://app.ufs.sh/f/shared-key.png" }),
      count: async () => 0,
      delete: async () => {},
    },
    specialist: { count: async () => 1 },
    appointment: { count: async () => 0 },
  };

  let deleteCalled = false;
  const controller = freshController({
    prisma,
    upload: async () => ({ ok: false, status: 500, message: "unused" }),
    removeImage: async () => {
      deleteCalled = true;
      return { ok: true, deleted: true };
    },
  });

  const res = mockRes();
  await controller.deleteService({ params: { id: "haircut" } }, res, (err) => {
    throw err;
  });

  assert.equal(deleteCalled, false);
  assert.equal(res.body.success, true);
  assert.equal(res.body.imageCleanup.status, "skipped");
  assert.equal(res.body.imageCleanup.reason, "still-referenced");
  assert.equal(res.body.imageCleanup.referenceCount, 1);
});

test("a failed cloud deletion is reported as a warning after the database row is deleted", async () => {
  const prisma = {
    service: {
      findFirst: async () => serviceRow({ imageUrl: "https://app.ufs.sh/f/svc-key.png" }),
      count: async () => 0,
      delete: async () => {},
    },
    specialist: { count: async () => 0 },
    appointment: { count: async () => 0 },
  };

  const controller = freshController({
    prisma,
    upload: async () => ({ ok: false, status: 500, message: "unused" }),
    removeImage: async () => ({
      ok: false,
      status: 502,
      message: "Image deletion failed. The file may still exist in UploadThing.",
    }),
  });

  const res = mockRes();
  await controller.deleteService({ params: { id: "haircut" } }, res, (err) => {
    throw err;
  });

  assert.equal(res.body.success, true);
  assert.equal(res.body.message, "Service deleted.");
  assert.equal(res.body.imageCleanup.status, "failed");
  assert.match(res.body.warning, /could not be removed from UploadThing/i);
  assert.match(res.body.warning, /uploadthing dashboard/i);
});

test("a failed database delete does not delete the cloud image", async () => {
  const prisma = {
    service: {
      findFirst: async () => serviceRow({ imageUrl: "https://app.ufs.sh/f/svc-key.png" }),
      count: async () => 0,
      delete: async () => {
        const err = new Error("database unavailable");
        err.code = "DB_DOWN";
        throw err;
      },
    },
    specialist: { count: async () => 0 },
    appointment: { count: async () => 0 },
  };

  let deleteCalled = false;
  const controller = freshController({
    prisma,
    upload: async () => ({ ok: false, status: 500, message: "unused" }),
    removeImage: async () => {
      deleteCalled = true;
      return { ok: true, deleted: true };
    },
  });

  let nextError;
  const res = mockRes();
  await controller.deleteService({ params: { id: "haircut" } }, res, (err) => {
    nextError = err;
  });

  assert.equal(deleteCalled, false);
  assert.equal(nextError.message, "database unavailable");
});

test("removeServiceImage clears the database reference and then deletes the cloud file", async () => {
  let updated = false;
  let updateArgs;
  const prisma = {
    service: {
      findFirst: async () => serviceRow({ imageUrl: "https://app.ufs.sh/f/old-svc.png" }),
      update: async (args) => {
        updateArgs = args;
        updated = true;
        return serviceRow({ imageUrl: null });
      },
      count: async () => 0,
    },
    specialist: { count: async () => 0 },
  };

  let deletedUrl;
  const controller = freshController({
    prisma,
    upload: async () => ({ ok: false, status: 500, message: "unused" }),
    removeImage: async (url) => {
      assert.equal(updated, true, "cloud deletion must happen after the DB update");
      deletedUrl = url;
      return { ok: true, deleted: true, key: "old-svc.png" };
    },
  });

  const res = mockRes();
  await controller.removeServiceImage({ params: { id: "haircut" } }, res, (err) => {
    throw err;
  });

  assert.equal(res.body.success, true);
  assert.equal(updateArgs.data.imageUrl, null);
  assert.equal(res.body.service.image, "");
  assert.equal(deletedUrl, "https://app.ufs.sh/f/old-svc.png");
  assert.equal(res.body.imageCleanup.status, "deleted");
});

test("replacing a service image deletes the previous cloud file after the DB update", async () => {
  let updated = false;
  const prisma = {
    service: {
      findFirst: async () => serviceRow({ imageUrl: "https://app.ufs.sh/f/old-svc.png" }),
      update: async (args) => {
        updated = true;
        return serviceRow({ imageUrl: args.data.imageUrl });
      },
      count: async () => 0,
    },
    specialist: { count: async () => 0 },
  };

  let deletedUrl;
  const controller = freshController({
    prisma,
    upload: async () => ({ ok: true, url: "https://app.ufs.sh/f/new-svc.png" }),
    removeImage: async (url) => {
      assert.equal(updated, true, "cloud deletion must happen after the DB update");
      deletedUrl = url;
      return { ok: true, deleted: true, key: "old-svc.png" };
    },
  });

  const res = mockRes();
  await controller.uploadServiceImage(
    { params: { id: "haircut" }, file: { originalname: "new.png" } },
    res,
    (err) => {
      throw err;
    }
  );

  assert.equal(res.body.success, true);
  assert.equal(res.body.service.image, "https://app.ufs.sh/f/new-svc.png");
  assert.equal(deletedUrl, "https://app.ufs.sh/f/old-svc.png");
  assert.equal(res.body.imageCleanup.status, "deleted");
});

test("a newly uploaded image is removed when saving its URL to PostgreSQL fails", async () => {
  const prisma = {
    service: {
      findFirst: async () => serviceRow({ imageUrl: "https://app.ufs.sh/f/old-svc.png" }),
      update: async () => {
        const err = new Error("database write failed");
        err.code = "DB_DOWN";
        throw err;
      },
      count: async () => 0,
    },
    specialist: { count: async () => 0 },
  };

  let deletedUrl;
  const controller = freshController({
    prisma,
    upload: async () => ({ ok: true, url: "https://app.ufs.sh/f/new-orphan.png" }),
    removeImage: async (url) => {
      deletedUrl = url;
      return { ok: true, deleted: true, key: "new-orphan.png" };
    },
  });

  let nextError;
  const res = mockRes();
  await controller.uploadServiceImage(
    { params: { id: "haircut" }, file: { originalname: "new.png" } },
    res,
    (err) => {
      nextError = err;
    }
  );

  assert.equal(nextError.message, "database write failed");
  assert.equal(deletedUrl, "https://app.ufs.sh/f/new-orphan.png");
});

test("externally hosted images are never sent to UploadThing deletion", async () => {
  const prisma = {
    service: {
      findFirst: async () =>
        serviceRow({ imageUrl: "https://images.unsplash.com/photo-1631217868264" }),
      count: async () => 0,
      delete: async () => {},
    },
    specialist: { count: async () => 0 },
    appointment: { count: async () => 0 },
  };

  let deleteCalled = false;
  const controller = freshController({
    prisma,
    upload: async () => ({ ok: false, status: 500, message: "unused" }),
    removeImage: async () => {
      deleteCalled = true;
      return { ok: true, deleted: true };
    },
  });

  const res = mockRes();
  await controller.deleteService({ params: { id: "haircut" } }, res, (err) => {
    throw err;
  });

  assert.equal(deleteCalled, false);
  assert.equal(res.body.success, true);
  assert.equal(res.body.imageCleanup.status, "skipped");
  assert.equal(res.body.imageCleanup.reason, "not-uploadthing");
});

test("an unparseable UploadThing URL is reported instead of silently skipped", async () => {
  const prisma = {
    service: {
      findFirst: async () =>
        serviceRow({ imageUrl: "https://app.ufs.sh/f/some/nested/path.png" }),
      count: async () => 0,
      delete: async () => {},
    },
    specialist: { count: async () => 0 },
    appointment: { count: async () => 0 },
  };

  let deleteCalled = false;
  const controller = freshController({
    prisma,
    upload: async () => ({ ok: false, status: 500, message: "unused" }),
    removeImage: async () => {
      deleteCalled = true;
      return { ok: true, deleted: true };
    },
  });

  const res = mockRes();
  await controller.deleteService({ params: { id: "haircut" } }, res, (err) => {
    throw err;
  });

  assert.equal(deleteCalled, false);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, "Service deleted.");
  assert.equal(res.body.imageCleanup.status, "failed");
  assert.match(res.body.warning, /file key could not be determined safely/i);
});
