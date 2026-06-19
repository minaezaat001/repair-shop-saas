"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, schema } from "@/drizzle/client";
import { eq, and, sql, count, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

interface SupplierRow {
  id: string;
  supplierCode: string;
  name: string | null;
  companyName: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  taxNumber: string | null;
  accountBalance: string;
  isActive: boolean;
  createdAt: Date;
}

interface SupplierLedgerRow {
  id: string;
  type: "purchase_credit" | "cash_payment";
  amount: string;
  runningBalance: string;
  description: string | null;
  referenceInvoiceId: string | null;
  createdAt: Date;
}

interface CustomerCreditRow {
  id: string;
  fullName: string;
  phone: string;
  creditBalance: string;
  creditLimit: string;
}

interface CustomerCreditLedgerRow {
  id: string;
  type: "sale_credit" | "debt_collection";
  amount: string;
  runningBalance: string;
  description: string | null;
  referenceInvoiceId: string | null;
  createdAt: Date;
}

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

function generateSupplierCode(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SUP-${ts}-${rand}`;
}

// ─── Supplier CRUD ───────────────────────────────────────────────────────────

export async function createSupplierAction(data: {
  name: string;
  phone: string;
  companyName?: string;
  taxNumber?: string;
}): Promise<ActionResult<{ supplierId: string }>> {
  const user = await requireSession();
  const tenantId = user.tenantId;
  const branchId = user.branchId;

  if (!["owner", "manager", "cashier"].includes(user.roleName)) {
    redirect(`/${user.tenantSlug}?error=unauthorized`);
  }

  try {
    if (!data.name.trim()) {
      return { success: false, error: "اسم المورد مطلوب" };
    }

    const [supplier] = await db
      .insert(schema.suppliers)
      .values({
        tenantId,
        branchId,
        supplierCode: generateSupplierCode(),
        companyName: data.companyName ?? data.name,
        name: data.name,
        contactPerson: data.name,
        phone: data.phone,
        taxNumber: data.taxNumber ?? null,
        accountBalance: "0",
      })
      .returning();

    await writeAuditLog({
      tenantId,
      branchId,
      userId: user.id,
      action: "supplier.create",
      entityType: "supplier",
      entityId: supplier.id,
      newValues: { name: data.name, phone: data.phone },
    });

    revalidatePath(`/${user.tenantSlug}/suppliers`);
    return { success: true, data: { supplierId: supplier.id } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "فشل إضافة المورد";
    return { success: false, error: message };
  }
}

export async function getSuppliersAction(): Promise<
  ActionResult<SupplierRow[]>
> {
  const user = await requireSession();
  const tenantId = user.tenantId;
  const branchId = user.branchId;

  try {
    const rows = await db
      .select({
        id: schema.suppliers.id,
        supplierCode: schema.suppliers.supplierCode,
        name: schema.suppliers.name,
        companyName: schema.suppliers.companyName,
        contactPerson: schema.suppliers.contactPerson,
        phone: schema.suppliers.phone,
        email: schema.suppliers.email,
        taxNumber: schema.suppliers.taxNumber,
        accountBalance: schema.suppliers.accountBalance,
        isActive: schema.suppliers.isActive,
        createdAt: schema.suppliers.createdAt,
      })
      .from(schema.suppliers)
      .where(
        and(
          eq(schema.suppliers.tenantId, tenantId),
          eq(schema.suppliers.branchId, branchId),
          sql`${schema.suppliers.deletedAt} IS NULL`,
        ),
      )
      .orderBy(desc(schema.suppliers.createdAt));

    return { success: true, data: rows };
  } catch (err) {
    const message = err instanceof Error ? err.message : "فشل تحميل الموردين";
    return { success: false, error: message };
  }
}

// ─── Supplier Ledger ─────────────────────────────────────────────────────────

export async function getSupplierLedgerAction(
  supplierId: string,
): Promise<ActionResult<SupplierLedgerRow[]>> {
  const user = await requireSession();
  const tenantId = user.tenantId;
  const branchId = user.branchId;

  try {
    const supplier = await db.query.suppliers.findFirst({
      where: and(
        eq(schema.suppliers.id, supplierId),
        eq(schema.suppliers.tenantId, tenantId),
        eq(schema.suppliers.branchId, branchId),
      ),
      columns: { id: true },
    });

    if (!supplier) {
      return { success: false, error: "المورد غير موجود" };
    }

    const rows = await db
      .select({
        id: schema.supplierLedger.id,
        type: schema.supplierLedger.type,
        amount: schema.supplierLedger.amount,
        runningBalance: schema.supplierLedger.runningBalance,
        description: schema.supplierLedger.description,
        referenceInvoiceId: schema.supplierLedger.referenceInvoiceId,
        createdAt: schema.supplierLedger.createdAt,
      })
      .from(schema.supplierLedger)
      .where(
        and(
          eq(schema.supplierLedger.supplierId, supplierId),
          eq(schema.supplierLedger.tenantId, tenantId),
          eq(schema.supplierLedger.branchId, branchId),
        ),
      )
      .orderBy(desc(schema.supplierLedger.createdAt));

    return { success: true, data: rows };
  } catch (err) {
    const message = err instanceof Error ? err.message : "فشل تحميل كشف المورد";
    return { success: false, error: message };
  }
}

// ─── Supplier Purchase Credit ────────────────────────────────────────────────

export async function recordSupplierPurchaseAction(
  supplierId: string,
  items: { itemId: string; qty: number; costPrice: number }[],
  invoiceNumber: string,
): Promise<ActionResult<{ totalCost: number }>> {
  const user = await requireSession();
  const tenantId = user.tenantId;
  const branchId = user.branchId;

  if (!["owner", "manager", "cashier"].includes(user.roleName)) {
    redirect(`/${user.tenantSlug}?error=unauthorized`);
  }

  try {
    if (!items.length) {
      return { success: false, error: "لم يتم إضافة أي أصناف" };
    }
    if (!invoiceNumber.trim()) {
      return { success: false, error: "رقم الفاتورة مطلوب" };
    }

    const supplier = await db.query.suppliers.findFirst({
      where: and(
        eq(schema.suppliers.id, supplierId),
        eq(schema.suppliers.tenantId, tenantId),
        eq(schema.suppliers.branchId, branchId),
      ),
      columns: { id: true, accountBalance: true },
    });

    if (!supplier) {
      return { success: false, error: "المورد غير موجود" };
    }

    let totalCost = 0;
    for (const item of items) {
      if (item.qty <= 0) {
        return { success: false, error: "الكمية يجب أن تكون أكبر من صفر" };
      }
      if (item.costPrice < 0) {
        return { success: false, error: "السعر لا يمكن أن يكون سالباً" };
      }

      const invItem = await db.query.inventoryItems.findFirst({
        where: and(
          eq(schema.inventoryItems.id, item.itemId),
          eq(schema.inventoryItems.tenantId, tenantId),
          sql`${schema.inventoryItems.deletedAt} IS NULL`,
        ),
        columns: { id: true, name: true },
      });

      if (!invItem) {
        return { success: false, error: `الصنف غير موجود` };
      }

      totalCost += item.qty * item.costPrice;

      const location = await db.query.inventoryLocations.findFirst({
        where: and(
          eq(schema.inventoryLocations.itemId, item.itemId),
          eq(schema.inventoryLocations.branchId, branchId),
        ),
      });

      if (location) {
        const qtyBefore = location.qtyOnHand;
        const qtyAfter = qtyBefore + item.qty;

        await db
          .update(schema.inventoryLocations)
          .set({ qtyOnHand: qtyAfter, updatedAt: new Date() })
          .where(eq(schema.inventoryLocations.id, location.id));

        await db.insert(schema.stockAdjustments).values({
          tenantId,
          branchId,
          itemId: item.itemId,
          userId: user.id,
          adjustmentType: "+",
          qtyChange: item.qty,
          qtyBefore,
          qtyAfter,
          reason: "cycle_count",
          notes: `Supplier purchase — ${invoiceNumber}`,
        });
      }
    }

    const currentBalance = Number(supplier.accountBalance);
    const newBalance = currentBalance - totalCost;

    await db
      .update(schema.suppliers)
      .set({ accountBalance: String(newBalance), updatedAt: new Date() })
      .where(eq(schema.suppliers.id, supplierId));

    await db.insert(schema.supplierLedger).values({
      tenantId,
      branchId,
      supplierId,
      type: "purchase_credit",
      amount: String(totalCost),
      runningBalance: String(newBalance),
      description: `مشتريات مورد — فاتورة ${invoiceNumber}`,
      referenceInvoiceId: null,
    });

    await writeAuditLog({
      tenantId,
      branchId,
      userId: user.id,
      action: "supplier.purchase",
      entityType: "supplier",
      entityId: supplierId,
      newValues: { invoiceNumber, totalCost, itemsCount: items.length },
    });

    revalidatePath(`/${user.tenantSlug}/suppliers`);
    revalidatePath(`/${user.tenantSlug}/inventory`);

    return { success: true, data: { totalCost } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "فشل تسجيل المشتريات";
    return { success: false, error: message };
  }
}

// ─── Pay Supplier ────────────────────────────────────────────────────────────

export async function paySupplierAction(
  supplierId: string,
  amount: number,
  paymentMethod: string,
): Promise<ActionResult<{ newBalance: number }>> {
  const user = await requireSession();
  const tenantId = user.tenantId;
  const branchId = user.branchId;

  if (!["owner", "manager", "cashier"].includes(user.roleName)) {
    redirect(`/${user.tenantSlug}?error=unauthorized`);
  }

  try {
    if (amount <= 0) {
      return { success: false, error: "المبلغ يجب أن يكون أكبر من صفر" };
    }

    const activeSession = await db.query.cashDrawerSessions.findFirst({
      where: and(
        eq(schema.cashDrawerSessions.tenantId, tenantId),
        eq(schema.cashDrawerSessions.branchId, branchId),
        eq(schema.cashDrawerSessions.status, "open"),
      ),
    });

    if (!activeSession) {
      return { success: false, error: "يجب فتح الوردية أولاً قبل إتمام عملية الدفع" };
    }

    const supplier = await db.query.suppliers.findFirst({
      where: and(
        eq(schema.suppliers.id, supplierId),
        eq(schema.suppliers.tenantId, tenantId),
        eq(schema.suppliers.branchId, branchId),
      ),
      columns: { id: true, accountBalance: true, name: true, companyName: true },
    });

    if (!supplier) {
      return { success: false, error: "المورد غير موجود" };
    }

    const currentBalance = Number(supplier.accountBalance);
    const newBalance = currentBalance + amount;

    await db
      .update(schema.suppliers)
      .set({ accountBalance: String(newBalance), updatedAt: new Date() })
      .where(eq(schema.suppliers.id, supplierId));

    await db.insert(schema.supplierLedger).values({
      tenantId,
      branchId,
      supplierId,
      type: "cash_payment",
      amount: String(amount),
      runningBalance: String(newBalance),
      description: `دفعة نقدية للمورد ${supplier.name ?? supplier.companyName}`,
      referenceInvoiceId: null,
    });

    const [txnResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${schema.cashDrawerTransactions.amount}), '0')`,
      })
      .from(schema.cashDrawerTransactions)
      .where(eq(schema.cashDrawerTransactions.sessionId, activeSession.id));

    const currentRunning =
      Number(activeSession.initialFloat) + Number(txnResult?.total ?? 0);
    const newDrawerBalance = currentRunning - amount;

    await db.insert(schema.cashDrawerTransactions).values({
      sessionId: activeSession.id,
      transactionType: "payment_out",
      amount: String(amount),
      runningBalance: String(newDrawerBalance),
      createdBy: user.id,
      notes: `دفع مورد — ${supplier.name ?? supplier.companyName}`,
    });

    await writeAuditLog({
      tenantId,
      branchId,
      userId: user.id,
      action: "supplier.payment",
      entityType: "supplier",
      entityId: supplierId,
      newValues: { amount, paymentMethod, newBalance },
    });

    revalidatePath(`/${user.tenantSlug}/suppliers`);
    revalidatePath(`/${user.tenantSlug}/cash-drawer`);

    return { success: true, data: { newBalance } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "فشل دفع المورد";
    return { success: false, error: message };
  }
}

