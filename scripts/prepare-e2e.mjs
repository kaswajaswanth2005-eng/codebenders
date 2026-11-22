import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const confirmation = "--confirm-reset=CashPilotE2E";
if (!process.argv.includes(confirmation)) {
  console.error(`Refusing to reset the E2E database without ${confirmation}`);
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prismaDir = path.join(root, "prisma");
const databasePath = path.join(prismaDir, "e2e.db");
const expectedUrl = "file:./e2e.db";
if (process.env.DATABASE_URL !== expectedUrl) {
  throw new Error(`E2E preparation requires DATABASE_URL=${expectedUrl}`);
}
if (!databasePath.startsWith(`${prismaDir}${path.sep}`)) {
  throw new Error("Unsafe E2E database path");
}

for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  await rm(`${databasePath}${suffix}`, { force: true });
}

const prisma = new PrismaClient();
try {
  const migrationsDir = path.join(prismaDir, "migrations");
  const entries = (await readdir(migrationsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const entry of entries) {
    const sql = await readFile(path.join(migrationsDir, entry, "migration.sql"), "utf8");
    const statements = sql
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }
  }
  console.log(`Prepared isolated E2E database with ${entries.length} migrations.`);
} finally {
  await prisma.$disconnect();
}
