import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "@workspace/db";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

export async function runMigrations() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(__dirname, "../../../../shared/db/migrations"),
    path.resolve(__dirname, "../../shared/db/migrations"),
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
