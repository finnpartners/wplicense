import bcrypt from "bcrypt";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

async function seedAdmin() {
  const username = "admin";
  const password = "admin";

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (existing) {
    console.log("Admin user already exists, skipping seed.");
    process.exit(0);
  }

  const hash = await bcrypt.hash(password, 10);
  await db.insert(usersTable).values({ username, passwordHash: hash });
  console.log(`Admin user created: username="${username}", password="${password}"`);
  console.log("IMPORTANT: Change this password after first login!");
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
