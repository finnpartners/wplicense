import { db } from "@workspace/db";
import { userRolesTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";

const DEFAULT_ADMINS = [
  "noah.finn@finnpartners.com",
  "jethro.may@finnpartners.com",
  "solomon.gorkhover@finnpartners.com",
  "radu.cocian@finnpartners.com",
  "dev@localhost",
];

export async function seedDefaultAdmins() {
  try {
    const [{ count }] = await db.select({ count: sql<number>`cast(count(*) as integer)` }).from(userRolesTable);
    if (count > 0) return;

    for (const email of DEFAULT_ADMINS) {
      await db.insert(userRolesTable)
        .values({ email, role: "admin" })
        .onConflictDoNothing();
    }
    console.log(`Seeded ${DEFAULT_ADMINS.length} default admin users.`);
  } catch (err) {
    console.error("Failed to seed default admins:", err);
  }
}
