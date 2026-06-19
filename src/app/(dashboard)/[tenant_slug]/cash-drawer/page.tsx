import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, schema } from "@/drizzle/client";
import { eq, and, desc, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { OpenDrawerForm, CloseDrawerForm } from "./drawer-actions";

function formatCurrency(value: string | number | null | undefined): string {
  if (value == null) return "—";
  return `${Number(value).toLocaleString("en-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ج.م`;
}

function formatDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "الآن";
  if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  if (diffDays < 7) return `منذ ${diffDays} يوم`;

  return date.toLocaleDateString("en-EG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface PageProps {
  params: { tenant_slug: string };
}

export default async function CashDrawerPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { tenantId, branchId, tenantSlug, roleName } = session.user;
  if (tenantSlug !== params.tenant_slug) redirect(`/${tenantSlug}/cash-drawer`);

  if (!["owner", "manager", "cashier"].includes(roleName)) {
    redirect(`/${tenantSlug}?error=unauthorized`);
  }

  const activeSession = await db.query.cashDrawerSessions.findFirst({
    where: and(
      eq(schema.cashDrawerSessions.tenantId, tenantId),
      eq(schema.cashDrawerSessions.branchId, branchId),
      eq(schema.cashDrawerSessions.status, "open"),
    ),
    with: {
      cashier: {
        columns: { fullName: true },
      },
    },
  });

  if (activeSession) {
    const transactions = await db
      .select({
        id: schema.cashDrawerTransactions.id,
        transactionType: schema.cashDrawerTransactions.transactionType,
        amount: schema.cashDrawerTransactions.amount,
        runningBalance: schema.cashDrawerTransactions.runningBalance,
        notes: schema.cashDrawerTransactions.notes,
        createdAt: schema.cashDrawerTransactions.createdAt,
        invoiceNumber: schema.invoices.invoiceNumber,
      })
      .from(schema.cashDrawerTransactions)
      .leftJoin(
        schema.invoices,
        eq(schema.cashDrawerTransactions.invoiceId, schema.invoices.id),
      )
      .where(
        eq(schema.cashDrawerTransactions.sessionId, activeSession.id),
      )
      .orderBy(desc(schema.cashDrawerTransactions.createdAt));

    const [txnResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${schema.cashDrawerTransactions.amount}), '0')`,
      })
      .from(schema.cashDrawerTransactions)
      .where(eq(schema.cashDrawerTransactions.sessionId, activeSession.id));

    const txnSum = Number(txnResult?.total ?? 0);
    const runningTotal = Number(activeSession.initialFloat) + txnSum;

    const txnTypeAr: Record<string, string> = {
      payment: "دفع",
      refund: "استرداد",
      payout: "سحب",
    };

    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">خزنة الوردية</h1>
          <p className="mt-1 text-sm text-gray-500">
            إدارة فتح الورديات، تتبع المدفوعات، ومطابقة الخزنة.
          </p>
        </div>

        <div className="mb-6">
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                <h2 className="text-sm font-semibold text-gray-900">
                  الوردية مفتوحة
                </h2>
              </div>
              <span className="text-xs text-gray-500">
                فُتحت {formatDate(activeSession.openedAt)}
              </span>
            </div>

            <div className="px-5 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-gray-50 px-4 py-3 text-center">
                  <p className="text-xs font-medium text-gray-500">الرصيد الافتتاحي</p>
                  <p className="mt-0.5 text-lg font-bold text-gray-900">
                    {formatCurrency(activeSession.initialFloat)}
                  </p>
                </div>
                <div className="rounded-lg bg-indigo-50 px-4 py-3 text-center">
                  <p className="text-xs font-medium text-indigo-600">المتحصل</p>
                  <p className="mt-0.5 text-lg font-bold text-indigo-900">
                    {formatCurrency(txnSum)}
                  </p>
                </div>
                <div className="rounded-lg bg-green-50 px-4 py-3 text-center">
                  <p className="text-xs font-medium text-green-600">الإجمالي الجاري</p>
                  <p className="mt-0.5 text-lg font-bold text-green-900">
                    {formatCurrency(runningTotal)}
                  </p>
                </div>
              </div>
            </div>

            {transactions.length > 0 && (
              <div className="border-t border-gray-200">
                <div className="px-5 py-3">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    آخر المعاملات ({transactions.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-5 py-2 text-right font-medium text-gray-500">
                          الوقت
                        </th>
                        <th className="px-5 py-2 text-right font-medium text-gray-500">
                          النوع
                        </th>
                        <th className="px-5 py-2 text-right font-medium text-gray-500">
                          الفاتورة
                        </th>
                        <th className="px-5 py-2 text-left font-medium text-gray-500">
                          المبلغ
                        </th>
                        <th className="px-5 py-2 text-left font-medium text-gray-500">
                          الرصيد
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr className="bg-gray-50 font-medium text-gray-700">
                        <td className="whitespace-nowrap px-5 py-2" colSpan={4}>
                          الرصيد الافتتاحي
                        </td>
                        <td className="whitespace-nowrap px-5 py-2 text-left">
                          {formatCurrency(activeSession.initialFloat)}
                        </td>
                      </tr>
                      {transactions.map((txn) => (
                        <tr key={txn.id} className="hover:bg-gray-50">
                          <td className="whitespace-nowrap px-5 py-2 text-gray-500">
                            {formatDate(txn.createdAt)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-2">
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                              {txnTypeAr[txn.transactionType] ?? txn.transactionType.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-2 text-gray-600">
                            {txn.invoiceNumber ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-5 py-2 text-left font-medium text-green-700">
                            +{formatCurrency(txn.amount)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-2 text-left font-medium text-gray-900">
                            {formatCurrency(txn.runningBalance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {transactions.length === 0 && (
              <div className="border-t border-gray-200 px-5 py-6 text-center text-sm text-gray-500">
                لا توجد معاملات بعد. ستظهر المدفوعات تلقائياً عند تحصيل الفواتير.
              </div>
            )}

            <div className="border-t border-gray-200 px-5 py-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">
                إغلاق الوردية
              </p>
              <CloseDrawerForm expectedTotal={runningTotal} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const lastSession = await db.query.cashDrawerSessions.findFirst({
    where: and(
      eq(schema.cashDrawerSessions.tenantId, tenantId),
      eq(schema.cashDrawerSessions.branchId, branchId),
    ),
    orderBy: (sessions, { desc }) => [desc(sessions.createdAt)],
    columns: {
      closedAt: true,
      actualTotal: true,
      expectedTotal: true,
      variance: true,
    },
  });

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold text-gray-900">خزنة الوردية</h1>
        <p className="mt-1 text-sm text-gray-500">
          لا توجد وردية نشطة. افتح وردية جديدة لبدء استقبال المدفوعات.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">الوردية مغلقة</h2>
          </div>
        </div>
        <div className="px-5 py-5">
          <h3 className="text-sm font-medium text-gray-900">فتح وردية جديدة</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            أدخل المبلغ النقدي الافتتاحي في الخزنة.
          </p>
          <div className="mt-4">
            <OpenDrawerForm />
          </div>
        </div>
      </div>

      {lastSession && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-5 py-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500">
            آخر وردية
          </h3>
          <div className="mt-2 grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <p className="text-xs text-gray-500">المتوقع</p>
              <p className="font-medium text-gray-900">
                {formatCurrency(lastSession.expectedTotal)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">المعدود</p>
              <p className="font-medium text-gray-900">
                {formatCurrency(lastSession.actualTotal)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">العجز / الزيادة</p>
              <p
                className={`font-medium ${
                  lastSession.variance && Number(lastSession.variance) >= 0
                    ? "text-green-700"
                    : "text-red-700"
                }`}
              >
                {lastSession.variance
                  ? `${Number(lastSession.variance) >= 0 ? "+" : ""}${formatCurrency(lastSession.variance)}`
                  : "—"}
              </p>
            </div>
          </div>
          {lastSession.closedAt && (
            <p className="mt-2 text-center text-xs text-gray-400">
              أغلقت {formatDate(lastSession.closedAt)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
