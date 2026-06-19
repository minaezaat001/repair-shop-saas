"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, schema } from "@/drizzle/client";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

type PaymentMethod = "cash" | "card" | "wallet";

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  return session.user;
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

export async function openCashDrawerSessionAction(
  openingBalance: number,
): Promise<ActionResult<{ sessionId: string }>> {
  const user = await requireSession();
  const tenantId = user.tenantId;
  const branchId = user.branchId;

  if (!["owner", "manager", "cashier"].includes(user.roleName)) {
    redirect(`/${user.tenantSlug}?error=unauthorized`);
  }

  try {
    if (openingBalance < 0) {
      return { success: false, error: "Opening balance cannot be negative" };
    }

    const existing = await db.query.cashDrawerSessions.findFirst({
      where: and(
        eq(schema.cashDrawerSessions.tenantId, tenantId),
        eq(schema.cashDrawerSessions.branchId, branchId),
        eq(schema.cashDrawerSessions.status, "open"),
      ),
    });

    if (existing) {
      return {
        success: false,
        error: "An active cash drawer session already exists for this branch",
      };
    }

    const [session] = await db
      .insert(schema.cashDrawerSessions)
      .values({
        tenantId,
        branchId,
        cashierId: user.id,
        initialFloat: String(openingBalance),
        status: "open",
      })
      .returning();

    await writeAuditLog({
      tenantId,
      branchId,
      userId: user.id,
      action: "cash_drawer.open",
      entityType: "cash_drawer_session",
      entityId: session.id,
      newValues: { openingBalance, openedAt: session.openedAt.toISOString() },
    });

    revalidatePath(`/${user.tenantSlug}/cash-drawer`);
    return { success: true, data: { sessionId: session.id } };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to open cash drawer session";
    return { success: false, error: message };
  }
}

export async function generateInvoiceFromTicketAction(
  ticketId: string,
): Promise<
  ActionResult<{
    invoiceId: string;
    invoiceNumber: string;
    totalAmount: number;
  }>
