import { relations } from "drizzle-orm";
import { pgTable, uuid, varchar, text, decimal, boolean, timestamp } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { branches } from "./tenants";
import { invoices } from "./invoices";
import { customerTypeEnum, customerCreditTypeEnum } from "./enums";

export const customerGroups = pgTable("customer_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  groupName: varchar("group_name", { length: 100 }).notNull(),
  discountPct: decimal("discount_pct", { precision: 5, scale: 2 }).default("0"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  customerType: customerTypeEnum("customer_type").default("registered").notNull(),
  groupId: uuid("group_id").references(() => customerGroups.id),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  email: varchar("email", { length: 255 }),
  address: text("address"),
  nationalId: varchar("national_id", { length: 50 }),
  taxNumber: varchar("tax_number", { length: 50 }),
  creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }).default("0"),
  creditBalance: decimal("credit_balance", { precision: 12, scale: 2 }).default("0"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { mode: "date" }),
});

export const customerCreditLedger = pgTable("customer_credit_ledger", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  type: customerCreditTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  runningBalance: decimal("running_balance", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  referenceInvoiceId: uuid("reference_invoice_id").references(() => invoices.id),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const customerGroupsRelations = relations(customerGroups, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [customerGroups.tenantId],
    references: [tenants.id],
  }),
  customers: many(customers),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [customers.tenantId],
    references: [tenants.id],
  }),
  group: one(customerGroups, {
    fields: [customers.groupId],
    references: [customerGroups.id],
  }),
  creditLedger: many(customerCreditLedger),
}));

export const customerCreditLedgerRelations = relations(customerCreditLedger, ({ one }) => ({
  tenant: one(tenants, {
    fields: [customerCreditLedger.tenantId],
    references: [tenants.id],
  }),
  branch: one(branches, {
    fields: [customerCreditLedger.branchId],
    references: [branches.id],
  }),
  customer: one(customers, {
    fields: [customerCreditLedger.customerId],
    references: [customers.id],
  }),
  referenceInvoice: one(invoices, {
    fields: [customerCreditLedger.referenceInvoiceId],
    references: [invoices.id],
  }),
}));
