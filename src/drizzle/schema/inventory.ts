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
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { branches } from "./tenants";
import { users } from "./users";
import { stockAdjustmentReasonEnum } from "./enums";

export const inventoryCategories = pgTable("inventory_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  parentId: uuid("parent_id").references(() => inventoryCategories.id),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  sku: varchar("sku", { length: 100 }).notNull(),
  barcode: varchar("barcode", { length: 100 }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  categoryId: uuid("category_id").references(() => inventoryCategories.id),
  unitType: varchar("unit_type", { length: 50 }).default("piece"),
  costPrice: decimal("cost_price", { precision: 12, scale: 2 }).notNull(),
  sellingPrice: decimal("selling_price", { precision: 12, scale: 2 }).notNull(),
  b2bPrice: decimal("b2b_price", { precision: 12, scale: 2 }),
  reorderPoint: integer("reorder_point").default(0),
  maxQty: integer("max_qty"),
  trackSerial: boolean("track_serial").default(false),
  trackExpiry: boolean("track_expiry").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { mode: "date" }),
});

export const inventoryLocations = pgTable("inventory_locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  itemId: uuid("item_id")
    .notNull()
    .references(() => inventoryItems.id, { onDelete: "cascade" }),
  qtyOnHand: integer("qty_on_hand").default(0).notNull(),
  qtyReserved: integer("qty_reserved").default(0).notNull(),
  qtyInOrder: integer("qty_in_order").default(0).notNull(),
  qtyDamaged: integer("qty_damaged").default(0).notNull(),
  locationZone: varchar("location_zone", { length: 100 }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const serialNumbers = pgTable("serial_numbers", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  itemId: uuid("item_id")
    .notNull()
    .references(() => inventoryItems.id),
  locationId: uuid("location_id").references(() => inventoryLocations.id),
  serialNo: varchar("serial_no", { length: 255 }).notNull(),
  status: varchar("status", { length: 30 }).default("available"),
  ticketId: uuid("ticket_id"),
  expiryDate: date("expiry_date"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const stockAdjustments = pgTable("stock_adjustments", {
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
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  adjustmentType: varchar("adjustment_type", { length: 10 }).notNull(),
  qtyChange: integer("qty_change").notNull(),
  qtyBefore: integer("qty_before").notNull(),
  qtyAfter: integer("qty_after").notNull(),
  reason: stockAdjustmentReasonEnum("reason").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const inventoryCategoriesRelations = relations(inventoryCategories, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [inventoryCategories.tenantId],
    references: [tenants.id],
  }),
  parent: one(inventoryCategories, {
    fields: [inventoryCategories.parentId],
    references: [inventoryCategories.id],
  }),
  children: many(inventoryCategories),
  items: many(inventoryItems),
}));

export const inventoryItemsRelations = relations(inventoryItems, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [inventoryItems.tenantId],
    references: [tenants.id],
  }),
  category: one(inventoryCategories, {
    fields: [inventoryItems.categoryId],
    references: [inventoryCategories.id],
  }),
  locations: many(inventoryLocations),
  serialNumbers: many(serialNumbers),
  adjustments: many(stockAdjustments),
}));

export const inventoryLocationsRelations = relations(inventoryLocations, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [inventoryLocations.tenantId],
    references: [tenants.id],
  }),
  branch: one(branches, {
    fields: [inventoryLocations.branchId],
    references: [branches.id],
  }),
  item: one(inventoryItems, {
    fields: [inventoryLocations.itemId],
    references: [inventoryItems.id],
  }),
  serialNumbers: many(serialNumbers),
}));

export const serialNumbersRelations = relations(serialNumbers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [serialNumbers.tenantId],
    references: [tenants.id],
  }),
  item: one(inventoryItems, {
    fields: [serialNumbers.itemId],
    references: [inventoryItems.id],
  }),
  location: one(inventoryLocations, {
    fields: [serialNumbers.locationId],
    references: [inventoryLocations.id],
  }),
}));

export const stockAdjustmentsRelations = relations(stockAdjustments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [stockAdjustments.tenantId],
    references: [tenants.id],
  }),
  branch: one(branches, {
    fields: [stockAdjustments.branchId],
    references: [branches.id],
  }),
  item: one(inventoryItems, {
    fields: [stockAdjustments.itemId],
    references: [inventoryItems.id],
  }),
}));