> {
  const user = await requireSession();
  const tenantId = user.tenantId;
  const branchId = user.branchId;

  try {
    const ticket = await db.query.tickets.findFirst({
      where: and(
        eq(schema.tickets.id, ticketId),
        eq(schema.tickets.tenantId, tenantId),
        eq(schema.tickets.branchId, branchId),
      ),
    });

    if (!ticket) return { success: false, error: "Ticket not found" };
    if (ticket.status === "cancelled") {
      return { success: false, error: "Cannot invoice a cancelled ticket" };
    }

    const existingInvoice = await db.query.invoices.findFirst({
      where: and(
        eq(schema.invoices.ticketId, ticketId),
        eq(schema.invoices.tenantId, tenantId),
      ),
    });

    if (existingInvoice) {
      return {
        success: true,
        data: {
          invoiceId: existingInvoice.id,
          invoiceNumber: existingInvoice.invoiceNumber,
          totalAmount: Number(existingInvoice.totalAmount),
        },
      };
    }

    const [partsResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${schema.ticketPartsUsed.lineTotal}), '0')`,
      })
      .from(schema.ticketPartsUsed)
      .where(eq(schema.ticketPartsUsed.ticketId, ticketId));

    const [extPartsResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${schema.ticketExternalParts.lineTotal}), '0')`,
      })
      .from(schema.ticketExternalParts)
      .where(eq(schema.ticketExternalParts.ticketId, ticketId));

    const [laborResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${schema.ticketDiagnosticReports.laborCost}), '0')`,
      })
      .from(schema.ticketDiagnosticReports)
      .where(eq(schema.ticketDiagnosticReports.ticketId, ticketId));

    const partsCost = Number(partsResult?.total ?? 0);
    const extPartsCost = Number(extPartsResult?.total ?? 0);
    const laborCost = Number(laborResult?.total ?? 0);
    const diagnosticFee = Number(ticket.diagnosticFee ?? 0);

    const subtotal = partsCost + extPartsCost + laborCost + diagnosticFee;
    const totalAmount = subtotal;

    const year = new Date().getFullYear();
    const [countResult] = await db
      .select({ total: count() })
      .from(schema.invoices)
      .where(
        and(
          eq(schema.invoices.tenantId, tenantId),
          eq(schema.invoices.branchId, branchId),
          sql`EXTRACT(YEAR FROM ${schema.invoices.createdAt}) = ${year}`,
        ),
      );

    const nextNum = (countResult?.total ?? 0) + 1;
    const invoiceNumber = `INV-${year}-${String(nextNum).padStart(5, "0")}`;

    const [invoice] = await db
      .insert(schema.invoices)
      .values({
        tenantId,
        branchId,
        invoiceNumber,
        invoiceType: "ticket",
        ticketId,
        customerId: ticket.customerId,
        status: "issued",
        subtotal: String(subtotal),
        totalAmount: String(totalAmount),
        paidAmount: "0",
        balanceDue: String(totalAmount),
        createdBy: user.id,
      })
      .returning();

    const lineItems: (typeof schema.invoiceLineItems.$inferInsert)[] = [];
    let sortOrder = 0;

    if (partsCost > 0) {
      lineItems.push({
        invoiceId: invoice.id,
        description: "Inventory Parts",
        qty: "1",
        unitPrice: String(partsCost),
        lineTotal: String(partsCost),
        sortOrder: sortOrder++,
      });
    }
    if (extPartsCost > 0) {
      lineItems.push({
        invoiceId: invoice.id,
        description: "External Parts",
        qty: "1",
        unitPrice: String(extPartsCost),
        lineTotal: String(extPartsCost),
        sortOrder: sortOrder++,
      });
    }
    if (diagnosticFee > 0) {
      lineItems.push({
        invoiceId: invoice.id,
        description: "Diagnostic Fee",
        qty: "1",
        unitPrice: String(diagnosticFee),
        lineTotal: String(diagnosticFee),
        sortOrder: sortOrder++,
      });
    }
    if (laborCost > 0) {
      lineItems.push({
        invoiceId: invoice.id,
        description: "Labor / Service Fees",
        qty: "1",
        unitPrice: String(laborCost),
        lineTotal: String(laborCost),
        sortOrder: sortOrder++,
      });
    }

    if (lineItems.length > 0) {
      await db.insert(schema.invoiceLineItems).values(lineItems);
    }

    await writeAuditLog({
      tenantId,
      branchId,
      userId: user.id,
      action: "invoice.generate",
      entityType: "invoice",
      entityId: invoice.id,
      newValues: {
        invoiceNumber,
        ticketId,
        subtotal,
        totalAmount,
      },
    });

    revalidatePath(`/${user.tenantSlug}/tickets/${ticketId}/invoice`);

    return {
      success: true,
      data: {
        invoiceId: invoice.id,
        invoiceNumber,
        totalAmount,
      },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate invoice";
    return { success: false, error: message };
  }
}

export async function recordPaymentAction(input: {
  invoiceId: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
}): Promise<ActionResult> {
  const user = await requireSession();
  const tenantId = user.tenantId;
  const branchId = user.branchId;

  if (!["owner", "manager", "cashier"].includes(user.roleName)) {
    redirect(`/${user.tenantSlug}?error=unauthorized`);
  }

  try {
    const invoice = await db.query.invoices.findFirst({
      where: and(
        eq(schema.invoices.id, input.invoiceId),
        eq(schema.invoices.tenantId, tenantId),
        eq(schema.invoices.branchId, branchId),
      ),
    });

    if (!invoice) return { success: false, error: "Invoice not found" };
    if (invoice.status === "paid") {
      return { success: false, error: "Invoice is already paid" };
    }
    if (invoice.status === "cancelled") {
      return { success: false, error: "Invoice is cancelled" };
    }
    if (input.amountPaid <= 0) {
      return { success: false, error: "Payment amount must be greater than zero" };
    }

    const oldStatus = invoice.status;

    await db
      .update(schema.invoices)
      .set({
        status: "paid",
        paidAmount: String(input.amountPaid),
        balanceDue: "0",
        updatedAt: new Date(),
      })
      .where(eq(schema.invoices.id, input.invoiceId));

    await db.insert(schema.payments).values({
      tenantId,
      branchId,
      invoiceId: input.invoiceId,
      amount: String(input.amountPaid),
      method: input.paymentMethod,
      direction: "in",
      receivedBy: user.id,
    });

    if (invoice.ticketId) {
      const ticket = await db.query.tickets.findFirst({
        where: and(
          eq(schema.tickets.id, invoice.ticketId),
          eq(schema.tickets.tenantId, tenantId),
        ),
        columns: { id: true, status: true },
      });

      if (ticket && ticket.status !== "delivered" && ticket.status !== "closed") {
        const fromStatus = ticket.status;

        await db
          .update(schema.tickets)
          .set({ status: "delivered", updatedAt: new Date() })
          .where(eq(schema.tickets.id, ticket.id));

        await db.insert(schema.ticketStatusHistory).values({
          ticketId: ticket.id,
          fromStatus,
          toStatus: "delivered",
          changedBy: user.id,
          note: "Invoice paid — ticket delivered to customer",
        });

        await db
          .update(schema.tickets)
          .set({ status: "closed", updatedAt: new Date() })
          .where(eq(schema.tickets.id, ticket.id));

        await db.insert(schema.ticketStatusHistory).values({
          ticketId: ticket.id,
          fromStatus: "delivered",
          toStatus: "closed",
          changedBy: user.id,
          note: "Payment completed — ticket closed",
        });
      }
    }

    const activeSession = await db.query.cashDrawerSessions.findFirst({
      where: and(
        eq(schema.cashDrawerSessions.tenantId, tenantId),
        eq(schema.cashDrawerSessions.branchId, branchId),
        eq(schema.cashDrawerSessions.status, "open"),
      ),
    });

    if (activeSession) {
      const [txnResult] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${schema.cashDrawerTransactions.amount}), '0')`,
        })
        .from(schema.cashDrawerTransactions)
        .where(eq(schema.cashDrawerTransactions.sessionId, activeSession.id));

      const currentRunning =
        Number(activeSession.initialFloat) + Number(txnResult?.total ?? 0);
      const newBalance = currentRunning + input.amountPaid;

      await db.insert(schema.cashDrawerTransactions).values({
        sessionId: activeSession.id,
        invoiceId: input.invoiceId,
        transactionType: "payment_in",
        amount: String(input.amountPaid),
        runningBalance: String(newBalance),
        createdBy: user.id,
      });
    }

    await writeAuditLog({
      tenantId,
      branchId,
      userId: user.id,
      action: "payment.record",
      entityType: "payment",
      entityId: input.invoiceId,
      oldValues: { status: oldStatus },
      newValues: {
        status: "paid",
        amountPaid: input.amountPaid,
        paymentMethod: input.paymentMethod,
      },
    });

    revalidatePath(`/${user.tenantSlug}/tickets`);
    revalidatePath(`/${user.tenantSlug}/tickets/${invoice.ticketId}`);
    revalidatePath(`/${user.tenantSlug}/tickets/${invoice.ticketId}/invoice`);
    revalidatePath(`/${user.tenantSlug}/cash-drawer`);

    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to record payment";
    return { success: false, error: message };
  }
}

