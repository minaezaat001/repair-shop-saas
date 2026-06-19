import { relations } from "drizzle-orm";
import { pgTable, uuid, varchar, text, decimal, timestamp } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { branches } from "./tenants";
import { users } from "./users";
import { invoices } from "./invoices";
import { drawerStatusEnum } from "./enums";

export const cashDrawerSessions = pgTable("cash_drawer_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  cashierId: uuid("cashier_id")
    .notNull()
    .references(() => users.id),
  openedAt: timestamp("opened_at", { mode: "date" }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { mode: "date" }),
  initialFloat: decimal("initial_float", { precision: 12, scale: 2 }).default("0").notNull(),
  expectedTotal: decimal("expected_total", { precision: 12, scale: 2 }),
  actualTotal: decimal("actual_total", { precision: 12, scale: 2 }),
  variance: decimal("variance", { precision: 12, scale: 2 }),
  status: drawerStatusEnum("status").default("open"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const cashDrawerTransactions = pgTable("cash_drawer_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => cashDrawerSessions.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  transactionType: varchar("transaction_type", { length: 30 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  runningBalance: decimal("running_balance", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const cashDrawerSessionsRelations = relations(cashDrawerSessions, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [cashDrawerSessions.tenantId],
    references: [tenants.id],
  }),
  branch: one(branches, {
    fields: [cashDrawerSessions.branchId],
    references: [branches.id],
  }),
  cashier: one(users, {
    fields: [cashDrawerSessions.cashierId],
    references: [users.id],
  }),
  transactions: many(cashDrawerTransactions),
}));

export const cashDrawerTransactionsRelations = relations(cashDrawerTransactions, ({ one }) => ({
  session: one(cashDrawerSessions, {
    fields: [cashDrawerTransactions.sessionId],
    references: [cashDrawerSessions.id],
  }),
  invoice: one(invoices, {
    fields: [cashDrawerTransactions.invoiceId],
    references: [invoices.id],
  }),
  createdByUser: one(users, {
    fields: [cashDrawerTransactions.createdBy],
    references: [users.id],
  }),
}));
