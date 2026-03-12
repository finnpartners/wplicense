import { pgTable, serial, varchar, text, timestamp, integer } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const licensesTable = pgTable("finn_licenses", {
  id: serial("id").primaryKey(),
  licenseKey: varchar("license_key", { length: 36 }).notNull().unique(),
  clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
  domain: varchar("domain", { length: 255 }).notNull(),
  pluginAccess: varchar("plugin_access", { length: 20 }).notNull().default("all"),
  productIds: text("product_ids"),
  status: varchar("status", { length: 10 }).notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLicenseSchema = createInsertSchema(licensesTable).omit({
  id: true,
  createdAt: true,
  licenseKey: true,
});
export type InsertLicense = z.infer<typeof insertLicenseSchema>;
export type License = typeof licensesTable.$inferSelect;
