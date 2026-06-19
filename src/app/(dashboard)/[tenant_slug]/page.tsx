import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getDashboardStatsAction } from "@/app/actions/analytics";

const STATUS_AR: Record<string, string> = {
  intake: "\u0627\u0633\u062A\u0644\u0627\u0645",
  diagnosis: "\u062A\u0634\u062E\u064A\u0635",
  quote_approval: "\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0631\u0636 \u0633\u0639\u0631",
  in_progress: "\u0642\u064A\u062F \u0627\u0644\u0635\u064A\u0627\u0646\u0629",
  completed: "\u0645\u0643\u062A\u0645\u0644",
};

function formatCurrency(value: number): string {
  return `${value.toLocaleString("en-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} \u062C.\u0645`;
}

function formatDateRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "\u0627\u0644\u0622\u0646";
  if (diffMins < 60) return `\u0645\u0646\u0630 ${diffMins} \u062F\u0642\u064A\u0642\u0629`;
  if (diffHours === 1) return "\u0645\u0646\u0630 \u0633\u0627\u0639\u0629";
  if (diffHours < 24) return `\u0645\u0646\u0630 ${diffHours} \u0633\u0627\u0639\u0629`;
  if (diffDays === 1) return "\u0645\u0646\u0630 \u064A\u0648\u0645";
  if (diffDays < 7) return `\u0645\u0646\u0630 ${diffDays} \u0623\u064A\u0627\u0645`;
  return date.toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
}

function describeActivity(action: string, userName: string | null): string {
  const name = userName ?? "\u0627\u0644\u0646\u0638\u0627\u0645";
  const map: Record<string, string> = {
    "ticket.create": `\u0642\u0627\u0645 ${name} \u0628\u0625\u0646\u0634\u0627\u0621 \u062A\u0630\u0643\u0631\u0629 \u062C\u062F\u064A\u062F\u0629`,
    "ticket.assign_technician": `\u0642\u0627\u0645 ${name} \u0628\u062A\u0639\u064A\u064A\u0646 \u0641\u0646\u064A \u0644\u0644\u062A\u0630\u0643\u0631\u0629`,
    "ticket.status_change": `\u0642\u0627\u0645 ${name} \u0628\u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u0627\u0644\u062A\u0630\u0643\u0631\u0629`,
    "ticket.part_add.inventory": `\u0642\u0627\u0645 ${name} \u0628\u6251\u0636\u0627\u0641\u0629 \u0642\u0637\u0639\u0629 \u0645\u0646 \u0627\u0644\u0645\u062E\u0632\u0646`,
    "ticket.part_add.external": `\u0642\u0627\u0645 ${name} \u0628\u6251\u0636\u0627\u0641\u0629 \u0642\u0637\u0639\u0629 \u062E\u0627\u0631\u062C\u064A\u0629`,
    "invoice.generate": `\u0642\u0627\u0645 ${name} \u0628\u0625\u0646\u0634\u0627\u0621 \u0641\u0627\u062A\u0648\u0631\u0629`,
    "payment.record": `\u0642\u0627\u0645 ${name} \u0628\u062A\u0633\u062C\u064A\u0644 \u062F\u0641\u0639\u0629`,
    "inventory.item.create": `\u0642\u0627\u0645 ${name} \u0628\u6251\u0636\u0627\u0641\u0629 \u0635\u0646\u0641 \u062C\u062F\u064A\u062F`,
    "inventory.stock.update": `\u0642\u0627\u0645 ${name} \u0628\u062A\u062D\u062F\u064A\u062B \u0643\u0645\u064A\u0629 \u0627\u0644\u0645\u062E\u0632\u0646`,
    "cash_drawer.open": `\u0642\u0627\u0645 ${name} \u0628\u0641\u062A\u062D \u0627\u0644\u062F\u0631\u062C`,
    "cash_drawer.close": `\u0642\u0627\u0645 ${name} \u0628\u6251\u063A\u0644\u0627\u0642 \u0627\u0644\u062F\u0631\u062C`,
  };
  return map[action] ?? `${name} ${action.replace(/_/g, " ")}`;
}

function EntityBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    ticket: "bg-blue-100 text-blue-700",
    invoice: "bg-indigo-100 text-indigo-700",
    payment: "bg-green-100 text-green-700",
    inventory_item: "bg-purple-100 text-purple-700",
    ticket_parts_used: "bg-amber-100 text-amber-700",
    ticket_external_parts: "bg-amber-100 text-amber-700",
    cash_drawer_session: "bg-teal-100 text-teal-700",
    audit: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
        styles[type] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {type.replace(/_/g, " ")}
    </span>
  );
}

