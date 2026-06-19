"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, schema } from "@/drizzle/client";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

interface ActionResult {
  success: boolean;
  error?: string;
  data?: { id: string; partName: string; unitCost: string; lineTotal: string };
}

interface AddPartInput {
  ticketId: string;
  partName: string;
  qty: number;
  unitCost: number;
  sellingPrice: number;
  itemId?: string;
  supplierName?: string;
}

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  return session.user;
}

async function writeAuditLog(opts: {
  tenantId: string;
  userId: string;
  branchId: string | null;
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

export async function addPartToTicketAction(
  input: AddPartInput,
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

    if (input.qty < 1) {
      return { success: false, error: "Quantity must be at least 1" };
    }

    if (input.itemId) {
      const lineTotal = (Number(input.unitCost) * Number(input.qty)).toFixed(2);

      const [inserted] = await db
        .insert(schema.ticketPartsUsed)
        .values({
          ticketId: input.ticketId,
          itemId: input.itemId,
          qtyUsed: input.qty,
          unitCost: String(input.unitCost),
          lineTotal,
        })
        .returning();

      await writeAuditLog({
        tenantId,
        branchId,
        userId: user.id,
        action: "ticket.part_add.inventory",
        entityType: "ticket_parts_used",
        entityId: inserted.id,
        newValues: {
          ticketId: input.ticketId,
          itemId: input.itemId,
          qty: input.qty,
          unitCost: input.unitCost,
          lineTotal,
        },
      });

      revalidatePath(`/${user.tenantSlug}/tickets/${input.ticketId}`);
      return {
        success: true,
        data: { id: inserted.id, partName: input.partName, unitCost: String(input.unitCost), lineTotal },
      };
    }

    const lineTotal = (Number(input.sellingPrice) * Number(input.qty)).toFixed(2);

    const [inserted] = await db
      .insert(schema.ticketExternalParts)
      .values({
        ticketId: input.ticketId,
        partName: input.partName,
        supplierName: input.supplierName ?? null,
        qty: input.qty,
        unitCost: String(input.unitCost),
        lineTotal,
      })
      .returning();

    await writeAuditLog({
      tenantId,
      branchId,
      userId: user.id,
      action: "ticket.part_add.external",
      entityType: "ticket_external_parts",
      entityId: inserted.id,
      newValues: {
        ticketId: input.ticketId,
        partName: input.partName,
        supplierName: input.supplierName,
        qty: input.qty,
        unitCost: input.unitCost,
        sellingPrice: input.sellingPrice,
        lineTotal,
      },
    });

    revalidatePath(`/${user.tenantSlug}/tickets/${input.ticketId}`);
    return {
      success: true,
      data: { id: inserted.id, partName: input.partName, unitCost: String(input.unitCost), lineTotal },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add part";
    return { success: false, error: message };
  }
}
