"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, schema } from "@/drizzle/client";
import { eq, and, desc, count, sql, notInArray, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";

export interface DashboardStats {
  totalRevenue: number;
  netProfit: number;
  profitMargin: number;
  activeTickets: number;
  lowStockCount: number;
  statusBreakdown: { status: string; count: number }[];
  recentActivity: {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    userName: string | null;
    createdAt: Date;
  }[];
}

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  return session.user;
}

export async function getDashboardStatsAction(): Promise<DashboardStats> {
  const user = await requireSession();
  const tenantId = user.tenantId;
  const branchId = user.branchId;

  const [revenueResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${schema.invoices.paidAmount}), '0')`,
    })
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.tenantId, tenantId),
        eq(schema.invoices.branchId, branchId),
        eq(schema.invoices.status, "paid"),
      ),
    );
  const totalRevenue = Number(revenueResult?.total ?? 0);

  const closedTicketIds = db
    .select({ id: schema.tickets.id })
    .from(schema.tickets)
    .where(
      and(
        eq(schema.tickets.tenantId, tenantId),
        eq(schema.tickets.branchId, branchId),
        inArray(schema.tickets.status, ["closed", "delivered"]),
        sql`${schema.tickets.deletedAt} IS NULL`,
      ),
    );

  const [internalPartsCost] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${schema.ticketPartsUsed.unitCost}::numeric * ${schema.ticketPartsUsed.qtyUsed}), '0')`,
    })
    .from(schema.ticketPartsUsed)
    .where(
      inArray(schema.ticketPartsUsed.ticketId, closedTicketIds),
    );

  const [externalPartsCost] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${schema.ticketExternalParts.unitCost}::numeric * ${schema.ticketExternalParts.qty}), '0')`,
    })
    .from(schema.ticketExternalParts)
    .where(
      inArray(schema.ticketExternalParts.ticketId, closedTicketIds),
    );

  const totalPartCost =
    Number(internalPartsCost?.total ?? 0) + Number(externalPartsCost?.total ?? 0);
  const netProfit = totalRevenue - totalPartCost;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const [activeResult] = await db
    .select({ total: count() })
    .from(schema.tickets)
    .where(
      and(
        eq(schema.tickets.tenantId, tenantId),
        eq(schema.tickets.branchId, branchId),
        notInArray(schema.tickets.status, ["closed", "delivered", "cancelled"]),
        sql`${schema.tickets.deletedAt} IS NULL`,
      ),
    );
  const activeTickets = activeResult?.total ?? 0;

  const [lowStockResult] = await db
    .select({ total: count() })
    .from(schema.inventoryLocations)
    .innerJoin(
      schema.inventoryItems,
      eq(schema.inventoryLocations.itemId, schema.inventoryItems.id),
    )
    .where(
      and(
        eq(schema.inventoryLocations.branchId, branchId),
        eq(schema.inventoryItems.tenantId, tenantId),
        sql`${schema.inventoryItems.deletedAt} IS NULL`,
        sql`${schema.inventoryLocations.qtyOnHand} <= ${schema.inventoryItems.reorderPoint}`,
      ),
    );
  const lowStockCount = lowStockResult?.total ?? 0;

  const statusRows = await db
    .select({
      status: schema.tickets.status,
      count: count(),
    })
    .from(schema.tickets)
    .where(
      and(
        eq(schema.tickets.tenantId, tenantId),
        eq(schema.tickets.branchId, branchId),
        notInArray(schema.tickets.status, ["closed", "delivered", "cancelled"]),
        sql`${schema.tickets.deletedAt} IS NULL`,
      ),
    )
    .groupBy(schema.tickets.status)
    .orderBy(desc(count()));

  const statusBreakdown = statusRows.map((r) => ({
    status: r.status,
    count: r.count,
  }));

  const activityRows = await db
    .select({
      id: schema.auditLogs.id,
      action: schema.auditLogs.action,
      entityType: schema.auditLogs.entityType,
      entityId: schema.auditLogs.entityId,
      userName: schema.users.fullName,
      createdAt: schema.auditLogs.createdAt,
    })
    .from(schema.auditLogs)
    .leftJoin(schema.users, eq(schema.auditLogs.userId, schema.users.id))
    .where(
      and(
        eq(schema.auditLogs.tenantId, tenantId),
        sql`(${eq(schema.auditLogs.branchId, branchId)} OR ${schema.auditLogs.branchId} IS NULL)`,
      ),
    )
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(10);

  const recentActivity = activityRows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    userName: r.userName,
    createdAt: r.createdAt,
  }));

  return {
    totalRevenue,
    netProfit,
    profitMargin: Math.round(profitMargin * 100) / 100,
    activeTickets,
    lowStockCount,
    statusBreakdown,
    recentActivity,
  };
}
