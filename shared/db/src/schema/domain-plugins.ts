import { pgTable, serial, varchar, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { licensesTable } from "./licenses";
import { productsTable } from "./products";

export const domainPluginsTable = pgTable("finn_domain_plugins", {
  id: serial("id").primaryKey(),
  licenseId: integer("license_id").notNull().references(() => licensesTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  domain: varchar("domain", { length: 255 }).notNull(),
  currentVersion: varchar("current_version", { length: 50 }),
  lastCheckedAt: timestamp("last_checked_at").notNull().defaultNow(),
}, (table) => [
  unique("finn_domain_plugins_license_product_unique").on(table.licenseId, table.productId),
]);

export type DomainPlugin = typeof domainPluginsTable.$inferSelect;
