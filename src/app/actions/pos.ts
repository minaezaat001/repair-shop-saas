"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, schema } from "@/drizzle/client";
import { eq, and, sql, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

interface CartItem {
  itemId: string;
  quantity: number;
  sellingPrice: number;
}

interface RetailSaleResult {
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  items: Array<{ name: string; qty: number; price: number; total: number }>;
  paymentMethod: string;
  createdAt: string;
  cashierName: string;
  tenantName: string;
}

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  return session.user;
}

async function getOrCreateWalkinCustomer(
  tenantId: string,
): Promise<string> {
  const existing = await db.query.customers.findFirst({
    where: and(
      eq(schema.customers.tenantId, tenantId),
      eq(schema.customers.fullName, "عميل نقدي"),
      eq(schema.customers.phone, "0000000000"),
      sql`${schema.customers.deletedAt} IS NULL`,
    ),
    columns: { id: true },
  });

  if (existing) return existing.id;

  const [customer] = await db
    .insert(schema.customers)
    .values({
      tenantId,
      customerType: "walk_in",
      fullName: "عميل نقدي",
      phone: "0000000000",
    })
    .returning({ id: schema.customers.id });

  return customer.id;
}

export async function createRetailSaleAction(
  items: CartItem[],
  paymentMethod: "cash" | "card" | "wallet",
  discountAmount: number,
): Promise<ActionResult<RetailSaleResult>> {
  const user = await requireSession();
  const tenantId = user.tenantId;
  const branchId = user.branchId;

  if (!["owner", "manager", "cashier"].includes(user.roleName)) {
    redirect(`/${user.tenantSlug}?error=unauthorized`);
  }

  if (!items.length) {
    return { success: false, error: "لم يتم إضافة أي أصناف للبيع" };
  }
  if (discountAmount < 0) {
    return { success: false, error: "قيمة الخصم لا يمكن أن تكون سالبة" };
  }

  try {
    const activeSession = await db.query.cashDrawerSessions.findFirst({
      where: and(
        eq(schema.cashDrawerSessions.tenantId, tenantId),
        eq(schema.cashDrawerSessions.branchId, branchId),
        eq(schema.cashDrawerSessions.status, "open"),
      ),
    });

    if (!activeSession) {
      return { success: false, error: "يجب فتح الوردية أولاً قبل إتمام عملية البيع" };
    }

    const resolvedItems: Array<{
      id: string;
      name: string;
      qtyOnHand: number;
      sellingPrice: string;
    }> = [];

    for (const cartItem of items) {
      if (cartItem.quantity <= 0) {
        return {
          success: false,
          error: "الكمية يجب أن تكون أكبر من صفر",
        };
      }
      if (cartItem.sellingPrice < 0) {
        return {
          success: false,
          error: "السعر لا يمكن أن يكون سالباً",
        };
      }

      const item = await db.query.inventoryItems.findFirst({
        where: and(
          eq(schema.inventoryItems.id, cartItem.itemId),
          eq(schema.inventoryItems.tenantId, tenantId),
          sql`${schema.inventoryItems.deletedAt} IS NULL`,
        ),
        columns: {
          id: true,
          name: true,
          sellingPrice: true,
        },
      });

      if (!item) {
        return { success: false, error: "الصنف غير موجود في المخزن" };
      }

      const location = await db.query.inventoryLocations.findFirst({
        where: and(
          eq(schema.inventoryLocations.itemId, cartItem.itemId),
          eq(schema.inventoryLocations.branchId, branchId),
        ),
        columns: { qtyOnHand: true },
      });

      const available = location?.qtyOnHand ?? 0;
      if (available < cartItem.quantity) {
        return {
          success: false,
          error: `الكمية غير متوفرة لـ "${item.name}" — المتوفر: ${available}`,
        };
      }

      resolvedItems.push({
        id: item.id,
        name: item.name,
        qtyOnHand: available,
        sellingPrice: item.sellingPrice,
      });
    }

    const customerId = await getOrCreateWalkinCustomer(tenantId);

    const year = new Date().getFullYear();
    const [countResult] = await db
      .select({ total: count() })
      .from(schema.invoices)
      .where(
        and(
          eq(schema.invoices.tenantId, tenantId),
          eq(schema.invoices.branchId, branchId),
          eq(schema.invoices.invoiceType, "pos"),
          sql`EXTRACT(YEAR FROM ${schema.invoices.createdAt}) = ${year}`,
        ),
      );

    const nextNum = (countResult?.total ?? 0) + 1;
    const invoiceNumber = `INV-RETAIL-${year}-${String(nextNum).padStart(5, "0")}`;

    let subtotal = 0;
    for (const ci of items) {
      subtotal += ci.quantity * ci.sellingPrice;
    }
    const discountClamped = Math.min(discountAmount, subtotal);
    const totalAmount = subtotal - discountClamped;

    const [invoice] = await db
      .insert(schema.invoices)
      .values({
        tenantId,
        branchId,
        invoiceNumber,
        invoiceType: "pos",
        customerId,
        status: "paid",
        subtotal: String(subtotal),
        discountAmount: String(discountClamped),
        totalAmount: String(totalAmount),
        paidAmount: String(totalAmount),
        balanceDue: "0",
        createdBy: user.id,
      })
      .returning();

    const lineItems: (typeof schema.invoiceLineItems.$inferInsert)[] = [];
    const soldItemsForReceipt: RetailSaleResult["items"] = [];

    for (let i = 0; i < items.length; i++) {
      const ci = items[i];
      const ri = resolvedItems[i];
      const lineTotal = ci.quantity * ci.sellingPrice;

      lineItems.push({
        invoiceId: invoice.id,
        itemId: ci.itemId,
        description: ri.name,
        qty: String(ci.quantity),
        unitPrice: String(ci.sellingPrice),
        lineTotal: String(lineTotal),
        sortOrder: i,
      });

      soldItemsForReceipt.push({
        name: ri.name,
        qty: ci.quantity,
        price: ci.sellingPrice,
        total: lineTotal,
      });

      const location = await db.query.inventoryLocations.findFirst({
        where: and(
          eq(schema.inventoryLocations.itemId, ci.itemId),
          eq(schema.inventoryLocations.branchId, branchId),
        ),
      });

      if (location) {
        const qtyBefore = location.qtyOnHand;
        const qtyAfter = qtyBefore - ci.quantity;

        await db
          .update(schema.inventoryLocations)
          .set({ qtyOnHand: qtyAfter, updatedAt: new Date() })
          .where(eq(schema.inventoryLocations.id, location.id));

        await db.insert(schema.stockAdjustments).values({
          tenantId,
          branchId,
          itemId: ci.itemId,
          userId: user.id,
          adjustmentType: "-",
          qtyChange: ci.quantity,
          qtyBefore,
          qtyAfter,
          reason: "sale",
          notes: `Retail POS sale — invoice ${invoiceNumber}`,
        });
      }
    }

    if (lineItems.length > 0) {
      await db.insert(schema.invoiceLineItems).values(lineItems);
    }

    await db.insert(schema.payments).values({
      tenantId,
      branchId,
      invoiceId: invoice.id,
      amount: String(totalAmount),
      method: paymentMethod,
      direction: "in",
      receivedBy: user.id,
    });

    const [txnResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${schema.cashDrawerTransactions.amount}), '0')`,
      })
      .from(schema.cashDrawerTransactions)
      .where(eq(schema.cashDrawerTransactions.sessionId, activeSession.id));

    const currentRunning =
      Number(activeSession.initialFloat) + Number(txnResult?.total ?? 0);
    const newBalance = currentRunning + totalAmount;

    await db.insert(schema.cashDrawerTransactions).values({
      sessionId: activeSession.id,
      invoiceId: invoice.id,
      transactionType: "payment_in",
      amount: String(totalAmount),
      runningBalance: String(newBalance),
      createdBy: user.id,
      notes: `بيع مباشر — ${invoiceNumber}`,
    });

    await db.insert(schema.auditLogs).values({
      tenantId,
      branchId,
      userId: user.id,
      action: "pos.retail_sale",
      entityType: "invoice",
      entityId: invoice.id,
      newValues: {
        invoiceNumber,
        itemsCount: items.length,
        totalAmount,
        paymentMethod,
      },
    });

    revalidatePath(`/${user.tenantSlug}/pos`);
    revalidatePath(`/${user.tenantSlug}/inventory`);
    revalidatePath(`/${user.tenantSlug}/cash-drawer`);

    return {
      success: true,
      data: {
        invoiceId: invoice.id,
        invoiceNumber,
        totalAmount,
        paidAmount: totalAmount,
        items: soldItemsForReceipt,
        paymentMethod,
        createdAt: new Date().toLocaleDateString("ar-EG", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        cashierName: user.name ?? "",
        tenantName: "",
      },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "فشلت عملية البيع";
    return { success: false, error: message };
  }
}

export async function getRetailSaleReceiptAction(
  invoiceId: string,
): Promise<ActionResult<RetailSaleResult & { tenantName: string }>> {
  const user = await requireSession();
  const tenantId = user.tenantId;

  try {
    const invoice = await db.query.invoices.findFirst({
      where: and(
        eq(schema.invoices.id, invoiceId),
        eq(schema.invoices.tenantId, tenantId),
      ),
      with: {
        lineItems: {
          orderBy: (li, { asc }) => [asc(li.sortOrder)],
        },
        payments: {
          limit: 1,
        },
      },
    });

    if (!invoice) {
      return { success: false, error: "الفاتورة غير موجودة" };
    }

    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.id, tenantId),
      columns: { legalName: true, tradingName: true },
    });

    return {
      success: true,
      data: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: Number(invoice.totalAmount),
        paidAmount: Number(invoice.paidAmount),
        items: (invoice.lineItems ?? []).map((li) => ({
          name: li.description,
          qty: Number(li.qty),
          price: Number(li.unitPrice),
          total: Number(li.lineTotal),
        })),
        paymentMethod: invoice.payments?.[0]?.method ?? "cash",
        createdAt: new Date(invoice.createdAt).toLocaleDateString("ar-EG", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        cashierName: "",
        tenantName: tenant?.tradingName ?? tenant?.legalName ?? "",
      },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "فشل تحميل بيانات الفاتورة";
    return { success: false, error: message };
  }
}
