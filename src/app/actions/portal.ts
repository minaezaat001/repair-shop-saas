"use server";

import { db, schema } from "@/drizzle/client";
import { eq, and, sql } from "drizzle-orm";

export interface PublicTicketInfo {
  ticketNumber: string;
  customerName: string;
  customerPhone: string;
  deviceBrand: string | null;
  deviceModel: string | null;
  deviceType: string;
  serialNumber: string | null;
  reportedProblem: string;
  notes: string | null;
  status: string;
  expectedDeliveryDate: string | null;
  estimatedCost: string | null;
  createdAt: string;
  tenantName: string;
}

export async function trackTicketPublicAction(
  tenantSlug: string,
  ticketNumber: string,
  phone: string,
): Promise<{ success: true; data: PublicTicketInfo } | { success: false; error: string }> {
  try {
    const [tenant] = await db
      .select({
        id: schema.tenants.id,
        legalName: schema.tenants.legalName,
        tradingName: schema.tenants.tradingName,
      })
      .from(schema.tenants)
      .where(
        and(
          eq(schema.tenants.slug, tenantSlug),
          eq(schema.tenants.isActive, true),
          sql`${schema.tenants.deletedAt} IS NULL`,
        ),
      )
      .limit(1);

    if (!tenant) {
      return { success: false, error: "بيانات الاستعلام غير متطابقة، يرجى التأكد من رقم التيكت ورقم الهاتف" };
    }

    const [ticket] = await db
      .select({
        ticketNumber: schema.tickets.ticketNumber,
        customerName: schema.customers.fullName,
        customerPhone: schema.customers.phone,
        deviceBrand: schema.tickets.deviceBrand,
        deviceModel: schema.tickets.deviceModel,
        deviceType: schema.tickets.deviceType,
        serialNumber: schema.tickets.serialNumber,
        reportedProblem: schema.tickets.reportedProblem,
        notes: schema.tickets.notes,
        status: schema.tickets.status,
        expectedDeliveryDate: schema.tickets.expectedDeliveryDate,
        estimatedCost: schema.tickets.estimatedCost,
        createdAt: schema.tickets.createdAt,
      })
      .from(schema.tickets)
      .innerJoin(schema.customers, eq(schema.tickets.customerId, schema.customers.id))
      .where(
        and(
          eq(schema.tickets.tenantId, tenant.id),
          eq(schema.tickets.ticketNumber, ticketNumber),
          eq(schema.customers.phone, phone),
          sql`${schema.tickets.deletedAt} IS NULL`,
          sql`${schema.customers.deletedAt} IS NULL`,
        ),
      )
      .limit(1);

    if (!ticket) {
      return { success: false, error: "بيانات الاستعلام غير متطابقة، يرجى التأكد من رقم التيكت ورقم الهاتف" };
    }

    return {
      success: true,
      data: {
        ticketNumber: ticket.ticketNumber,
        customerName: ticket.customerName,
        customerPhone: ticket.customerPhone,
        deviceBrand: ticket.deviceBrand,
        deviceModel: ticket.deviceModel,
        deviceType: ticket.deviceType,
        serialNumber: ticket.serialNumber,
        reportedProblem: ticket.reportedProblem,
        notes: ticket.notes,
        status: ticket.status,
        expectedDeliveryDate: ticket.expectedDeliveryDate
          ? new Date(ticket.expectedDeliveryDate).toLocaleDateString("ar-EG", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : null,
        estimatedCost: ticket.estimatedCost,
        createdAt: new Date(ticket.createdAt).toLocaleDateString("ar-EG", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        tenantName: tenant.tradingName ?? tenant.legalName,
      },
    };
  } catch {
    return { success: false, error: "بيانات الاستعلام غير متطابقة، يرجى التأكد من رقم التيكت ورقم الهاتف" };
  }
}
