import { getTicketsAction } from "@/app/actions/tickets";
import Link from "next/link";

type Props = {
  params: { tenant_slug: string };
  searchParams: { page?: string; limit?: string; status?: string; search?: string };
};

const STATUS_MAP: Record<string, { label: string; classes: string }> = {
  intake: {
    label: "استلام",
    classes: "bg-blue-100 text-blue-800 ring-blue-600/20",
  },
  diagnosis: {
    label: "تشخيص",
    classes: "bg-amber-100 text-amber-800 ring-amber-600/20",
  },
  quote_approval: {
    label: "موافقة عرض سعر",
    classes: "bg-orange-100 text-orange-800 ring-orange-600/20",
  },
  in_progress: {
    label: "قيد الصيانة",
    classes: "bg-indigo-100 text-indigo-800 ring-indigo-600/20",
  },
  completed: {
    label: "مكتمل",
    classes: "bg-green-100 text-green-800 ring-green-600/20",
  },
  delivered: {
    label: "تم التسليم",
    classes: "bg-teal-100 text-teal-800 ring-teal-600/20",
  },
  closed: {
    label: "مغلق",
    classes: "bg-slate-100 text-slate-800 ring-slate-600/20",
  },
  cancelled: {
    label: "ملغي",
    classes: "bg-red-100 text-red-800 ring-red-600/20",
  },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? {
    label: status,
    classes: "bg-gray-100 text-gray-800 ring-gray-600/20",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.classes}`}
    >
      {s.label}
    </span>
  );
}

function DeviceCell({
  brand,
  model,
  type,
}: {
  brand: string | null;
  model: string | null;
  type: string;
}) {
  const parts = [brand, model].filter(Boolean);
  const typeLabels: Record<string, string> = {
    laptop: "لابتوب",
    desktop: "كمبيوتر مكتبي",
    tablet: "تابلت",
    phone: "موبايل",
    printer: "طابعة",
    other: "أخرى",
  };
  return (
    <div>
      <span className="text-xs uppercase tracking-wider text-gray-400">
        {typeLabels[type] ?? type}
      </span>
      {parts.length > 0 && (
        <p className="text-sm text-gray-900">{parts.join(" ")}</p>
      )}
    </div>
  );
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-EG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function TicketsPage({ params, searchParams }: Props) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.limit) || 20));
  const status = searchParams.status || undefined;
  const search = searchParams.search || undefined;

  const result = await getTicketsAction({
    page,
    pageSize: limit,
    status: status as any,
    search,
  });

  if (!result.success || !result.data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-red-500">
          {result.error ?? "فشل تحميل التيكتات"}
        </p>
      </div>
    );
  }

  const { items, total, page: currentPage, totalPages } = result.data;

  function buildHref(p: number, s: string | undefined, q: string | undefined) {
    const sp = new URLSearchParams();
    if (p > 1) sp.set("page", String(p));
    if (s) sp.set("status", s);
    if (q) sp.set("search", q);
    const qs = sp.toString();
    return `/${params.tenant_slug}/tickets${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">تيكتات الصيانة</h2>
        <Link
          href={`/${params.tenant_slug}/tickets/intake`}
          className="inline-flex items-center gap-x-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          استقبال جهاز جديد
        </Link>
      </div>

      <form
        method="GET"
        className="flex items-center gap-3"
      >
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
            fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            name="search"
            defaultValue={search ?? ""}
            placeholder="بحث بالتيكت أو جهاز أو سيريال..."
            className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pr-10 pl-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <select
          name="status"
          defaultValue={status ?? ""}
          onChange={(e) => {
            if (e.target.form) e.target.form.submit();
          }}
          className="block rounded-lg border border-gray-300 bg-white py-2.5 pr-3 pl-10 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="">جميع الحالات</option>
          {Object.entries(STATUS_MAP).map(([key, val]) => (
            <option key={key} value={key}>
              {val.label}
            </option>
          ))}
        </select>

        <noscript>
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white"
          >
            تصفية
          </button>
        </noscript>
      </form>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <Th>رقم التيكت</Th>
              <Th>العميل</Th>
              <Th>الجهاز</Th>
              <Th>الحالة</Th>
              <Th>الفني المسؤول</Th>
              <Th>تاريخ الإنشاء</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                  لا توجد تيكتات{search ? ` تطابق "${search}"` : ""}
                </td>
              </tr>
            ) : (
              items.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-sm font-mono font-medium text-gray-900">
                      {t.ticketNumber}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{t.customerName}</p>
                    <p className="text-xs text-gray-400">{t.customerPhone}</p>
                  </td>
                  <td className="px-6 py-4">
                    <DeviceCell brand={t.deviceBrand} model={t.deviceModel} type={t.deviceType} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {t.assignedTechnicianName ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                    {formatDate(t.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <p className="text-sm text-gray-500">
            صفحة {currentPage} من {totalPages} ({total} إجمالي)
          </p>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={buildHref(currentPage - 1, status, search)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                السابق
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={buildHref(currentPage + 1, status, search)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                التالي
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
      {children}
    </th>
  );
}
