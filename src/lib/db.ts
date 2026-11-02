import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "@/generated/prisma/client";

// 개발 중 HMR 로 모듈이 다시 실행돼도 클라이언트를 하나만 쓰도록 globalThis 에 보관한다
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
