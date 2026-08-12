import fs from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) loadEnvFile(envPath);
const { runCalendarSync } = await import("@/lib/calendar/google");

try {
  const result = await runCalendarSync();
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
