// Catalog image controller tests with mocked Prisma + mocked UploadThing.
// Verifies that successful uploads persist the returned URL in PostgreSQL and
// that editing other fields never clears an existing image.

const test = require("node:test");
const assert = require("node:assert/strict");

function freshController({ prisma, upload }) {
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
