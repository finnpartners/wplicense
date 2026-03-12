import { pgTable, serial, varchar, text } from "drizzle-orm/pg-core";

export const settingsTable = pgTable("finn_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: text("value").notNull(),
});

export type Setting = typeof settingsTable.$inferSelect;
