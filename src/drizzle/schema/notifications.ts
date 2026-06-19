import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { branches } from "./tenants";
import { customers } from "./customers";
import { tickets } from "./tickets";
import { notificationChannelEnum, notificationStatusEnum } from "./enums";

export const notificationLogs = pgTable("notification_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").references(() => branches.id),
  channel: notificationChannelEnum("channel").notNull(),
  recipient: varchar("recipient", { length: 255 }).notNull(),
  templateName: varchar("template_name", { length: 100 }),
  messageBody: text("message_body").notNull(),
  referenceType: varchar("reference_type", { length: 50 }),
  referenceId: uuid("reference_id"),
  status: notificationStatusEnum("status").default("pending"),
  externalId: varchar("external_id", { length: 255 }),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at", { mode: "date" }),
  deliveredAt: timestamp("delivered_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const customerPortalSessions = pgTable("customer_portal_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  ticketId: uuid("ticket_id").references(() => tickets.id),
  token: varchar("token", { length: 255 }).unique().notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  isUsed: boolean("is_used").default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const notificationLogsRelations = relations(notificationLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [notificationLogs.tenantId],
    references: [tenants.id],
  }),
  branch: one(branches, {
    fields: [notificationLogs.branchId],
    references: [branches.id],
  }),
}));

export const customerPortalSessionsRelations = relations(customerPortalSessions, ({ one }) => ({
  customer: one(customers, {
    fields: [customerPortalSessions.customerId],
    references: [customers.id],
  }),
  ticket: one(tickets, {
    fields: [customerPortalSessions.ticketId],
    references: [tickets.id],
  }),
}));
