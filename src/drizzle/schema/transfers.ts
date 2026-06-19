import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { branches } from "./tenants";
import { users } from "./users";
import { tickets } from "./tickets";
import { inventoryItems } from "./inventory";
import { suppliers } from "./suppliers";
import { transferStatusEnum, rmaStatusEnum } from "./enums";

export const transferOrders = pgTable("transfer_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  fromBranchId: uuid("from_branch_id")
    .notNull()
    .references(() => branches.id),
  toBranchId: uuid("to_branch_id")
    .notNull()
    .references(() => branches.id),
  status: transferStatusEnum("status").default("draft"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  receivedBy: uuid("received_by").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const transferOrderItems = pgTable("transfer_order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  transferId: uuid("transfer_id")
    .notNull()
    .references(() => transferOrders.id, { onDelete: "cascade" }),
  itemId: uuid("item_id")
    .notNull()
    .references(() => inventoryItems.id),
  qty: integer("qty").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const rmas = pgTable("rmas", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  itemId: uuid("item_id")
    .notNull()
    .references(() => inventoryItems.id),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  ticketId: uuid("ticket_id").references(() => tickets.id),
  rmaNumber: varchar("rma_number", { length: 50 }).notNull(),
  status: rmaStatusEnum("status").default("pending"),
  reason: text("reason").notNull(),
  qty: integer("qty").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const warrantyClaims = pgTable("warranty_claims", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  originalTicketId: uuid("original_ticket_id")
    .notNull()
    .references(() => tickets.id),
  followupTicketId: uuid("followup_ticket_id").references(() => tickets.id),
  claimReason: text("claim_reason").notNull(),
  isApproved: boolean("is_approved"),
  approvedBy: uuid("approved_by").references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const transferOrdersRelations = relations(transferOrders, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [transferOrders.tenantId],
    references: [tenants.id],
  }),
  fromBranch: one(branches, {
    fields: [transferOrders.fromBranchId],
    references: [branches.id],
  }),
  toBranch: one(branches, {
    fields: [transferOrders.toBranchId],
    references: [branches.id],
  }),
  createdByUser: one(users, {
    fields: [transferOrders.createdBy],
    references: [users.id],
  }),
  receivedByUser: one(users, {
    fields: [transferOrders.receivedBy],
    references: [users.id],
  }),
  items: many(transferOrderItems),
}));

export const transferOrderItemsRelations = relations(transferOrderItems, ({ one }) => ({
  transferOrder: one(transferOrders, {
    fields: [transferOrderItems.transferId],
    references: [transferOrders.id],
  }),
  item: one(inventoryItems, {
    fields: [transferOrderItems.itemId],
    references: [inventoryItems.id],
  }),
}));

export const rmasRelations = relations(rmas, ({ one }) => ({
  tenant: one(tenants, {
    fields: [rmas.tenantId],
    references: [tenants.id],
  }),
  branch: one(branches, {
    fields: [rmas.branchId],
    references: [branches.id],
  }),
  item: one(inventoryItems, {
    fields: [rmas.itemId],
    references: [inventoryItems.id],
  }),
  supplier: one(suppliers, {
    fields: [rmas.supplierId],
    references: [suppliers.id],
  }),
  ticket: one(tickets, {
    fields: [rmas.ticketId],
    references: [tickets.id],
  }),
  createdByUser: one(users, {
    fields: [rmas.createdBy],
    references: [users.id],
  }),
}));

export const warrantyClaimsRelations = relations(warrantyClaims, ({ one }) => ({
  tenant: one(tenants, {
    fields: [warrantyClaims.tenantId],
    references: [tenants.id],
  }),
  branch: one(branches, {
    fields: [warrantyClaims.branchId],
    references: [branches.id],
  }),
  originalTicket: one(tickets, {
    fields: [warrantyClaims.originalTicketId],
    references: [tickets.id],
  }),
  followupTicket: one(tickets, {
    fields: [warrantyClaims.followupTicketId],
    references: [tickets.id],
  }),
  approvedByUser: one(users, {
    fields: [warrantyClaims.approvedBy],
    references: [users.id],
  }),
}));