// ─── Customer Credit ─────────────────────────────────────────────────────────

export async function getCustomersWithCreditAction(): Promise<
  ActionResult<CustomerCreditRow[]>
> {
  const user = await requireSession();
  const tenantId = user.tenantId;

  try {
    const rows = await db
      .select({
        id: schema.customers.id,
        fullName: schema.customers.fullName,
        phone: schema.customers.phone,
        creditBalance: schema.customers.creditBalance,
        creditLimit: schema.customers.creditLimit,
      })
      .from(schema.customers)
      .where(
        and(
          eq(schema.customers.tenantId, tenantId),
          sql`${schema.customers.deletedAt} IS NULL`,
          sql`CAST(${schema.customers.creditBalance} AS DECIMAL) > 0`,
        ),
      )
      .orderBy(desc(schema.customers.creditBalance));

    return { success: true, data: rows };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "فشل تحميل ديون العملاء";
    return { success: false, error: message };
  }
}

export async function getCustomerCreditLedgerAction(
  customerId: string,
): Promise<ActionResult<CustomerCreditLedgerRow[]>> {
  const user = await requireSession();
  const tenantId = user.tenantId;
  const branchId = user.branchId;

  try {
    const rows = await db
      .select({
        id: schema.customerCreditLedger.id,
        type: schema.customerCreditLedger.type,
        amount: schema.customerCreditLedger.amount,
        runningBalance: schema.customerCreditLedger.runningBalance,
        description: schema.customerCreditLedger.description,
        referenceInvoiceId: schema.customerCreditLedger.referenceInvoiceId,
        createdAt: schema.customerCreditLedger.createdAt,
      })
      .from(schema.customerCreditLedger)
      .where(
        and(
          eq(schema.customerCreditLedger.customerId, customerId),
          eq(schema.customerCreditLedger.tenantId, tenantId),
          eq(schema.customerCreditLedger.branchId, branchId),
        ),
      )
      .orderBy(desc(schema.customerCreditLedger.createdAt));

    return { success: true, data: rows };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "فشل تحميل كشف حساب العميل";
    return { success: false, error: message };
  }
}

