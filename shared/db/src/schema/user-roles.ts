import { pgTable, serial, varchar, timestamp } from "drizzle-orm/pg-core";

export const userRolesTable = pgTable("finn_user_roles", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  role: varchar("role", { length: 50 }).notNull().default("viewer"),
  createdAt: timestamp("created_at").defaultNow(),
});
