import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
  date,
  jsonb,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { branches } from "./tenants";
import { customers } from "./customers";
import { users } from "./users";
import { inventoryItems, inventoryLocations } from "./inventory";
import { serviceCatalog } from "./services";
import { ticketStatusEnum, deviceTypeEnum } from "./enums";

export const tickets = pgTable("tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  ticketNumber: varchar("ticket_number", { length: 30 }).notNull(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
  deviceType: deviceTypeEnum("device_type").notNull(),
  deviceBrand: varchar("device_brand", { length: 100 }),
  deviceModel: varchar("device_model", { length: 255 }),
  serialNumber: varchar("serial_number", { length: 255 }),
  reportedProblem: text("reported_problem").notNull(),
  deviceConditionPhotos: jsonb("device_condition_photos"),
  status: ticketStatusEnum("status").default("intake"),
  assignedTechnicianId: uuid("assigned_technician_id").references(() => users.id),
  estimatedCost: decimal("estimated_cost", { precision: 12, scale: 2 }),
  finalAmount: decimal("final_amount", { precision: 12, scale: 2 }),
  diagnosticFee: decimal("diagnostic_fee", { precision: 12, scale: 2 }).default("0"),
  storageFeePerDay: decimal("storage_fee_per_day", { precision: 12, scale: 2 }).default("0"),
  expectedDeliveryDate: date("expected_delivery_date"),
  actualDeliveryDate: timestamp("actual_delivery_date", { mode: "date" }),
  warrantyEndDate: date("warranty_end_date"),
  isQuoteApproved: boolean("is_quote_approved"),
  quoteApprovedAt: timestamp("quote_approved_at", { mode: "date" }),
  isQuoteRejected: boolean("is_quote_rejected"),
  quoteRejectedAt: timestamp("quote_rejected_at", { mode: "date" }),
  notes: text("notes"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { mode: "date" }),
});

export const ticketStatusHistory = pgTable("ticket_status_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  fromStatus: ticketStatusEnum("from_status"),
  toStatus: ticketStatusEnum("to_status").notNull(),
  changedBy: uuid("changed_by")
    .notNull()
    .references(() => users.id),
  note: text("note"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const diagnosticChecklistItems = pgTable("diagnostic_checklist_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  isRequired: boolean("is_required").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const ticketDiagnostics = pgTable("ticket_diagnostics", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  checklistItemId: uuid("checklist_item_id").references(() => diagnosticChecklistItems.id),
  result: text("result"),
  notes: text("notes"),
  technicianId: uuid("technician_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const ticketDiagnosticReports = pgTable("ticket_diagnostic_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  technicianId: uuid("technician_id")
    .notNull()
    .references(() => users.id),
  technicalFindings: text("technical_findings").notNull(),
  rootCause: text("root_cause"),
  partsCost: decimal("parts_cost", { precision: 12, scale: 2 }).default("0"),
  laborCost: decimal("labor_cost", { precision: 12, scale: 2 }).default("0"),
  totalEstimate: decimal("total_estimate", { precision: 12, scale: 2 }).default("0"),
  deliveryEstimateDays: integer("delivery_estimate_days"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const ticketPartsUsed = pgTable("ticket_parts_used", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  itemId: uuid("item_id")
    .notNull()
    .references(() => inventoryItems.id),
  locationId: uuid("location_id").references(() => inventoryLocations.id),
  qtyUsed: integer("qty_used").notNull(),
  unitCost: decimal("unit_cost", { precision: 12, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const ticketExternalParts = pgTable("ticket_external_parts", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  partName: varchar("part_name", { length: 255 }).notNull(),
  supplierName: varchar("supplier_name", { length: 255 }),
  qty: integer("qty").notNull(),
  unitCost: decimal("unit_cost", { precision: 12, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const ticketWorkLogs = pgTable("ticket_work_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  technicianId: uuid("technician_id")
    .notNull()
    .references(() => users.id),
  hoursWorked: decimal("hours_worked", { precision: 5, scale: 2 }).notNull(),
  description: text("description"),
  loggedAt: timestamp("logged_at", { mode: "date" }).defaultNow().notNull(),
});

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [tickets.tenantId],
    references: [tenants.id],
  }),
  branch: one(branches, {
    fields: [tickets.branchId],
    references: [branches.id],
  }),
  customer: one(customers, {
    fields: [tickets.customerId],
    references: [customers.id],
  }),
  assignedTechnician: one(users, {
    fields: [tickets.assignedTechnicianId],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [tickets.createdBy],
    references: [users.id],
  }),
  statusHistory: many(ticketStatusHistory),
  diagnostics: many(ticketDiagnostics),
  diagnosticReports: many(ticketDiagnosticReports),
  partsUsed: many(ticketPartsUsed),
  externalParts: many(ticketExternalParts),
  workLogs: many(ticketWorkLogs),
}));

export const ticketStatusHistoryRelations = relations(ticketStatusHistory, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketStatusHistory.ticketId],
    references: [tickets.id],
  }),
  changedByUser: one(users, {
    fields: [ticketStatusHistory.changedBy],
    references: [users.id],
  }),
}));

export const diagnosticChecklistItemsRelations = relations(diagnosticChecklistItems, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [diagnosticChecklistItems.tenantId],
    references: [tenants.id],
  }),
  ticketDiagnostics: many(ticketDiagnostics),
}));

export const ticketDiagnosticsRelations = relations(ticketDiagnostics, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketDiagnostics.ticketId],
    references: [tickets.id],
  }),
  checklistItem: one(diagnosticChecklistItems, {
    fields: [ticketDiagnostics.checklistItemId],
    references: [diagnosticChecklistItems.id],
  }),
  technician: one(users, {
    fields: [ticketDiagnostics.technicianId],
    references: [users.id],
  }),
}));

export const ticketDiagnosticReportsRelations = relations(ticketDiagnosticReports, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketDiagnosticReports.ticketId],
    references: [tickets.id],
  }),
  technician: one(users, {
    fields: [ticketDiagnosticReports.technicianId],
    references: [users.id],
  }),
}));

export const ticketPartsUsedRelations = relations(ticketPartsUsed, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketPartsUsed.ticketId],
    references: [tickets.id],
  }),
  item: one(inventoryItems, {
    fields: [ticketPartsUsed.itemId],
    references: [inventoryItems.id],
  }),
  location: one(inventoryLocations, {
    fields: [ticketPartsUsed.locationId],
    references: [inventoryLocations.id],
  }),
}));

export const ticketExternalPartsRelations = relations(ticketExternalParts, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketExternalParts.ticketId],
    references: [tickets.id],
  }),
}));

export const ticketWorkLogsRelations = relations(ticketWorkLogs, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketWorkLogs.ticketId],
    references: [tickets.id],
  }),
  technician: one(users, {
    fields: [ticketWorkLogs.technicianId],
    references: [users.id],
  }),
}));
