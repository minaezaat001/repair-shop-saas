"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, schema } from "@/drizzle/client";
import { eq, and, desc, count, like, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type DeviceType = "laptop" | "desktop" | "tablet" | "phone" | "printer" | "other";
type TicketStatus =
  | "intake"
  | "diagnosis"
  | "quote_approval"
  | "in_progress"
  | "completed"
  | "delivered"
  | "closed"
  | "cancelled";

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

interface CreateTicketInput {
  customerId?: string;
  customer?: {
    fullName: string;
    phone: string;
    email?: string;
    address?: string;
  };
  deviceType: DeviceType;
  deviceBrand?: string;
  deviceModel?: string;
  serialNumber?: string;
  reportedProblem: string;
  deviceConditionPhotos?: string[];
  assignedTechnicianId?: string;
  notes?: string;
}

interface AssignTechnicianInput {
  ticketId: string;
  technicianId: string;
}

interface UpdateStatusInput {
  ticketId: string;
  newStatus: TicketStatus;
  note?: string;
}

interface GetTicketsParams {
  page?: number;
  pageSize?: number;
  status?: TicketStatus;
  search?: string;
}

interface TicketListItem {
  id: string;
  ticketNumber: string;
  status: TicketStatus;
  deviceType: DeviceType;
  deviceBrand: string | null;
  deviceModel: string | null;
  serialNumber: string | null;
  customerName: string;
  customerPhone: string;
  assignedTechnicianName: string | null;
  estimatedCost: string | null;
  createdAt: Date;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

async function generateTicketNumber(
  tenantId: string,
  branchId: string,
): Promise<string> {
  const year = new Date().getFullYear();

  const result = await db
    .select({ total: count() })
    .from(schema.tickets)
    .where(
      and(
        eq(schema.tickets.tenantId, tenantId),
        eq(schema.tickets.branchId, branchId),
        sql`EXTRACT(YEAR FROM ${schema.tickets.createdAt}) = ${year}`,
      ),
    );

  const next = (result[0]?.total ?? 0) + 1;
  return `TKT-${year}-${String(next).padStart(5, "0")}`;
}

async function writeAuditLog(opts: {
  tenantId: string;
  branchId: string | null;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}) {
  await db.insert(schema.auditLogs).values({
    tenantId: opts.tenantId,
    branchId: opts.branchId,
    userId: opts.userId,
    action: opts.action,
    entityType: opts.entityType,
    entityId: opts.entityId,
    oldValues: opts.oldValues ?? null,
    newValues: opts.newValues ?? null,
  });
}

export async function createTicketAction(
  input: CreateTicketInput,
): Promise<ActionResult<{ ticketId: string; ticketNumber: string }>> {
  const user = await requireSession();
  const tenantId = user.tenantId;
  const branchId = user.branchId;

  try {

    let customerId = input.customerId;

    if (!customerId) {
      if (!input.customer?.fullName || !input.customer?.phone) {
        return { success: false, error: "Customer name and phone are required" };
      }

      const existing = await db.query.customers.findFirst({
        where: and(
          eq(schema.customers.tenantId, tenantId),
          eq(schema.customers.phone, input.customer.phone),
        ),
      });

      if (existing) {
        customerId = existing.id;
      } else {
        const [created] = await db
          .insert(schema.customers)
          .values({
            tenantId,
            fullName: input.customer.fullName,
            phone: input.customer.phone,
            email: input.customer.email ?? null,
            address: input.customer.address ?? null,
            customerType: "walk_in",
          })
          .returning();

        customerId = created.id;
      }
    }

    const ticketNumber = await generateTicketNumber(tenantId, branchId);

    const [ticket] = await db
      .insert(schema.tickets)
      .values({
        tenantId,
        branchId,
        ticketNumber,
        customerId,
        deviceType: input.deviceType,
        deviceBrand: input.deviceBrand ?? null,
        deviceModel: input.deviceModel ?? null,
        serialNumber: input.serialNumber ?? null,
        reportedProblem: input.reportedProblem,
        deviceConditionPhotos: input.deviceConditionPhotos ?? null,
        status: "intake",
        assignedTechnicianId: input.assignedTechnicianId ?? null,
        notes: input.notes ?? null,
        createdBy: user.id,
      })
      .returning();

    await db.insert(schema.ticketStatusHistory).values({
      ticketId: ticket.id,
      fromStatus: null,
      toStatus: "intake",
      changedBy: user.id,
      note: "Ticket created",
    });

    await writeAuditLog({
      tenantId,
      branchId,
      userId: user.id,
      action: "ticket.create",
      entityType: "ticket",
      entityId: ticket.id,
      newValues: {
        ticketNumber,
        deviceType: input.deviceType,
        customerId,
      },
    });

    revalidatePath(`/${user.tenantSlug}/tickets`);

    return {
      success: true,
      data: { ticketId: ticket.id, ticketNumber },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create ticket";
    return { success: false, error: message };
  }
}

export async function assignTechnicianAction(
  input: AssignTechnicianInput,
): Promise<ActionResult> {
  const user = await requireSession();
  const tenantId = user.tenantId;
  const branchId = user.branchId;

  try {

    const ticket = await db.query.tickets.findFirst({
      where: and(
        eq(schema.tickets.id, input.ticketId),
        eq(schema.tickets.tenantId, tenantId),
        eq(schema.tickets.branchId, branchId),
      ),
    });

    if (!ticket) {
      return { success: false, error: "Ticket not found" };
    }

    const technician = await db.query.users.findFirst({
      where: and(
        eq(schema.users.id, input.technicianId),
        eq(schema.users.tenantId, tenantId),
        eq(schema.users.isActive, true),
      ),
      with: { role: true },
    });

    if (!technician) {
      return { success: false, error: "Technician not found" };
    }

    if (technician.role.roleName !== "technician") {
      return { success: false, error: "Selected user is not a technician" };
    }

    const oldTechnicianId = ticket.assignedTechnicianId;

    await db
      .update(schema.tickets)
      .set({
        assignedTechnicianId: input.technicianId,
        updatedAt: new Date(),
      })
      .where(eq(schema.tickets.id, input.ticketId));

    await writeAuditLog({
      tenantId,
      branchId,
      userId: user.id,
      action: "ticket.assign_technician",
      entityType: "ticket",
      entityId: input.ticketId,
      oldValues: { assignedTechnicianId: oldTechnicianId },
      newValues: { assignedTechnicianId: input.technicianId },
    });

    revalidatePath(`/${user.tenantSlug}/tickets`);

    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to assign technician";
    return { success: false, error: message };
  }
}

export async function updateTicketStatusAction(
  input: UpdateStatusInput,
): Promise<ActionResult> {
  const user = await requireSession();
  const tenantId = user.tenantId;
  const branchId = user.branchId;

  try {

    const ticket = await db.query.tickets.findFirst({
      where: and(
        eq(schema.tickets.id, input.ticketId),
        eq(schema.tickets.tenantId, tenantId),
        eq(schema.tickets.branchId, branchId),
      ),
    });

    if (!ticket) {
      return { success: false, error: "Ticket not found" };
    }

    const fromStatus = ticket.status;

    await db
      .update(schema.tickets)
      .set({
        status: input.newStatus,
        updatedAt: new Date(),
      })
      .where(eq(schema.tickets.id, input.ticketId));

    await db.insert(schema.ticketStatusHistory).values({
      ticketId: input.ticketId,
      fromStatus,
      toStatus: input.newStatus,
      changedBy: user.id,
      note: input.note ?? null,
    });

    await writeAuditLog({
      tenantId,
      branchId,
      userId: user.id,
      action: `ticket.status_change`,
      entityType: "ticket",
      entityId: input.ticketId,
      oldValues: { status: fromStatus },
      newValues: { status: input.newStatus },
    });

    revalidatePath(`/${user.tenantSlug}/tickets`);

    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update ticket status";
    return { success: false, error: message };
  }
}

export async function getTicketsAction(
  params: GetTicketsParams = {},
): Promise<ActionResult<PaginatedResult<TicketListItem>>> {
  const user = await requireSession();
  const tenantId = user.tenantId;
  const branchId = user.branchId;

  try {

    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const filters = [
      eq(schema.tickets.tenantId, tenantId),
      eq(schema.tickets.branchId, branchId),
      sql`${schema.tickets.deletedAt} IS NULL`,
    ];

    if (params.status) {
      filters.push(eq(schema.tickets.status, params.status));
    }

    if (params.search) {
      const term = `%${params.search}%`;
      filters.push(
        or(
          like(schema.tickets.ticketNumber, term),
          like(schema.tickets.serialNumber, term),
          like(schema.tickets.deviceModel, term),
        ),
      );
    }

    const where = and(...filters.filter(f => f !== undefined));

    const [{ total }] = await db
      .select({ total: count() })
      .from(schema.tickets)
      .where(where);

    const rows = await db
      .select({
        id: schema.tickets.id,
        ticketNumber: schema.tickets.ticketNumber,
        status: schema.tickets.status,
        deviceType: schema.tickets.deviceType,
        deviceBrand: schema.tickets.deviceBrand,
        deviceModel: schema.tickets.deviceModel,
        serialNumber: schema.tickets.serialNumber,
        customerName: schema.customers.fullName,
        customerPhone: schema.customers.phone,
        assignedTechnicianName: schema.users.fullName,
        estimatedCost: schema.tickets.estimatedCost,
        createdAt: schema.tickets.createdAt,
      })
      .from(schema.tickets)
      .leftJoin(
        schema.customers,
        eq(schema.tickets.customerId, schema.customers.id),
      )
      .leftJoin(
        schema.users,
        eq(schema.tickets.assignedTechnicianId, schema.users.id),
      )
      .where(where)
      .orderBy(desc(schema.tickets.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      success: true,
      data: {
        items: rows as TicketListItem[],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch tickets";
    return { success: false, error: message };
  }
}
