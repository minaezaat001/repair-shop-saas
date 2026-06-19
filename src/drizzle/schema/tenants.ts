import { relations } from "drizzle-orm";
import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  legalName: varchar("legal_name", { length: 255 }).notNull(),
  tradingName: varchar("trading_name", { length: 255 }),
  taxNumber: varchar("tax_number", { length: 50 }),
  commercialReg: varchar("commercial_reg", { length: 50 }),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }).default("Egypt"),
  currency: varchar("currency", { length: 3 }).default("EGP"),
  dateFormat: varchar("date_format", { length: 20 }).default("DD/MM/YYYY"),
  timezone: varchar("timezone", { length: 50 }).default("Africa/Cairo"),
  subscriptionPlan: varchar("subscription_plan", { length: 50 }),
  subscriptionStatus: varchar("subscription_status", { length: 20 }).default("active"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { mode: "date" }),
});

export const branches = pgTable("branches", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  branchCode: varchar("branch_code", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: varchar("city", { length: 100 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  workingHours: jsonb("working_hours"),
  isHeadOffice: boolean("is_head_office").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { mode: "date" }),
});

export const tenantsRelations = relations(tenants, ({ many }) => ({
  branches: many(branches),
}));

export const branchesRelations = relations(branches, ({ one }) => ({
  tenant: one(tenants, {
    fields: [branches.tenantId],
    references: [tenants.id],
  }),
}));
