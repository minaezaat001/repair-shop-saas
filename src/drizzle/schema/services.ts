import { relations } from "drizzle-orm";
import { pgTable, uuid, varchar, text, decimal, boolean, timestamp } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const serviceCatalog = pgTable("service_catalog", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  serviceName: varchar("service_name", { length: 255 }).notNull(),
  description: text("description"),
  defaultPrice: decimal("default_price", { precision: 12, scale: 2 }).notNull(),
  commissionPct: decimal("commission_pct", { precision: 5, scale: 2 }).default("20.00"),
  estimatedHours: decimal("estimated_hours", { precision: 5, scale: 2 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const serviceCatalogRelations = relations(serviceCatalog, ({ one }) => ({
  tenant: one(tenants, {
    fields: [serviceCatalog.tenantId],
    references: [tenants.id],
  }),
}));
