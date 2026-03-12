import { pgTable, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const sessionsTable = pgTable("finn_sessions", {
  sid: varchar("sid", { length: 255 }).primaryKey(),
  sess: text("sess").notNull(),
  expire: timestamp("expire").notNull(),
});
