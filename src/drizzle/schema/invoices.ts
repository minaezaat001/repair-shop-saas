import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  decimal,
  boolean,
  timestamp,
  date,
  integer,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { branches } from "./tenants";
import { tickets } from "./tickets";
import { customers } from "./customers";
import { users } from "./users";
import { inventoryItems } from "./inventory";
import {
  invoiceTypeEnum,
  invoiceStatusEnum,
  paymentMethodEnum,
  paymentDirectionEnum,
} from "./enums";

export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  invoiceNumber: varchar("invoice_number", { length: 30 }).notNull(),
  invoiceType: invoiceTypeEnum("invoice_type").notNull(),
  ticketId: uuid("ticket_id").references(() => tickets.id),
  customerId: uuid("customer_id").references(() => customers.id),
  status: invoiceStatusEnum("status").default("draft"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).default("0").notNull(),
  discountPct: decimal("discount_pct", { precision: 5, scale: 2 }).default("0"),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).default("0"),
  taxPct: decimal("tax_pct", { precision: 5, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).default("0"),
  balanceDue: decimal("balance_due", { precision: 12, scale: 2 }).default("0"),
  dueDate: date("due_date"),
  notes: text("notes"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const invoiceLineItems = pgTable("invoice_line_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  description: varchar("description", { length: 500 }).notNull(),
  qty: decimal("qty", { precision: 12, scale: 2 }).default("1").notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  discountPct: decimal("discount_pct", { precision: 5, scale: 2 }).default("0"),
  lineTotal: decimal("line_total", { precision: 12, scale: 2 }).notNull(),
  itemId: uuid("item_id").references(() => inventoryItems.id),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").notNull(),
  direction: paymentDirectionEnum("direction").default("in"),
  referenceNo: varchar("reference_no", { length: 100 }),
  receivedBy: uuid("received_by")
    .notNull()
    .references(() => users.id),
  paymentDate: timestamp("payment_date", { mode: "date" }).defaultNow().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const deferredPaymentTracking = pgTable("deferred_payment_tracking", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
  originalAmount: decimal("original_amount", { precision: 12, scale: 2 }).notNull(),
  remainingBalance: decimal("remaining_balance", { precision: 12, scale: 2 }).notNull(),
  dueDate: date("due_date").notNull(),
  reminderSentAt: timestamp("reminder_sent_at", { mode: "date" }),
  isOverdue: boolean("is_overdue").default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [invoices.tenantId],
    references: [tenants.id],
  }),
  branch: one(branches, {
    fields: [invoices.branchId],
    references: [branches.id],
  }),
  ticket: one(tickets, {
    fields: [invoices.ticketId],
    references: [tickets.id],
  }),
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  createdByUser: one(users, {
    fields: [invoices.createdBy],
    references: [users.id],
  }),
  lineItems: many(invoiceLineItems),
  payments: many(payments),
  deferredTracking: many(deferredPaymentTracking),
}));

export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceLineItems.invoiceId],
    references: [invoices.id],
  }),
  item: one(inventoryItems, {
    fields: [invoiceLineItems.itemId],
    references: [inventoryItems.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [payments.tenantId],
    references: [tenants.id],
  }),
  branch: one(branches, {
    fields: [payments.branchId],
    references: [branches.id],
  }),
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
  receivedByUser: one(users, {
    fields: [payments.receivedBy],
    references: [users.id],
  }),
}));

export const deferredPaymentTrackingRelations = relations(deferredPaymentTracking, ({ one }) => ({
  invoice: one(invoices, {
    fields: [deferredPaymentTracking.invoiceId],
    references: [invoices.id],
  }),
  customer: one(customers, {
    fields: [deferredPaymentTracking.customerId],
    references: [customers.id],
  }),
}));
