"use client";

import { useState, useRef, useEffect, useTransition, useCallback } from "react";
import { createRetailSaleAction } from "@/app/actions/pos";
import { searchInventoryItemsAction } from "@/app/actions/inventory";

interface SearchResultItem {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  costPrice: string;
  sellingPrice: string;
  qtyOnHand: number;
  exactMatch: boolean;
}

interface CartEntry {
  itemId: string;
  sku: string;
  name: string;
  quantity: number;
  sellingPrice: number;
  availableStock: number;
}

interface ReceiptData {
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  items: { name: string; qty: number; price: number; total: number }[];
  paymentMethod: string;
  createdAt: string;
  cashierName: string;
  tenantName: string;
}

const PAYMENT_METHODS: { key: "cash" | "card" | "wallet"; label: string }[] = [
  { key: "cash", label: "نقداً" },
  { key: "card", label: "بطاقة" },
  { key: "wallet", label: "محفظة إلكترونية" },
];

export default function POSPage() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, startSearchTransition] = useTransition();
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "wallet">("cash");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.sellingPrice, 0);
  const discountClamped = Math.min(Math.max(discount, 0), subtotal);
  const total = subtotal - discountClamped;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (!value.trim()) {
        setSearchResults([]);
        return;
      }
      startSearchTransition(async () => {
        const result = await searchInventoryItemsAction(value.trim());
        if (result.success && result.data) {
          setSearchResults(result.data);
          const exact = result.data.find((r) => r.exactMatch && r.id);
          if (exact && exact.qtyOnHand > 0) {
            setCart((prev) => {
              const existing = prev.find((c) => c.itemId === exact.id);
              if (existing) {
                return prev.map((c) =>
                  c.itemId === exact.id
                    ? { ...c, quantity: c.quantity + 1 }
                    : c,
                );
              }
              return [
                ...prev,
                {
                  itemId: exact.id,
                  sku: exact.sku,
                  name: exact.name,
                  quantity: 1,
                  sellingPrice: Number(exact.sellingPrice),
                  availableStock: exact.qtyOnHand,
                },
              ];
            });
            setSearchQuery("");
            setSearchResults([]);
            searchRef.current?.focus();
          }
        }
      });
    },
    [],
  );

  function handleManualAdd(result: SearchResultItem) {
    if (result.qtyOnHand <= 0) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === result.id);
      if (existing) {
        return prev.map((c) =>
          c.itemId === result.id
            ? { ...c, quantity: c.quantity + 1 }
            : c,
        );
      }
      return [
        ...prev,
        {
          itemId: result.id,
          sku: result.sku,
          name: result.name,
          quantity: 1,
          sellingPrice: Number(result.sellingPrice),
          availableStock: result.qtyOnHand,
        },
      ];
    });
    setSearchQuery("");
    setSearchResults([]);
    searchRef.current?.focus();
  }

  function handleQuantityChange(itemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.itemId !== itemId) return c;
          const newQty = c.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > c.availableStock) return c;
          return { ...c, quantity: newQty };
        })
        .filter(Boolean) as CartEntry[],
    );
  }

  function handleRemove(itemId: string) {
    setCart((prev) => prev.filter((c) => c.itemId !== itemId));
  }

  async function handleCheckout() {
    if (cart.length === 0) {
      setError("لم يتم إضافة أي أصناف");
      return;
    }
    if (total <= 0) {
      setError("الإجمالي يجب أن يكون أكبر من صفر");
      return;
    }

    setError(null);
    startSubmitTransition(async () => {
      const result = await createRetailSaleAction(
        cart.map((c) => ({
          itemId: c.itemId,
          quantity: c.quantity,
          sellingPrice: c.sellingPrice,
        })),
        paymentMethod,
        discountClamped,
      );

      if (result.success && result.data) {
        setReceipt(result.data);
        setCart([]);
        setDiscount(0);
        setPaymentMethod("cash");
        setSearchResults([]);
        setSearchQuery("");
        setTimeout(() => window.print(), 300);
      } else {
        setError(result.error ?? "فشلت عملية البيع");
      }
    });
  }

  function handleNewSale() {
    setReceipt(null);
    setError(null);
    searchRef.current?.focus();
  }

  const formatCurrency = (value: number) =>
    `${value.toLocaleString("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;

  if (receipt) {
    const pmLabel = PAYMENT_METHODS.find((p) => p.key === receipt.paymentMethod)?.label ?? receipt.paymentMethod;

    return (
      <>
        <div className="print:hidden flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">تم البيع بنجاح</h2>
            <p className="text-sm text-gray-500">رقم الفاتورة: {receipt.invoiceNumber}</p>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(receipt.totalAmount)}</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
                </svg>
                طباعة الفاتورة
              </button>
              <button
                onClick={handleNewSale}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                بيع جديد
              </button>
            </div>
          </div>
        </div>

        <div className="hidden print:block" dir="rtl">
          <div className="mx-auto max-w-sm p-4 text-right" style={{ fontFamily: "Arial, sans-serif" }}>
            <div className="mb-4 text-center border-b-2 border-gray-900 pb-3">
              <h1 className="text-lg font-bold text-gray-900">{receipt.tenantName || "مركز الصيانة"}</h1>
              <p className="text-xs text-gray-500">فاتورة بيع مباشر</p>
              <p className="text-xs text-gray-500">رقم: {receipt.invoiceNumber}</p>
            </div>

            <p className="text-xs text-gray-500 mb-3">التاريخ: {receipt.createdAt}</p>
            <p className="text-xs text-gray-500 mb-3">الكاشير: {receipt.cashierName || "—"}</p>

            <table className="w-full text-xs mb-3">
              <thead>
                <tr className="border-b border-gray-400">
                  <th className="pb-1 text-right font-bold text-gray-900">الصنف</th>
                  <th className="pb-1 text-center font-bold text-gray-900">الكمية</th>
                  <th className="pb-1 text-left font-bold text-gray-900">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-1 text-right text-gray-900">{item.name}</td>
                    <td className="py-1 text-center text-gray-700">{item.qty} × {item.price.toFixed(2)}</td>
                    <td className="py-1 text-left text-gray-900 font-medium">{item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t-2 border-gray-900 pt-2 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">الإجمالي</span>
                <span className="font-bold text-gray-900">{receipt.totalAmount.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">طريقة الدفع</span>
                <span className="font-medium text-gray-900">{pmLabel}</span>
              </div>
            </div>

            <div className="mt-6 border-t-2 border-gray-900 pt-3 text-center text-xs text-gray-600 space-y-1">
              <p>شكراً لتعاملكم معنا</p>
              <p className="text-gray-400 mt-2">{receipt.invoiceNumber}</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div dir="rtl" className="flex h-[calc(100vh-7rem)] gap-4">
      <div className="flex flex-1 flex-col rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              سلة المشتريات
              {itemCount > 0 && (
                <span className="mr-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
                  {itemCount}
                </span>
              )}
            </h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                </svg>
                <p className="mt-2 text-sm text-gray-400">السلة فارغة</p>
                <p className="text-xs text-gray-300">ابحث عن منتج وأضفه للبيع</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((entry) => (
                <div
                  key={entry.itemId}
                  className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white p-3 shadow-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{entry.name}</p>
                    <p className="text-xs text-gray-400">{entry.sku}</p>
                    <p className="text-sm font-semibold text-indigo-600 mt-0.5">
                      {formatCurrency(entry.sellingPrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleQuantityChange(entry.itemId, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                      </svg>
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-gray-900">{entry.quantity}</span>
                    <button
                      onClick={() => handleQuantityChange(entry.itemId, 1)}
                      disabled={entry.quantity >= entry.availableStock}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
                      </svg>
                    </button>
                  </div>
                  <div className="text-left min-w-[80px]">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(entry.quantity * entry.sellingPrice)}</p>
                  </div>
                  <button
                    onClick={() => handleRemove(entry.itemId)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">المجموع الفرعي</span>
            <span className="font-medium text-gray-900">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">الخصم</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={subtotal}
                value={discount}
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                className="w-20 rounded border border-gray-300 px-2 py-1 text-left text-sm"
              />
              <span className="text-xs text-gray-400">ج.م</span>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-gray-300 pt-2">
            <span className="text-base font-bold text-gray-900">الإجمالي</span>
            <span className="text-lg font-bold text-emerald-600">{formatCurrency(total)}</span>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            {PAYMENT_METHODS.map((pm) => (
              <button
                key={pm.key}
                onClick={() => setPaymentMethod(pm.key)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  paymentMethod === pm.key
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {pm.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleCheckout}
            disabled={isSubmitting || cart.length === 0 || total <= 0}
            className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                جاري إتمام البيع...
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                إتمام البيع وطباعة الفاتورة
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex w-96 flex-col rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <div className="relative">
            <svg
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="ابحث بالاسم أو الباركود أو SKU..."
              className="block w-full rounded-lg border border-gray-300 py-2.5 pr-10 pl-3 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isSearching && (
            <div className="flex items-center justify-center py-8">
              <svg className="h-6 w-6 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}

          {!isSearching && searchQuery && searchResults.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-gray-400">لا توجد نتائج</p>
            </div>
          )}

          {!isSearching && searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleManualAdd(result)}
                  disabled={result.qtyOnHand <= 0}
                  className={`w-full rounded-lg border p-3 text-right transition-colors ${
                    result.qtyOnHand <= 0
                      ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                      : "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm cursor-pointer"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 truncate">{result.name}</p>
                    {result.exactMatch && (
                      <span className="shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-700">
                        مطابق
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                    <span>{result.sku}</span>
                    <span className="font-semibold text-indigo-600">
                      {Number(result.sellingPrice).toLocaleString("en-EG", {
                        minimumFractionDigits: 2,
                      })} ج.م
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-gray-400">
                    المخزون: {result.qtyOnHand}
                    {result.qtyOnHand <= 5 && (
                      <span className="mr-1 text-amber-600">(محدود)</span>
                    )}
                  </p>
                </button>
              ))}
            </div>
          )}

          {!isSearching && !searchQuery && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <svg className="mx-auto h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <p className="mt-2 text-sm text-gray-400">ابحث عن منتج</p>
                <p className="text-xs text-gray-300">امسح الباركود أو اكتب الاسم</p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-center text-[10px] text-gray-400">
          الباركود يضاف تلقائياً عند المسح
        </div>
      </div>
    </div>
  );
}
