import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  decimal,
  boolean,
  timestamp,
  date,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { branches } from "./tenants";
import { users } from "./users";
import { tickets } from "./tickets";
import { invoices } from "./invoices";

export const technicianProfiles = pgTable("technician_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  baseSalary: decimal("base_salary", { precision: 12, scale: 2 }).default("0"),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default("20.00"),
  payFrequency: varchar("pay_frequency", { length: 20 }).default("monthly"),
  bankAccount: varchar("bank_account", { length: 100 }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const technicianCommissions = pgTable("technician_commissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  technicianId: uuid("technician_id")
    .notNull()
    .references(() => users.id),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id),
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  laborAmount: decimal("labor_amount", { precision: 12, scale: 2 }).notNull(),
  commissionPct: decimal("commission_pct", { precision: 5, scale: 2 }).notNull(),
  commissionAmount: decimal("commission_amount", { precision: 12, scale: 2 }).notNull(),
  isPaid: boolean("is_paid").default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const technicianPayslips = pgTable("technician_payslips", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  technicianId: uuid("technician_id")
    .notNull()
    .references(() => users.id),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  baseSalary: decimal("base_salary", { precision: 12, scale: 2 }).default("0"),
  totalCommissions: decimal("total_commissions", { precision: 12, scale: 2 }).default("0"),
  deductions: decimal("deductions", { precision: 12, scale: 2 }).default("0"),
  netPay: decimal("net_pay", { precision: 12, scale: 2 }).notNull(),
  isPaid: boolean("is_paid").default(false),
  paidAt: timestamp("paid_at", { mode: "date" }),
  notes: varchar("notes", { length: 500 }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const technicianProfilesRelations = relations(technicianProfiles, ({ one }) => ({
  user: one(users, {
    fields: [technicianProfiles.userId],
    references: [users.id],
  }),
}));

export const technicianCommissionsRelations = relations(technicianCommissions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [technicianCommissions.tenantId],
    references: [tenants.id],
  }),
  technician: one(users, {
    fields: [technicianCommissions.technicianId],
    references: [users.id],
  }),
  ticket: one(tickets, {
    fields: [technicianCommissions.ticketId],
    references: [tickets.id],
  }),
  invoice: one(invoices, {
    fields: [technicianCommissions.invoiceId],
    references: [invoices.id],
  }),
}));

export const technicianPayslipsRelations = relations(technicianPayslips, ({ one }) => ({
  tenant: one(tenants, {
    fields: [technicianPayslips.tenantId],
    references: [tenants.id],
  }),
  branch: one(branches, {
    fields: [technicianPayslips.branchId],
    references: [branches.id],
  }),
  technician: one(users, {
    fields: [technicianPayslips.technicianId],
    references: [users.id],
  }),
}));
