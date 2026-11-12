// Prisma Client singleton (PostgreSQL via Prisma 7 driver adapter).
// Requires: npm run db:generate (after schema changes) and a valid DATABASE_URL.

const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("../generated/prisma");

const globalForPrisma = globalThis;

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Check backend/.env");
  }
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const prisma = globalForPrisma.__prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.__prisma = prisma;

module.exports = prisma;
