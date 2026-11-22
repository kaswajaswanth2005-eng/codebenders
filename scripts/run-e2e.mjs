import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databasePath = path.join(root, "prisma", "e2e.db");
const env = {
  ...process.env,
  DATABASE_URL: "file:./e2e.db",
  GROQ_API_KEY: "",
  GROQ_MODEL: "",
  CASH_PILOT_E2E: "1",
};
const node = process.execPath;
const playwrightCli = path.join(root, "node_modules", "@playwright", "test", "cli.js");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(`${path.basename(command)} exited with status ${result.status ?? 1}`);
    error.exitCode = result.status ?? 1;
    throw error;
  }
}

let exitCode = 0;
try {
  run(node, ["scripts/prepare-e2e.mjs", "--confirm-reset=CashPilotE2E"]);
  run(node, ["prisma/seed.mjs", "--confirm-reset=CashPilotE2E"]);
  run(node, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "build"]);
  run(node, [playwrightCli, "test"]);
} catch (error) {
  console.error(error instanceof Error ? error.message : "E2E run failed");
  exitCode = typeof error === "object" && error !== null && "exitCode" in error
    ? Number(error.exitCode) || 1
    : 1;
} finally {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    await rm(`${databasePath}${suffix}`, { force: true });
  }
}
process.exitCode = exitCode;
