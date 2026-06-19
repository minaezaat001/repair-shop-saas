import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { branches } from "./tenants";

export const systemConfigs = pgTable("system_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").references(() => branches.id),
  configKey: varchar("config_key", { length: 255 }).notNull(),
  configValue: jsonb("config_value").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const systemConfigsRelations = relations(systemConfigs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [systemConfigs.tenantId],
    references: [tenants.id],
  }),
  branch: one(branches, {
    fields: [systemConfigs.branchId],
    references: [branches.id],
  }),
}));
