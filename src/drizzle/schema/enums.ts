import { pgEnum } from "drizzle-orm/pg-core";

export const customerTypeEnum = pgEnum("customer_type", ["walk_in", "registered", "b2b", "vip"]);

export const ticketStatusEnum = pgEnum("ticket_status", [
  "intake",
  "diagnosis",
  "quote_approval",
  "in_progress",
  "completed",
  "delivered",
  "closed",
  "cancelled",
]);

export const deviceTypeEnum = pgEnum("device_type", [
  "laptop",
  "desktop",
  "tablet",
  "phone",
  "printer",
  "other",
]);

export const paymentTermEnum = pgEnum("payment_term", [
  "cod",
  "net_15",
  "net_30",
  "net_60",
  "net_90",
]);

export const poStatusEnum = pgEnum("po_status", [
  "draft",
  "sent",
  "partially_received",
  "received",
  "billed",
  "cancelled",
]);

export const invoiceTypeEnum = pgEnum("invoice_type", [
  "ticket",
  "pos",
  "diagnostic_fee",
  "credit_note",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "issued",
  "paid",
  "partially_paid",
  "credit_unpaid",
  "credit_partial",
  "overdue",
  "cancelled",
]);

export const supplierLedgerTypeEnum = pgEnum("supplier_ledger_type", [
  "purchase_credit",
  "cash_payment",
]);

export const customerCreditTypeEnum = pgEnum("customer_credit_type", [
  "sale_credit",
  "debt_collection",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "card",
  "wallet",
  "deferred",
  "mixed",
]);

export const paymentDirectionEnum = pgEnum("payment_direction", ["in", "out"]);

export const drawerStatusEnum = pgEnum("drawer_status", ["open", "closed", "reconciled"]);

export const stockAdjustmentReasonEnum = pgEnum("stock_adjustment_reason", [
  "damage",
  "loss",
  "theft",
  "vendor_mistake",
  "cycle_count",
  "return",
  "sale",
  "other",
]);

export const transferStatusEnum = pgEnum("transfer_status", [
  "draft",
  "in_transit",
  "received",
  "cancelled",
]);

export const rmaStatusEnum = pgEnum("rma_status", [
  "pending",
  "sent_to_supplier",
  "replaced",
  "refunded",
  "closed",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "whatsapp",
  "sms",
  "email",
  "in_app",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "sent",
  "delivered",
  "read",
  "failed",
]);
