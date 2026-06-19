"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, schema } from "@/drizzle/client";
import { eq, and, desc, asc, count, like, or, sql, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

interface CreateItemInput {
  partName: string;
  sku: string;
  barcode?: string;
  categoryId?: string;
  costPrice: number;
  sellingPrice: number;
  currentStock: number;
  minAlertQuantity: number;
  description?: string;
  unitType?: string;
}

interface InventoryItemRow {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  categoryName: string | null;
  categoryId: string | null;
  costPrice: string;
  sellingPrice: string;
  reorderPoint: number;
  qtyOnHand: number;
  qtyReserved: number;
  profitMargin: number;
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

export async function createItemAction(
  input: CreateItemInput,
): Promise<ActionResult<{ itemId: string; sku: string; name: string }>> {
  const user = await requireSession();
  const tenantId = user.tenantId;
  const branchId = user.branchId;

  try {
    if (!input.partName.trim()) {
      return { success: false, error: "Item name is required" };
    }
    if (!input.sku.trim()) {
      return { success: false, error: "SKU is required" };
    }
    if (input.costPrice < 0) {
      return { success: false, error: "Cost price cannot be negative" };
    }
    if (input.sellingPrice <= 0) {
      return { success: false, error: "Selling price must be greater than zero" };
    }
    if (input.currentStock < 0) {
      return { success: false, error: "Stock cannot be negative" };
    }

    const existing = await db.query.inventoryItems.findFirst({
      where: and(
        eq(schema.inventoryItems.tenantId, tenantId),
        eq(schema.inventoryItems.sku, input.sku),
        sql`${schema.inventoryItems.deletedAt} IS NULL`,
      ),
    });

    if (existing) {
      return { success: false, error: `An item with SKU "${input.sku}" already exists` };
    }

    const [item] = await db
      .insert(schema.inventoryItems)
      .values({
        tenantId,
        sku: input.sku,
        barcode: input.barcode ?? input.sku,
        name: input.partName,
        description: input.description ?? null,
        categoryId: input.categoryId ?? null,
        unitType: input.unitType ?? "piece",
        costPrice: String(input.costPrice),
        sellingPrice: String(input.sellingPrice),
        reorderPoint: input.minAlertQuantity,
        isActive: true,
      })
      .returning();

    if (input.currentStock > 0) {
      await db.insert(schema.inventoryLocations).values({
        tenantId,
        branchId,
        itemId: item.id,
        qtyOnHand: input.currentStock,
        qtyReserved: 0,
        qtyInOrder: 0,
        qtyDamaged: 0,
      });

      await db.insert(schema.stockAdjustments).values({
        tenantId,
        branchId,
        itemId: item.id,
        userId: user.id,
        adjustmentType: "+",
        qtyChange: input.currentStock,
        qtyBefore: 0,
        qtyAfter: input.currentStock,
        reason: "cycle_count",
        notes: "Initial stock on creation",
      });
    }

    await writeAuditLog({
      tenantId,
      branchId,
      userId: user.id,
      action: "inventory.item.create",
      entityType: "inventory_item",
      entityId: item.id,
      newValues: {
        sku: input.sku,
        name: input.partName,
        costPrice: input.costPrice,
        sellingPrice: input.sellingPrice,
        currentStock: input.currentStock,
      },
    });

    revalidatePath(`/${user.tenantSlug}/inventory`);

    return {
      success: true,
      data: { itemId: item.id, sku: item.sku, name: item.name },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create inventory item";
    return { success: false, error: message };
  }
}

export async function getInventoryItemsAction(params: {
  page?: number;
  pageSize?: number;
  categoryId?: string;
  lowStock?: boolean;
  search?: string;
}): Promise<ActionResult<PaginatedResult<InventoryItemRow>>> {
  const user = await requireSession();
  const tenantId = user.tenantId;
  const branchId = user.branchId;

  try {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
    const offset = (page - 1) * pageSize;

    const filters = [
      eq(schema.inventoryItems.tenantId, tenantId),
      sql`${schema.inventoryItems.deletedAt} IS NULL`,
    ];

    if (params.categoryId) {
      filters.push(eq(schema.inventoryItems.categoryId, params.categoryId));
    }

    if (params.search) {
      const term = `%${params.search}%`;
      filters.push(
        or(
          like(schema.inventoryItems.sku, term),
          like(schema.inventoryItems.barcode, term),
          like(schema.inventoryItems.name, term),
        ),
      );
    }

    const where = and(...filters.filter(f => f !== undefined));

    const [{ total }] = await db
      .select({ total: count() })
      .from(schema.inventoryItems)
      .where(where);

    const rows = await db
      .select({
        id: schema.inventoryItems.id,
        sku: schema.inventoryItems.sku,
        barcode: schema.inventoryItems.barcode,
        name: schema.inventoryItems.name,
        categoryName: schema.inventoryCategories.name,
        categoryId: schema.inventoryItems.categoryId,
        costPrice: schema.inventoryItems.costPrice,
        sellingPrice: schema.inventoryItems.sellingPrice,
        reorderPoint: schema.inventoryItems.reorderPoint,
        qtyOnHand: schema.inventoryLocations.qtyOnHand,
        qtyReserved: schema.inventoryLocations.qtyReserved,
        createdAt: schema.inventoryItems.createdAt,
      })
      .from(schema.inventoryItems)
      .leftJoin(
        schema.inventoryCategories,
        eq(schema.inventoryItems.categoryId, schema.inventoryCategories.id),
      )
      .leftJoin(
        schema.inventoryLocations,
        and(
          eq(schema.inventoryItems.id, schema.inventoryLocations.itemId),
          eq(schema.inventoryLocations.branchId, branchId),
        ),
      )
      .where(where)
      .orderBy(asc(schema.inventoryItems.name))
      .limit(pageSize)
      .offset(offset);

    let items: InventoryItemRow[] = rows.map((r) => {
      const cost = Number(r.costPrice);
      const sell = Number(r.sellingPrice);
      const margin = sell > 0 ? ((sell - cost) / sell) * 100 : 0;
      return {
        id: r.id,
        sku: r.sku,
        barcode: r.barcode,
        name: r.name,
        categoryName: r.categoryName,
        categoryId: r.categoryId,
        costPrice: r.costPrice,
        sellingPrice: r.sellingPrice,
        reorderPoint: r.reorderPoint,
        qtyOnHand: r.qtyOnHand ?? 0,
        qtyReserved: r.qtyReserved ?? 0,
        profitMargin: Math.round(margin * 100) / 100,
        createdAt: r.createdAt,
      };
    });

    if (params.lowStock) {
      items = items.filter((i) => i.qtyOnHand <= i.reorderPoint);
    }

    return {
      success: true,
      data: {
        items,
        total: params.lowStock ? items.length : total,
        page,
        pageSize,
        totalPages: Math.ceil((params.lowStock ? items.length : total) / pageSize),
      },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch inventory items";
    return { success: false, error: message };
  }
}

export async function searchInventoryItemsAction(
  query: string,
): Promise<
  ActionResult<
    Array<{
      id: string;
      sku: string;
      barcode: string | null;
      name: string;
      costPrice: string;
      sellingPrice: string;
      qtyOnHand: number;
      exactMatch: boolean;
    }>
  >
> {
  const user = await requireSession();
  const tenantId = user.tenantId;
  const branchId = user.branchId;

  try {
    const trimmed = query.trim();
    if (!trimmed) {
      return { success: true, data: [] };
    }

    const exact = await db
      .select({
        id: schema.inventoryItems.id,
        sku: schema.inventoryItems.sku,
        barcode: schema.inventoryItems.barcode,
        name: schema.inventoryItems.name,
        costPrice: schema.inventoryItems.costPrice,
        sellingPrice: schema.inventoryItems.sellingPrice,
        qtyOnHand: schema.inventoryLocations.qtyOnHand,
      })
      .from(schema.inventoryItems)
      .leftJoin(
        schema.inventoryLocations,
        and(
          eq(schema.inventoryItems.id, schema.inventoryLocations.itemId),
          eq(schema.inventoryLocations.branchId, branchId),
        ),
      )
      .where(
        and(
          eq(schema.inventoryItems.tenantId, tenantId),
          sql`${schema.inventoryItems.deletedAt} IS NULL`,
          or(
            eq(schema.inventoryItems.sku, trimmed),
            eq(schema.inventoryItems.barcode, trimmed),
          ),
        ),
      )
      .limit(5);

    if (exact.length > 0) {
      return {
        success: true,
        data: exact.map((r) => ({
          id: r.id,
          sku: r.sku,
          barcode: r.barcode,
          name: r.name,
          costPrice: r.costPrice,
          sellingPrice: r.sellingPrice,
          qtyOnHand: r.qtyOnHand ?? 0,
          exactMatch: true,
        })),
      };
    }

    const term = `%${trimmed}%`;
    const partial = await db
      .select({
        id: schema.inventoryItems.id,
        sku: schema.inventoryItems.sku,
        barcode: schema.inventoryItems.barcode,
        name: schema.inventoryItems.name,
        costPrice: schema.inventoryItems.costPrice,
        sellingPrice: schema.inventoryItems.sellingPrice,
        qtyOnHand: schema.inventoryLocations.qtyOnHand,
      })
      .from(schema.inventoryItems)
      .leftJoin(
        schema.inventoryLocations,
        and(
          eq(schema.inventoryItems.id, schema.inventoryLocations.itemId),
          eq(schema.inventoryLocations.branchId, branchId),
        ),
      )
      .where(
        and(
          eq(schema.inventoryItems.tenantId, tenantId),
          sql`${schema.inventoryItems.deletedAt} IS NULL`,
          or(
            like(schema.inventoryItems.sku, term),
            like(schema.inventoryItems.barcode, term),
            like(schema.inventoryItems.name, term),
          ),
        ),
      )
      .orderBy(asc(schema.inventoryItems.name))
      .limit(20);

    return {
      success: true,
      data: partial.map((r) => ({
        id: r.id,
        sku: r.sku,
        barcode: r.barcode,
        name: r.name,
        costPrice: r.costPrice,
        sellingPrice: r.sellingPrice,
        qtyOnHand: r.qtyOnHand ?? 0,
        exactMatch: false,
      })),
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to search inventory";
    return { success: false, error: message };
  }
}

export async function updateStockQuantityAction(input: {
  itemId: string;
  quantityChange: number;
  reason: "damage" | "loss" | "theft" | "vendor_mistake" | "cycle_count" | "return" | "other";
  notes?: string;
}): Promise<ActionResult<{ qtyBefore: number; qtyAfter: number }>> {
  const user = await requireSession();
  const tenantId = user.tenantId;
  const branchId = user.branchId;

  try {
    if (input.quantityChange === 0) {
      return { success: false, error: "Quantity change must be non-zero" };
    }

    const item = await db.query.inventoryItems.findFirst({
      where: and(
        eq(schema.inventoryItems.id, input.itemId),
        eq(schema.inventoryItems.tenantId, tenantId),
        sql`${schema.inventoryItems.deletedAt} IS NULL`,
      ),
    });

    if (!item) {
      return { success: false, error: "Item not found" };
    }

    let location = await db.query.inventoryLocations.findFirst({
      where: and(
        eq(schema.inventoryLocations.itemId, input.itemId),
        eq(schema.inventoryLocations.branchId, branchId),
      ),
    });

    if (!location) {
      const [created] = await db
        .insert(schema.inventoryLocations)
        .values({
          tenantId,
          branchId,
          itemId: input.itemId,
          qtyOnHand: 0,
          qtyReserved: 0,
          qtyInOrder: 0,
          qtyDamaged: 0,
        })
        .returning();
      location = created;
    }

    const qtyBefore = location.qtyOnHand;
    const qtyAfter = qtyBefore + input.quantityChange;

    if (qtyAfter < 0) {
      return {
        success: false,
        error: `Insufficient stock. Available: ${qtyBefore}, tried to remove: ${Math.abs(input.quantityChange)}`,
      };
    }

    await db
      .update(schema.inventoryLocations)
      .set({
        qtyOnHand: qtyAfter,
        updatedAt: new Date(),
      })
      .where(eq(schema.inventoryLocations.id, location.id));

    await db.insert(schema.stockAdjustments).values({
      tenantId,
      branchId,
      itemId: input.itemId,
      userId: user.id,
      adjustmentType: input.quantityChange > 0 ? "+" : "-",
      qtyChange: Math.abs(input.quantityChange),
      qtyBefore,
      qtyAfter,
      reason: input.reason,
      notes: input.notes ?? null,
    });

    await writeAuditLog({
      tenantId,
      branchId,
      userId: user.id,
      action: "inventory.stock.update",
      entityType: "inventory_item",
      entityId: input.itemId,
      newValues: {
        qtyBefore,
        qtyAfter,
        quantityChange: input.quantityChange,
        reason: input.reason,
      },
    });

    revalidatePath(`/${user.tenantSlug}/inventory`);

    return { success: true, data: { qtyBefore, qtyAfter } };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update stock quantity";
    return { success: false, error: message };
  }
}