export async function collectCustomerDebtAction(
  customerId: string,
  amount: number,
  paymentMethod: string,
): Promise<ActionResult<{ newBalance: number }>> {
  const user = await requireSession();
  const tenantId = user.tenantId;
  const branchId = user.branchId;

  if (!["owner", "manager", "cashier"].includes(user.roleName)) {
    redirect(`/${user.tenantSlug}?error=unauthorized`);
  }

  try {
    if (amount <= 0) {
      return { success: false, error: "المبلغ يجب أن يكون أكبر من صفر" };
    }

    const activeSession = await db.query.cashDrawerSessions.findFirst({
      where: and(
        eq(schema.cashDrawerSessions.tenantId, tenantId),
        eq(schema.cashDrawerSessions.branchId, branchId),
        eq(schema.cashDrawerSessions.status, "open"),
      ),
    });

    if (!activeSession) {
      return { success: false, error: "يجب فتح الوردية أولاً قبل تحصيل الدين" };
    }

    const customer = await db.query.customers.findFirst({
      where: and(
        eq(schema.customers.id, customerId),
        eq(schema.customers.tenantId, tenantId),
        sql`${schema.customers.deletedAt} IS NULL`,
      ),
      columns: { id: true, creditBalance: true, fullName: true },
    });

    if (!customer) {
      return { success: false, error: "العميل غير موجود" };
    }

    const currentBalance = Number(customer.creditBalance);

    if (amount > currentBalance) {
      return {
        success: false,
        error: `المبلغ المدخل (${amount}) أكبر من الرصيد المستحق (${currentBalance})`,
      };
    }

    const newBalance = currentBalance - amount;

    await db
      .update(schema.customers)
      .set({ creditBalance: String(newBalance), updatedAt: new Date() })
      .where(eq(schema.customers.id, customerId));

    await db.insert(schema.customerCreditLedger).values({
      tenantId,
      branchId,
      customerId,
      type: "debt_collection",
      amount: String(amount),
      runningBalance: String(newBalance),
      description: `تحصيل دين من ${customer.fullName}`,
      referenceInvoiceId: null,
    });

    const [txnResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${schema.cashDrawerTransactions.amount}), '0')`,
      })
      .from(schema.cashDrawerTransactions)
      .where(eq(schema.cashDrawerTransactions.sessionId, activeSession.id));

    const currentRunning =
      Number(activeSession.initialFloat) + Number(txnResult?.total ?? 0);
    const newDrawerBalance = currentRunning + amount;

    await db.insert(schema.cashDrawerTransactions).values({
      sessionId: activeSession.id,
      transactionType: "payment_in",
      amount: String(amount),
      runningBalance: String(newDrawerBalance),
      createdBy: user.id,
      notes: `تحصيل دين — ${customer.fullName}`,
    });

    await writeAuditLog({
      tenantId,
      branchId,
      userId: user.id,
      action: "customer.debt_collection",
      entityType: "customer",
      entityId: customerId,
      newValues: { amount, paymentMethod, newBalance },
    });

    revalidatePath(`/${user.tenantSlug}/customers/credit`);
    revalidatePath(`/${user.tenantSlug}/cash-drawer`);

    return { success: true, data: { newBalance } };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "فشل تحصيل الدين";
    return { success: false, error: message };
  }
}
