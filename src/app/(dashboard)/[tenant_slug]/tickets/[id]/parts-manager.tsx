"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { addPartToTicketAction } from "@/app/actions/parts";
import { searchInventoryItemsAction } from "@/app/actions/inventory";

export interface PartLine {
  id: string;
  type: "inventory" | "external";
  partName: string;
  qty: number;
  unitCost: string;
  lineTotal: string;
  createdAt: Date;
}

interface Props {
  ticketId: string;
  parts: PartLine[];
  totalCost: number;
}

interface SearchResult {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  costPrice: string;
  sellingPrice: string;
  qtyOnHand: number;
  exactMatch: boolean;
}

function formatCurrency(value: number | string): string {
  return `${Number(value).toLocaleString("en-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ج.م`;
}

export function PartsManager({ ticketId, parts, totalCost }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"inventory" | "external">("external");
  const [error, setError] = useState<string | null>(null);

  const [partName, setPartName] = useState("");
  const [qty, setQty] = useState(1);
  const [unitCost, setUnitCost] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [supplierName, setSupplierName] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const [scannedSuccess, setScannedSuccess] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (activeTab === "inventory") {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [activeTab]);

  const doSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSelectedItem(null);
      return;
    }

    setIsSearching(true);
    try {
      const result = await searchInventoryItemsAction(query.trim());
      if (result.success && result.data) {
        setSearchResults(result.data);

        const exact = result.data.find((r) => r.exactMatch);
        if (exact && exact.qtyOnHand > 0) {
          setSelectedItem(exact);
          setScannedSuccess(`تم المسح: ${exact.name}`);
          setTimeout(() => setScannedSuccess(null), 2000);

          startTransition(async () => {
            const res = await addPartToTicketAction({
              ticketId,
              partName: exact.name,
              qty: 1,
              unitCost: Number(exact.costPrice),
              sellingPrice: Number(exact.sellingPrice),
              itemId: exact.id,
            });
            if (res.success) {
              setSearchQuery("");
              setSearchResults([]);
              setSelectedItem(null);
              setModalOpen(false);
              router.refresh();
            } else {
              setError(res.error ?? "فشل تخصيص القطعة الممسوحة");
            }
          });
        }
      }
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [ticketId, router]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchQuery.trim()) {
      debounceRef.current = setTimeout(() => doSearch(searchQuery), 250);
    } else {
      setSearchResults([]);
      setSelectedItem(null);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, doSearch]);

  function handleSelectFromInventory(item: SearchResult) {
    if (item.qtyOnHand <= 0) {
      setError(`${item.name} غير متوفر في المخزن`);
      return;
    }

    setSelectedItem(item);

    startTransition(async () => {
      const result = await addPartToTicketAction({
        ticketId,
        partName: item.name,
        qty: 1,
        unitCost: Number(item.costPrice),
        sellingPrice: Number(item.sellingPrice),
        itemId: item.id,
      });

      if (!result.success) {
        setError(result.error ?? "فشل تخصيص القطعة");
        return;
      }

      setSearchQuery("");
      setSearchResults([]);
      setSelectedItem(null);
      setModalOpen(false);
      router.refresh();
    });
  }

  function resetForm() {
    setPartName("");
    setQty(1);
    setUnitCost("");
    setSellingPrice("");
    setSupplierName("");
    setError(null);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedItem(null);
    setScannedSuccess(null);
  }

  async function handleExternalSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!partName.trim()) {
      setError("اسم القطعة مطلوب");
      return;
    }
    if (!unitCost || Number(unitCost) <= 0) {
      setError("سعر التكلفة مطلوب");
      return;
    }
    if (!sellingPrice || Number(sellingPrice) <= 0) {
      setError("سعر البيع مطلوب");
      return;
    }

    startTransition(async () => {
      const result = await addPartToTicketAction({
        ticketId,
        partName: partName.trim(),
        qty,
        unitCost: Number(unitCost),
        sellingPrice: Number(sellingPrice),
        supplierName: supplierName.trim() || undefined,
      });

      if (!result.success) {
        setError(result.error ?? "فشل إضافة القطعة");
        return;
      }

      resetForm();
      setModalOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">القطع ومواد الصيانة</h3>
        <button
          onClick={() => {
            resetForm();
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          إضافة قطعة
        </button>
      </div>

      {parts.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-gray-500">
          لم يتم تخصيص قطع بعد
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-right font-medium text-gray-500">القطعة</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">النوع</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">الكمية</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">سعر التكلفة</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {parts.map((p) => (
                <tr key={`${p.type}-${p.id}`} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-2 font-medium text-gray-900">
                    {p.partName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.type === "inventory"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {p.type === "inventory" ? "مخزني" : "خارجي"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-left text-gray-700">
                    {p.qty}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-left text-gray-700">
                    {formatCurrency(p.unitCost)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-left font-medium text-gray-900">
                    {formatCurrency(p.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-300 bg-gray-50">
              <tr>
                <td colSpan={4} className="px-4 py-2 text-left text-sm font-semibold text-gray-900">
                  إجمالي القطع
                </td>
                <td className="px-4 py-2 text-left text-sm font-semibold text-gray-900">
                  {formatCurrency(totalCost)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">إضافة قطعة للتيكت</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="border-b border-gray-200">
              <div className="flex">
                <button
                  onClick={() => setActiveTab("inventory")}
                  className={`flex-1 px-4 py-2.5 text-center text-sm font-medium ${
                    activeTab === "inventory"
                      ? "border-b-2 border-indigo-600 text-indigo-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  قطع من المخزن
                </button>
                <button
                  onClick={() => setActiveTab("external")}
                  className={`flex-1 px-4 py-2.5 text-center text-sm font-medium ${
                    activeTab === "external"
                      ? "border-b-2 border-indigo-600 text-indigo-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  قطعة خارجية مضافة
                </button>
              </div>
            </div>

            <div className="px-5 py-4">
              {activeTab === "inventory" ? (
                <div className="space-y-3">
                  {scannedSuccess && (
                    <div className="rounded-md bg-green-50 p-2 text-center text-xs font-medium text-green-700">
                      {scannedSuccess}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      مسح الباركود أو البحث
                    </label>
                    <p className="mt-0.5 text-xs text-gray-400">
                      استخدم ماسح الباركود أو اكتب للبحث في المخزن
                    </p>
                    <div className="relative mt-1">
                      <svg
                        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                        />
                      </svg>
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="مسح باركود أو كتابة اسم المنتج..."
                        className="block w-full rounded-md border border-gray-300 py-2 pr-10 pl-3 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      {isSearching && (
                        <svg
                          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {selectedItem && !scannedSuccess && (
                    <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3">
                      <p className="text-xs font-medium text-indigo-800">المحدد: {selectedItem.name}</p>
                      <p className="text-xs text-indigo-600">
                        SKU: {selectedItem.sku} &middot; المخزون: {selectedItem.qtyOnHand}
                      </p>
                    </div>
                  )}

                  {searchResults.length > 0 && !selectedItem && (
                    <div className="max-h-60 overflow-y-auto rounded-md border border-gray-200">
                      {searchResults.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleSelectFromInventory(item)}
                          disabled={item.qtyOnHand <= 0 || isPending}
                          className={`flex w-full items-center justify-between border-b border-gray-100 px-3 py-2.5 text-right last:border-0 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 ${
                            item.exactMatch ? "bg-green-50" : ""
                          }`}
                        >
                          <div className="mr-3 text-left">
                            <p className="text-sm font-medium text-gray-900">
                              {formatCurrency(item.sellingPrice)}
                            </p>
                            <p
                              className={`text-xs ${
                                item.qtyOnHand <= 0
                                  ? "text-red-600"
                                  : item.qtyOnHand <= 5
                                    ? "text-amber-600"
                                    : "text-gray-500"
                              }`}
                            >
                              المخزون: {item.qtyOnHand}
                            </p>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-500">
                              <span className="font-mono">{item.barcode ?? item.sku}</span>
                              {item.exactMatch && (
                                <span className="mr-2 inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                                  تطابق تام
                                </span>
                              )}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchQuery && !isSearching && searchResults.length === 0 && (
                    <div className="rounded-md bg-gray-50 p-4 text-center text-sm text-gray-500">
                      لا توجد نتائج لـ &ldquo;{searchQuery}&rdquo;
                    </div>
                  )}

                  {error && (
                    <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
                  )}

                  <div className="flex justify-start border-t border-gray-200 pt-3">
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleExternalSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      اسم القطعة <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={partName}
                      onChange={(e) => setPartName(e.target.value)}
                      placeholder="مثال: شاشة بديلة"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        الكمية <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={qty}
                        onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        سعر التكلفة <span className="text-red-500">*</span>
                      </label>
                      <div className="relative mt-1">
                        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pl-3 text-sm text-gray-500">
                          ج.م
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={unitCost}
                          onChange={(e) => setUnitCost(e.target.value)}
                          placeholder="0.00"
                          className="block w-full rounded-md border border-gray-300 py-2 pr-10 pl-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        سعر البيع <span className="text-red-500">*</span>
                      </label>
                      <div className="relative mt-1">
                        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pl-3 text-sm text-gray-500">
                          ج.م
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={sellingPrice}
                          onChange={(e) => setSellingPrice(e.target.value)}
                          placeholder="0.00"
                          className="block w-full rounded-md border border-gray-300 py-2 pr-10 pl-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {unitCost && sellingPrice && Number(sellingPrice) > 0 ? (
                    <div className="rounded-md bg-gray-50 px-3 py-2">
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>الإجمالي (سعر البيع):</span>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(Number(sellingPrice) * qty)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>إجمالي التكلفة:</span>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(Number(unitCost) * qty)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>هامش الربح:</span>
                        <span
                          className={`font-medium ${
                            Number(sellingPrice) > Number(unitCost)
                              ? "text-green-700"
                              : "text-red-700"
                          }`}
                        >
                          {(
                            ((Number(sellingPrice) - Number(unitCost)) /
                              Number(sellingPrice)) *
                            100
                          ).toFixed(1)}
                          %
                        </span>
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      اسم المورد
                    </label>
                    <input
                      type="text"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      placeholder="اختياري"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {error && (
                    <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
                  )}

                  <div className="flex justify-start gap-3 border-t border-gray-200 pt-4">
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isPending && (
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                      {isPending ? "جارٍ الإضافة..." : "إضافة قطعة"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