export async function closeCashDrawerSessionAction(
  closingBalance: number,
): Promise<ActionResult<{ variance: number }>> {
  const user = await requireSession();
  const tenantId = user.tenantId;
  const branchId = user.branchId;

  if (!["owner", "manager", "cashier"].includes(user.roleName)) {
    redirect(`/${user.tenantSlug}?error=unauthorized`);
  }

  try {
    if (closingBalance < 0) {
      return { success: false, error: "Closing balance cannot be negative" };
    }

    const activeSession = await db.query.cashDrawerSessions.findFirst({
      where: and(
        eq(schema.cashDrawerSessions.tenantId, tenantId),
        eq(schema.cashDrawerSessions.branchId, branchId),
        eq(schema.cashDrawerSessions.status, "open"),
      ),
    });

    if (!activeSession) {
      return { success: false, error: "No active cash drawer session found" };
    }

    const [txnResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${schema.cashDrawerTransactions.amount}), '0')`,
      })
      .from(schema.cashDrawerTransactions)
      .where(eq(schema.cashDrawerTransactions.sessionId, activeSession.id));

    const txnSum = Number(txnResult?.total ?? 0);
    const expectedTotal = Number(activeSession.initialFloat) + txnSum;
    const variance = closingBalance - expectedTotal;

    await db
      .update(schema.cashDrawerSessions)
      .set({
        status: "closed",
        closedAt: new Date(),
        actualTotal: String(closingBalance),
        expectedTotal: String(expectedTotal),
        variance: String(variance),
        updatedAt: new Date(),
      })
      .where(eq(schema.cashDrawerSessions.id, activeSession.id));

    await writeAuditLog({
      tenantId,
      branchId,
      userId: user.id,
      action: "cash_drawer.close",
      entityType: "cash_drawer_session",
      entityId: activeSession.id,
      newValues: {
        expectedTotal,
        actualTotal: closingBalance,
        variance,
      },
    });

    revalidatePath(`/${user.tenantSlug}/cash-drawer`);

    return { success: true, data: { variance } };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to close cash drawer session";
    return { success: false, error: message };
  }
}
