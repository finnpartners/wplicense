import { pgTable, serial, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("finn_products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  githubRepo: varchar("github_repo", { length: 255 }).notNull(),
  description: text("description"),
  latestVersion: varchar("latest_version", { length: 50 }),
  releaseDate: timestamp("release_date"),
  changelog: text("changelog"),
  downloadUrl: text("download_url"),
  requiresWp: varchar("requires_wp", { length: 20 }),
  testedWp: varchar("tested_wp", { length: 20 }),
  requiresPhp: varchar("requires_php", { length: 20 }),
  lastChecked: timestamp("last_checked"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
  latestVersion: true,
  releaseDate: true,
  changelog: true,
  downloadUrl: true,
  lastChecked: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
