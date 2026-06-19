"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import {
  createSupplierAction,
  getSuppliersAction,
  getSupplierLedgerAction,
  paySupplierAction,
  recordSupplierPurchaseAction,
} from "@/app/actions/credit";
import { searchInventoryItemsAction } from "@/app/actions/inventory";

interface Supplier {
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

interface LedgerEntry {
  id: string;
  type: "purchase_credit" | "cash_payment";
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
  purchase_credit: "مشتريات آجل",
  cash_payment: "دفعة نقدية",
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Add supplier form
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newTax, setNewTax] = useState("");

  // Pay supplier form
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("cash");

  // Purchase form
  const [purchaseInvoiceNo, setPurchaseInvoiceNo] = useState("");
  const [purchaseItems, setPurchaseItems] = useState<
    { itemId: string; name: string; qty: number; costPrice: number }[]
  >([]);
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [purchaseResults, setPurchaseResults] = useState<
    { id: string; name: string; sku: string; costPrice: string }[]
  >([]);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    const result = await getSuppliersAction();
    if (result.success) {
      setSuppliers(result.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const filtered = suppliers.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.companyName.toLowerCase().includes(q) ||
      s.phone?.includes(q) ||
      s.supplierCode.toLowerCase().includes(q)
    );
  });

  const totalDebt = suppliers.reduce(
    (sum, s) => sum + Math.abs(Math.min(Number(s.accountBalance), 0)),
    0,
  );

  async function handleViewLedger(supplier: Supplier) {
    setSelectedSupplier(supplier);
    setLedgerLoading(true);
    const result = await getSupplierLedgerAction(supplier.id);
    if (result.success) {
      setLedger(result.data ?? []);
    }
    setLedgerLoading(false);
  }

  async function handleAddSupplier() {
    if (!newName.trim()) {
      setError("اسم المورد مطلوب");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createSupplierAction({
        name: newName.trim(),
        phone: newPhone.trim(),
        companyName: newCompany.trim() || undefined,
        taxNumber: newTax.trim() || undefined,
      });
      if (result.success) {
        setShowAddModal(false);
        setNewName("");
        setNewPhone("");
        setNewCompany("");
        setNewTax("");
        await loadSuppliers();
      } else {
        setError(result.error ?? "فشل الإضافة");
      }
    });
  }

  async function handlePaySupplier() {
    if (!selectedSupplier || payAmount <= 0) return;
    setError(null);
    startTransition(async () => {
      const result = await paySupplierAction(
        selectedSupplier.id,
        payAmount,
        payMethod,
      );
      if (result.success) {
        setShowPayModal(false);
        setPayAmount(0);
        setPayMethod("cash");
        await loadSuppliers();
        if (selectedSupplier) {
          await handleViewLedger(
            suppliers.find((s) => s.id === selectedSupplier.id) ?? selectedSupplier,
          );
        }
      } else {
        setError(result.error ?? "فشل الدفع");
      }
    });
  }

  async function handlePurchaseSearch(val: string) {
    setPurchaseSearch(val);
    if (!val.trim()) {
      setPurchaseResults([]);
      return;
    }
    const result = await searchInventoryItemsAction(val.trim());
    if (result.success) {
      setPurchaseResults(
        (result.data ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          sku: r.sku,
          costPrice: r.costPrice,
        })),
      );
    }
  }

  function addPurchaseItem(item: { id: string; name: string; costPrice: string }) {
    setPurchaseItems((prev) => {
      const existing = prev.find((p) => p.itemId === item.id);
      if (existing) {
        return prev.map((p) =>
          p.itemId === item.id ? { ...p, qty: p.qty + 1 } : p,
        );
      }
      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          qty: 1,
          costPrice: Number(item.costPrice),
        },
      ];
    });
    setPurchaseSearch("");
    setPurchaseResults([]);
  }

  function removePurchaseItem(itemId: string) {
    setPurchaseItems((prev) => prev.filter((p) => p.itemId !== itemId));
  }

  async function handleRecordPurchase() {
    if (!selectedSupplier) return;
    if (!purchaseInvoiceNo.trim()) {
      setError("رقم فاتورة المشتريات مطلوب");
      return;
    }
    if (!purchaseItems.length) {
      setError("لم يتم إضافة أي أصناف");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await recordSupplierPurchaseAction(
        selectedSupplier.id,
        purchaseItems.map((p) => ({
          itemId: p.itemId,
          qty: p.qty,
          costPrice: p.costPrice,
        })),
        purchaseInvoiceNo.trim(),
      );
      if (result.success) {
        setShowPurchaseModal(false);
        setPurchaseInvoiceNo("");
        setPurchaseItems([]);
        await loadSuppliers();
        if (selectedSupplier) {
          await handleViewLedger(
            suppliers.find((s) => s.id === selectedSupplier.id) ?? selectedSupplier,
          );
        }
      } else {
        setError(result.error ?? "فشل تسجيل المشتريات");
      }
    });
  }

  const purchaseTotal = purchaseItems.reduce(
    (sum, p) => sum + p.qty * p.costPrice,
    0,
  );

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">الموردين وحسابات الشراء</h1>
          <p className="text-sm text-gray-500 mt-1">إدارة الموردين وديون المشتريات</p>
        </div>
        <button
          onClick={() => {
            setError(null);
            setShowAddModal(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          إضافة مورد
        </button>
      </div>

      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-red-700">إجمالي المديونيات المستحقة للموردين</p>
            <p className="text-xl font-bold text-red-900">{formatCurrency(totalDebt)}</p>
          </div>
        </div>
      </div>

      <div className="relative">
        <svg
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث عن مورد بالاسم أو الهاتف أو الكود..."
          className="block w-full rounded-xl border border-gray-300 py-2.5 pr-10 pl-3 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-right font-medium text-gray-500">الكود</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">الاسم</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">الشركة</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">الهاتف</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">الرصيد</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                    لا يوجد موردين
                  </td>
                </tr>
              ) : (
                filtered.map((supplier) => {
                  const balance = Number(supplier.accountBalance);
                  return (
                    <tr key={supplier.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">{supplier.supplierCode}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {supplier.name ?? supplier.contactPerson ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{supplier.companyName}</td>
                      <td className="px-4 py-3 text-gray-600">{supplier.phone ?? "—"}</td>
                      <td className={`px-4 py-3 text-left font-bold ${balance < 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {formatCurrency(supplier.accountBalance)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewLedger(supplier)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            كشف حساب
                          </button>
                          {balance < 0 && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedSupplier(supplier);
                                  setError(null);
                                  setPayAmount(0);
                                  setPayMethod("cash");
                                  setShowPayModal(true);
                                }}
                                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-colors"
                              >
                                دفع
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedSupplier(supplier);
                                  setError(null);
                                  setPurchaseInvoiceNo("");
                                  setPurchaseItems([]);
                                  setShowPurchaseModal(true);
                                }}
                                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-50 transition-colors"
                              >
                                مشتريات
                              </button>
                            </>
                          )}
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

      {/* ─── Supplier Detail Slide-over ─────────────────────────────────── */}
      {selectedSupplier && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/30" onClick={() => setSelectedSupplier(null)} />
          <div className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {selectedSupplier.name ?? selectedSupplier.companyName}
                </h2>
                <p className="text-xs text-gray-500">{selectedSupplier.supplierCode}</p>
              </div>
              <button onClick={() => setSelectedSupplier(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-gray-500">الهاتف</span>
                  <p className="font-medium text-gray-900">{selectedSupplier.phone ?? "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">الرقم الضريبي</span>
                  <p className="font-medium text-gray-900">{selectedSupplier.taxNumber ?? "—"}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-gray-500">الشركة</span>
                  <p className="font-medium text-gray-900">{selectedSupplier.companyName}</p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500">الرصيد الحالي</p>
                <p className={`text-2xl font-bold mt-1 ${Number(selectedSupplier.accountBalance) < 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {formatCurrency(selectedSupplier.accountBalance)}
                </p>
              </div>

              <div className="flex gap-2">
                {Number(selectedSupplier.accountBalance) < 0 && (
                  <>
                    <button
                      onClick={() => {
                        setError(null);
                        setPayAmount(0);
                        setPayMethod("cash");
                        setShowPayModal(true);
                      }}
                      className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
                    >
                      دفع للمورد
                    </button>
                    <button
                      onClick={() => {
                        setError(null);
                        setPurchaseInvoiceNo("");
                        setPurchaseItems([]);
                        setShowPurchaseModal(true);
                      }}
                      className="flex-1 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 transition-colors"
                    >
                      تسجيل مشتريات
                    </button>
                  </>
                )}
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">كشف الحساب</h3>
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
                          <p className={`text-sm font-bold ${entry.type === "cash_payment" ? "text-emerald-600" : "text-red-600"}`}>
                            {entry.type === "cash_payment" ? "+" : "-"}
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

      {/* ─── Add Supplier Modal ────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setShowAddModal(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">إضافة مورد جديد</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">الاسم <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="اسم المورد"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">الهاتف</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="رقم الهاتف"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">الشركة</label>
                <input
                  type="text"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="اسم الشركة (اختياري)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">الرقم الضريبي</label>
                <input
                  type="text"
                  value={newTax}
                  onChange={(e) => setNewTax(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="الرقم الضريبي (اختياري)"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleAddSupplier}
                  disabled={isPending}
                  className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                >
                  {isPending ? "جاري..." : "إضافة"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Pay Supplier Modal ────────────────────────────────────────── */}
      {showPayModal && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setShowPayModal(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-1">دفع للمورد</h2>
            <p className="text-sm text-gray-500 mb-4">{selectedSupplier.name ?? selectedSupplier.companyName}</p>
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">المديونية الحالية</p>
                <p className="text-lg font-bold text-red-600">{formatCurrency(selectedSupplier.accountBalance)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">المبلغ</label>
                <input
                  type="number"
                  min={0}
                  value={payAmount}
                  onChange={(e) => setPayAmount(Math.max(0, Number(e.target.value)))}
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
                      onClick={() => setPayMethod(pm.key)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        payMethod === pm.key
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
                  onClick={() => setShowPayModal(false)}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={handlePaySupplier}
                  disabled={isPending || payAmount <= 0}
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                >
                  {isPending ? "جاري..." : "تأكيد الدفع"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Purchase Modal ────────────────────────────────────────────── */}
      {showPurchaseModal && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setShowPurchaseModal(false)} />
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-1">تسجيل مشتريات من مورد</h2>
            <p className="text-sm text-gray-500 mb-4">{selectedSupplier.name ?? selectedSupplier.companyName}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">رقم فاتورة المشتريات <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={purchaseInvoiceNo}
                  onChange={(e) => setPurchaseInvoiceNo(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="رقم فاتورة المورد"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">إضافة أصناف</label>
                <div className="relative">
                  <svg
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                    fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                  <input
                    type="text"
                    value={purchaseSearch}
                    onChange={(e) => handlePurchaseSearch(e.target.value)}
                    placeholder="ابحث عن صنف..."
                    className="block w-full rounded-lg border border-gray-300 py-2.5 pr-10 pl-3 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                {purchaseResults.length > 0 && (
                  <div className="mt-2 rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-40 overflow-y-auto">
                    {purchaseResults.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => addPurchaseItem(r)}
                        className="w-full px-3 py-2 text-right text-sm hover:bg-gray-50 flex items-center justify-between"
                      >
                        <span className="font-medium text-gray-900">{r.name}</span>
                        <span className="text-xs text-gray-400">{r.sku} | {formatCurrency(r.costPrice)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {purchaseItems.length > 0 && (
                <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {purchaseItems.map((item) => (
                    <div key={item.itemId} className="flex items-center gap-3 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={(e) =>
                          setPurchaseItems((prev) =>
                            prev.map((p) =>
                              p.itemId === item.itemId
                                ? { ...p, qty: Math.max(1, Number(e.target.value)) }
                                : p,
                            ),
                          )
                        }
                        className="w-16 rounded border border-gray-300 px-2 py-1 text-center text-sm"
                      />
                      <input
                        type="number"
                        min={0}
                        value={item.costPrice}
                        onChange={(e) =>
                          setPurchaseItems((prev) =>
                            prev.map((p) =>
                              p.itemId === item.itemId
                                ? { ...p, costPrice: Math.max(0, Number(e.target.value)) }
                                : p,
                            ),
                          )
                        }
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-left text-sm"
                      />
                      <span className="text-sm font-medium text-gray-900 w-24 text-left">
                        {formatCurrency(item.qty * item.costPrice)}
                      </span>
                      <button
                        onClick={() => removePurchaseItem(item.itemId)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                    <span className="text-sm font-bold text-gray-900">الإجمالي</span>
                    <span className="text-sm font-bold text-red-600">{formatCurrency(purchaseTotal)}</span>
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowPurchaseModal(false)}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleRecordPurchase}
                  disabled={isPending || !purchaseInvoiceNo.trim() || purchaseItems.length === 0}
                  className="flex-1 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
                >
                  {isPending ? "جاري..." : "تسجيل المشتريات"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
