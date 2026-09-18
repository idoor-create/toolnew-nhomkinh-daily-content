import { PrismaClient } from "@prisma/client";

// Neon/Vercel may expose the pooled connection as POSTGRES_URL when the
// integration is linked. Prisma's schema uses DATABASE_URL, so normalize the
// alias before the client is created.
if (!process.env.DATABASE_URL && process.env.POSTGRES_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_URL;
}

export const prisma = new PrismaClient();
