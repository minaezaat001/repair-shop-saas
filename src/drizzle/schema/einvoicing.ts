import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { invoices } from "./invoices";

export const einvoicingConfigs = pgTable("einvoicing_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  isEnabled: boolean("is_enabled").default(false),
  etaClientId: varchar("eta_client_id", { length: 255 }),
  etaClientSecret: varchar("eta_client_secret", { length: 255 }),
  etaApiUrl: varchar("eta_api_url", { length: 255 }),
  businessCategory: varchar("business_category", { length: 100 }),
  environment: varchar("environment", { length: 20 }).default("sandbox"),
  lastSyncAt: timestamp("last_sync_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const einvoiceLogs = pgTable("einvoice_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id),
  etaUuid: varchar("eta_uuid", { length: 255 }),
  submissionStatus: varchar("submission_status", { length: 30 }),
  requestPayload: jsonb("request_payload"),
  responsePayload: jsonb("response_payload"),
  errorMessage: text("error_message"),
  qrCode: text("qr_code"),
  submittedAt: timestamp("submitted_at", { mode: "date" }).defaultNow(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const einvoicingConfigsRelations = relations(einvoicingConfigs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [einvoicingConfigs.tenantId],
    references: [tenants.id],
  }),
}));

export const einvoiceLogsRelations = relations(einvoiceLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [einvoiceLogs.tenantId],
    references: [tenants.id],
  }),
  invoice: one(invoices, {
    fields: [einvoiceLogs.invoiceId],
    references: [invoices.id],
  }),
}));
