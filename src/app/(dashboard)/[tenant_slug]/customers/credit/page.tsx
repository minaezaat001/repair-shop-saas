"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import {
  getCustomersWithCreditAction,
  getCustomerCreditLedgerAction,
  collectCustomerDebtAction,
} from "@/app/actions/credit";

interface CustomerCredit {
  id: string;
  fullName: string;
  phone: string;
  creditBalance: string;
  creditLimit: string;
}

interface CreditLedgerEntry {
  id: string;
  type: "sale_credit" | "debt_collection";
  amount: string;
  runningBalance: string;
  description: string | null;
  referenceInvoiceId: string | null;
  createdAt: Date;
}

function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? Number(value) : value;
  return `${num.toLocaleString("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
}

const TYPE_AR: Record<string, string> = {
  sale_credit: "مبيعات آجل",
  debt_collection: "تحصيل دين",
};

export default function CustomerCreditPage() {
  const [customers, setCustomers] = useState<CustomerCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerCredit | null>(null);
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [collectAmount, setCollectAmount] = useState(0);
  const [collectMethod, setCollectMethod] = useState("cash");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    const result = await getCustomersWithCreditAction();
    if (result.success) {
      setCustomers(result.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const totalCredit = customers.reduce(
    (sum, c) => sum + Number(c.creditBalance),
    0,
  );

  async function handleViewLedger(customer: CustomerCredit) {
    setSelectedCustomer(customer);
    setLedgerLoading(true);
    const result = await getCustomerCreditLedgerAction(customer.id);
    if (result.success) {
      setLedger(result.data ?? []);
    }
    setLedgerLoading(false);
  }

  async function handleCollectDebt() {
    if (!selectedCustomer || collectAmount <= 0) return;
    setError(null);
    startTransition(async () => {
      const result = await collectCustomerDebtAction(
        selectedCustomer.id,
        collectAmount,
        collectMethod,
      );
      if (result.success) {
        setShowCollectModal(false);
        setCollectAmount(0);
        setCollectMethod("cash");
        await loadCustomers();
        if (selectedCustomer) {
          const updated = customers.find((c) => c.id === selectedCustomer.id);
          if (updated) {
            await handleViewLedger(updated);
          }
        }
      } else {
        setError(result.error ?? "فشل تحصيل الدين");
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="h-8 w-8 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">ديون العملاء والتحصيل</h1>
        <p className="text-sm text-gray-500 mt-1">إدارة الديون المستحقة طرف العملاء</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-amber-700">إجمالي الديون المستحقة</p>
              <p className="text-xl font-bold text-amber-900">{formatCurrency(totalCredit)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-blue-700">عدد العملاء المدينين</p>
              <p className="text-xl font-bold text-blue-900">{customers.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">متوسط الدين</p>
              <p className="text-xl font-bold text-gray-900">
                {customers.length > 0
                  ? formatCurrency(totalCredit / customers.length)
                  : formatCurrency(0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-right font-medium text-gray-500">العميل</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">الهاتف</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">الرصيد المستحق</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">الحد الائتماني</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                    لا يوجد عملاء بديون مستحقة
                  </td>
                </tr>
              ) : (
                customers.map((customer) => {
                  const balance = Number(customer.creditBalance);
                  const limit = Number(customer.creditLimit);
                  const usage = limit > 0 ? (balance / limit) * 100 : 0;

                  return (
                    <tr key={customer.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{customer.fullName}</td>
                      <td className="px-4 py-3 text-gray-600">{customer.phone}</td>
                      <td className={`px-4 py-3 text-left font-bold ${balance > 0 ? "text-amber-600" : "text-gray-900"}`}>
                        {formatCurrency(customer.creditBalance)}
                        {limit > 0 && (
                          <div className="mt-1 h-1.5 w-full max-w-[100px] rounded-full bg-gray-200 mr-auto">
                            <div
                              className={`h-1.5 rounded-full ${
                                usage > 80 ? "bg-red-500" : usage > 50 ? "bg-amber-500" : "bg-emerald-500"
                              }`}
                              style={{ width: `${Math.min(usage, 100)}%` }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-left text-gray-600">
                        {limit > 0 ? formatCurrency(customer.creditLimit) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewLedger(customer)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            كشف حساب
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setError(null);
                              setCollectAmount(0);
                              setCollectMethod("cash");
                              setShowCollectModal(true);
                            }}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-colors"
                          >
                            تحصيل
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Customer Detail Slide-over ────────────────────────────────── */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/30" onClick={() => setSelectedCustomer(null)} />
          <div className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selectedCustomer.fullName}</h2>
                <p className="text-xs text-gray-500">{selectedCustomer.phone}</p>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs text-amber-700">الرصيد المستحق</p>
                  <p className="text-2xl font-bold text-amber-900">{formatCurrency(selectedCustomer.creditBalance)}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-xs text-gray-500">الحد الائتماني</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(selectedCustomer.creditLimit)}</p>
                </div>
              </div>

              {Number(selectedCustomer.creditBalance) > 0 && (
                <button
                  onClick={() => {
                    setError(null);
                    setCollectAmount(0);
                    setCollectMethod("cash");
                    setShowCollectModal(true);
                  }}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500 transition-colors"
                >
                  تحصيل الدين
                </button>
              )}

              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">كشف حساب الائتمان</h3>
                {ledgerLoading ? (
                  <div className="flex justify-center py-8">
                    <svg className="h-6 w-6 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                ) : ledger.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">لا توجد حركات</p>
                ) : (
                  <div className="space-y-2">
                    {ledger.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-lg border border-gray-100 p-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {TYPE_AR[entry.type] ?? entry.type}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {entry.description ?? ""}
                          </p>
                          <p className="text-[10px] text-gray-300 mt-0.5">
                            {new Date(entry.createdAt).toLocaleDateString("ar-EG", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className="text-left">
                          <p className={`text-sm font-bold ${entry.type === "debt_collection" ? "text-emerald-600" : "text-red-600"}`}>
                            {entry.type === "debt_collection" ? "-" : "+"}
                            {formatCurrency(entry.amount)}
                          </p>
                          <p className="text-[10px] text-gray-400">{formatCurrency(entry.runningBalance)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Collect Debt Modal ────────────────────────────────────────── */}
      {showCollectModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setShowCollectModal(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-1">تحصيل دين</h2>
            <p className="text-sm text-gray-500 mb-4">{selectedCustomer.fullName}</p>
            <div className="space-y-4">
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="text-xs text-amber-700">الرصيد المستحق</p>
                <p className="text-lg font-bold text-amber-900">{formatCurrency(selectedCustomer.creditBalance)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">المبلغ المحصل</label>
                <input
                  type="number"
                  min={0}
                  max={Number(selectedCustomer.creditBalance)}
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(Math.max(0, Number(e.target.value)))}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">طريقة الدفع</label>
                <div className="flex gap-2">
                  {[
                    { key: "cash", label: "نقداً" },
                    { key: "card", label: "بطاقة" },
                    { key: "wallet", label: "محفظة" },
                  ].map((pm) => (
                    <button
                      key={pm.key}
                      onClick={() => setCollectMethod(pm.key)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        collectMethod === pm.key
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCollectModal(false)}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleCollectDebt}
                  disabled={isPending || collectAmount <= 0}
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                >
                  {isPending ? "جاري..." : "تأكيد التحصيل"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
