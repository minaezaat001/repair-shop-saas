import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, schema } from "@/drizzle/client";
import { eq, and, asc, like, or, sql, count } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";

function formatCurrency(value: string | number | null | undefined): string {
  if (value == null) return "—";
  return `${Number(value).toLocaleString("en-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ج.م`;
}

function StockBadge({ qty, min }: { qty: number; min: number }) {
  if (qty <= 0)
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
        غير متوفر
      </span>
    );
  if (qty <= min)
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
        {qty} مخزون منخفض
      </span>
    );
  return (
    <span className="text-sm font-medium text-gray-900">
      {qty}
    </span>
  );
}

interface PageProps {
  params: { tenant_slug: string };
  searchParams: {
    page?: string;
    search?: string;
    category?: string;
    lowStock?: string;
  };
}

export default async function InventoryPage({ params, searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { tenantId, branchId, tenantSlug } = session.user;
  if (tenantSlug !== params.tenant_slug) redirect(`/${tenantSlug}/inventory`);

  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = 25;
  const offset = (page - 1) * pageSize;

  const filters = [
    eq(schema.inventoryItems.tenantId, tenantId),
    sql`${schema.inventoryItems.deletedAt} IS NULL`,
  ];

  if (searchParams.category) {
    filters.push(eq(schema.inventoryItems.categoryId, searchParams.category));
  }

  if (searchParams.search) {
    const term = `%${searchParams.search}%`;
    filters.push(
      or(
        like(schema.inventoryItems.sku, term),
        like(schema.inventoryItems.barcode, term),
        like(schema.inventoryItems.name, term),
      ),
    );
  }

  const where = and(...filters);

  const categories = await db.query.inventoryCategories.findMany({
    where: eq(schema.inventoryCategories.tenantId, tenantId),
    orderBy: (cat, { asc }) => [asc(cat.name)],
    columns: { id: true, name: true },
  });

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
      costPrice: schema.inventoryItems.costPrice,
      sellingPrice: schema.inventoryItems.sellingPrice,
      reorderPoint: schema.inventoryItems.reorderPoint,
      qtyOnHand: schema.inventoryLocations.qtyOnHand,
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

  let displayRows = rows;

  if (searchParams.lowStock === "true") {
    displayRows = rows.filter((r) => (r.qtyOnHand ?? 0) <= r.reorderPoint);
  }

  const totalPages = Math.ceil(
    (searchParams.lowStock === "true" ? displayRows.length : total) / pageSize,
  );

  function buildUrl(overrides: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const current = {
      page: searchParams.page,
      search: searchParams.search,
      category: searchParams.category,
      lowStock: searchParams.lowStock,
      ...overrides,
    };
    Object.entries(current).forEach(([k, v]) => {
      if (v && v !== "") sp.set(k, v);
    });
    return `/${tenantSlug}/inventory?${sp.toString()}`;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">المخزن والقطع</h1>
          <p className="mt-1 text-sm text-gray-500">
            إدارة القطع، المواد، ومستويات المخزون.
          </p>
        </div>
        <Link
          href={`/${tenantSlug}/inventory/new`}
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          إضافة صنف جديد
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form method="GET" action={`/${tenantSlug}/inventory`} className="flex flex-1 gap-3">
          <div className="relative flex-1">
            <svg
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              name="search"
              defaultValue={searchParams.search ?? ""}
              placeholder="بحث بـ SKU, باركود, أو اسم..."
              autoFocus
              className="block w-full rounded-md border border-gray-300 py-2 pr-10 pl-3 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <select
            name="category"
            value={searchParams.category ?? ""}
            onChange={(e) => {
              const url = new URL(window.location.href);
              if (e.target.value) url.searchParams.set("category", e.target.value);
              else url.searchParams.delete("category");
              url.searchParams.delete("page");
              window.location.href = url.toString();
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">جميع التصنيفات</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            بحث
          </button>
        </form>

        <div className="flex items-center gap-2">
          <Link
            href={searchParams.lowStock === "true" ? buildUrl({ lowStock: undefined, page: undefined }) : buildUrl({ lowStock: "true", page: undefined })}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              searchParams.lowStock === "true"
                ? "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-600/20"
                : "text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            }`}
          >
            المخزون المنخفض فقط
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  SKU / باركود
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  اسم الصنف
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  التصنيف
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  المخزون
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  التكلفة
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  سعر البيع
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  الهامش
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500">
                    {searchParams.search || searchParams.category || searchParams.lowStock
                      ? "لا توجد نتائج تطابق الفلترة"
                      : "لا توجد أصناف بعد. أضف أول صنف لك."}
                  </td>
                </tr>
              ) : (
                displayRows.map((row) => {
                  const cost = Number(row.costPrice);
                  const sell = Number(row.sellingPrice);
                  const margin = sell > 0 ? ((sell - cost) / sell) * 100 : 0;

                  return (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-600">
                        {row.barcode ?? row.sku}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                        {row.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                        {row.categoryName ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-left">
                        <StockBadge
                          qty={row.qtyOnHand ?? 0}
                          min={row.reorderPoint}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-left text-gray-900">
                        {formatCurrency(row.costPrice)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-900">
                        {formatCurrency(row.sellingPrice)}
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-3 text-left font-medium ${
                          margin >= 30
                            ? "text-green-700"
                            : margin >= 15
                              ? "text-amber-700"
                              : "text-red-700"
                        }`}
                      >
                        {margin.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-500">
              صفحة {page} من {totalPages} ({searchParams.lowStock === "true" ? displayRows.length : total} صنف)
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={buildUrl({ page: String(page - 1) })}
                  className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  السابق
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={buildUrl({ page: String(page + 1) })}
                  className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  التالي
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