function StatusProgressBar({
  status,
  count,
  total,
}: {
  status: string;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;

  const colors: Record<string, string> = {
    intake: "bg-blue-500",
    diagnosis: "bg-amber-500",
    quote_approval: "bg-orange-500",
    in_progress: "bg-indigo-500",
    completed: "bg-green-500",
  };

  return (
    <div className="flex items-center gap-3">
      <span className="w-10 text-left text-sm font-medium text-gray-900">
        {count}
      </span>
      <div className="flex-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full transition-all ${colors[status] ?? "bg-gray-400"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className="w-28 text-left text-sm text-gray-700">
        {STATUS_AR[status] ?? status.replace(/_/g, " ")}
      </span>
    </div>
  );
}

export default async function DashboardPage({
  params: { tenant_slug },
}: {
  params: { tenant_slug: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.tenantSlug !== tenant_slug) redirect(`/${session.user.tenantSlug}`);

  const stats = await getDashboardStatsAction();
  const activeTotal = stats.statusBreakdown.reduce((s, r) => s + r.count, 0);

  return (
    <div dir="rtl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">\u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645</h1>
        <p className="mt-1 text-sm text-gray-500">
          \u0646\u0638\u0631\u0629 \u0639\u0627\u0645\u0629 \u0639\u0644\u0649 \u0627\u0644\u0641\u0631\u0639
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">
              \u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A
            </p>
            <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {formatCurrency(stats.totalRevenue)}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">
              \u0635\u0627\u0641\u064A \u0627\u0644\u0623\u0631\u0628\u0627\u062D
            </p>
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  stats.profitMargin >= 20
                    ? "bg-green-100 text-green-700"
                    : stats.profitMargin >= 10
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                }`}
              >
                {stats.profitMargin.toFixed(1)}%
              </span>
              <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {stats.netProfit >= 0 ? formatCurrency(stats.netProfit) : `-${formatCurrency(Math.abs(stats.netProfit))}`}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0645\u0637\u0631\u0648\u062D \u062A\u0643\u0627\u0644\u064A\u0641 \u0642\u0637\u0639 \u0627\u0644\u063A\u064A\u0627\u0631
          </p>
        </div>

        <Link
          href={`/${tenant_slug}/tickets`}
          className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">
              \u0627\u0644\u062A\u064A\u0643\u062A\u0627\u062A \u0627\u0644\u0646\u0634\u0637\u0629
            </p>
            <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75" />
            </svg>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{stats.activeTickets}</p>
          <p className="mt-0.5 text-xs text-indigo-600">
            \u0639\u0631\u0636 \u0627\u0644\u0643\u0644 \u2190
          </p>
        </Link>

        <Link
          href={
            stats.lowStockCount > 0
              ? `/${tenant_slug}/inventory?lowStock=true`
              : `/${tenant_slug}/inventory`
          }
          className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-amber-200 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">
              \u0646\u0648\u0627\u0642\u0635 \u0627\u0644\u0645\u062E\u0632\u0646
            </p>
            {stats.lowStockCount > 0 && (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {stats.lowStockCount > 9 ? "9+" : stats.lowStockCount}
              </span>
            )}
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {stats.lowStockCount}
          </p>
          <p className="mt-0.5 text-xs text-amber-600">
            {stats.lowStockCount > 0
              ? "\u064A\u062D\u062A\u0627\u062C \u0627\u0647\u062A\u0645\u0627\u0645\u064B\u0627 \u2190"
              : "\u062C\u0645\u064A\u0639 \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0645\u062A\u0648\u0641\u0631\u0629"}
          </p>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm lg:col-span-3">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">
            \u062A\u0648\u0632\u064A\u0639 \u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0635\u064A\u0627\u0646\u0629
          </h2>
          {stats.statusBreakdown.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              \u0644\u0627 \u062A\u0648\u062C\u062F \u062A\u064A\u0643\u062A\u0627\u062A \u0646\u0634\u0637\u0629
            </p>
          ) : (
            <div className="space-y-3">
              {stats.statusBreakdown.map((s) => (
                <StatusProgressBar
                  key={s.status}
                  status={s.status}
                  count={s.count}
                  total={activeTotal}
                />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">
            \u0622\u062E\u0631 \u0627\u0644\u0646\u0634\u0627\u0637\u0627\u062A \u0641\u064A \u0627\u0644\u0645\u062D\u0644
          </h2>
          {stats.recentActivity.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              \u0644\u0627 \u062A\u0648\u062C\u062F \u0646\u0634\u0627\u0637\u0627\u062A \u0623\u062E\u064A\u0631\u0629
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {stats.recentActivity.map((a) => (
                <div key={a.id} className="flex items-start gap-3 py-3">
                  <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-900">
                        {describeActivity(a.action, a.userName)}
                      </p>
                      <EntityBadge type={a.entityType} />
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {formatDateRelative(a.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
