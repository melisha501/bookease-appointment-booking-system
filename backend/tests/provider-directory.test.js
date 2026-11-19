// Public provider directory tests with mocked Prisma (no real database).
// The directory must only expose approved, active provider accounts and
// approved, active services. Pending accounts must never be published.

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb";

function freshControllerWithPrisma(prismaMock) {
  const prismaPath = require.resolve("../src/lib/prisma");
  const controllerPath = require.resolve("../src/controllers/providerController");
  delete require.cache[controllerPath];
  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: prismaMock,
  };
  return require("../src/controllers/providerController");
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

function approvedProvider() {
  return {
    id: "provider-1",
    slug: "bright-smiles",
    name: "Bright Smiles Clinic",
    type: "ORGANIZATION",
    description: "Approved clinic",
    email: "hello@brightsmiles.example",
    phone: "9800000000",
    address: "Kathmandu",
    website: "",
    logoUrl: "",
    status: "approved",
    isActive: true,
    services: [
      {
        id: "svc-1",
        slug: "dental-check-up",
        name: "Dental Check-up",
        description: "Approved service",
        categoryId: "cat-1",
        priceNpr: 1500,
        durationMins: 30,
        rating: 5,
        imageUrl: "",
        benefits: [],
        isActive: true,
        approvalStatus: "approved",
        category: { id: "cat-1", slug: "dental", name: "Dental" },
        provider: { id: "provider-1", slug: "bright-smiles", name: "Bright Smiles Clinic" },
      },
    ],
    specialists: [
      {
        id: "sp-1",
        slug: "dr-karki",
        name: "Dr. Karki",
        title: "Dentist",
        bio: "",
        imageUrl: "",
        specialty: "Dental",
        experience: 8,
        rating: 5,
        isActive: true,
      },
    ],
  };
}

test("listPublicProviders only requests approved, active accounts and approved services", async () => {
  let findManyArgs = null;
  const controller = freshControllerWithPrisma({
    provider: {
      findMany: async (args) => {
        findManyArgs = args;
        return [approvedProvider()];
      },
    },
  });
  const res = mockRes();

  await controller.listPublicProviders({}, res, (err) => {
    throw err;
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(findManyArgs.where, { status: "approved", isActive: true });
  assert.deepEqual(findManyArgs.include.services.where, {
    isActive: true,
    approvalStatus: "approved",
  });
  assert.deepEqual(findManyArgs.include.specialists.where, { isActive: true });
  assert.equal(res.body.providers.length, 1);
  assert.equal(res.body.providers[0].name, "Bright Smiles Clinic");
  assert.equal(res.body.providers[0].serviceCount, 1);
  assert.equal(res.body.providers[0].services[0].approvalStatus, "approved");
});

test("getPublicProvider returns 404 for a pending or inactive provider", async () => {
  let findFirstArgs = null;
  const controller = freshControllerWithPrisma({
    provider: {
      findFirst: async (args) => {
        findFirstArgs = args;
        return null;
      },
    },
  });
  const res = mockRes();

  await controller.getPublicProvider({ params: { id: "pending-provider" } }, res, (err) => {
    throw err;
  });

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { success: false, message: "Provider not found." });
  const where = findFirstArgs.where.AND[0];
  assert.deepEqual(where.OR, [
    { slug: "pending-provider" },
    { id: "pending-provider" },
  ]);
  assert.equal(where.status, "approved");
  assert.equal(where.isActive, true);
});
