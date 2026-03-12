import { pgTable, serial, integer, varchar, text, timestamp, unique } from "drizzle-orm/pg-core";
import { productsTable } from "./products";

export const releasesTable = pgTable("finn_releases", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  version: varchar("version", { length: 50 }).notNull(),
  tagName: varchar("tag_name", { length: 100 }).notNull(),
  changelog: text("changelog"),
  downloadUrl: text("download_url"),
  zipballUrl: text("zipball_url"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  unique().on(table.productId, table.tagName),
]);

export type Release = typeof releasesTable.$inferSelect;
