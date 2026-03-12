import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "@workspace/db";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

function getDirname(): string {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return __dirname;
  }
}

export async function runMigrations() {
  const dir = getDirname();
  const candidates = [
    path.resolve(dir, "../../../../shared/db/migrations"),
    path.resolve(dir, "../migrations"),
    path.resolve(dir, "migrations"),
    path.resolve(process.cwd(), "migrations"),
    path.resolve(process.cwd(), "shared/db/migrations"),
  ];

  const migrationsFolder = candidates.find((p) => existsSync(p));
  if (!migrationsFolder) {
    throw new Error(`Could not find migrations folder. Searched: ${candidates.join(", ")}`);
  }

  console.log("Running database migrations...");
  await migrate(db, { migrationsFolder });
  console.log("Migrations complete.");
}
