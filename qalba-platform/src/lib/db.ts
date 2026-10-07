import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForDb = globalThis as unknown as { prisma?: PrismaClient };

export function db(): PrismaClient {
  if (globalForDb.prisma) return globalForDb.prisma;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  const poolMax = Number(process.env.DATABASE_POOL_MAX ?? "10");
  if (!Number.isInteger(poolMax) || poolMax < 1 || poolMax > 20) throw new Error("DATABASE_POOL_MAX must be between 1 and 20");
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: poolMax }) });
  // One bounded pool per server process, including production and SSE handlers.
  // Creating a new client on every call defeats DATABASE_POOL_MAX and leaks pools.
  globalForDb.prisma = client;
  return client;
}
