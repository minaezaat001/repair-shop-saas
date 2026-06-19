"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createItemAction } from "@/app/actions/inventory";

function generateSku(): string {
  const prefix = "GEN";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

function formatCurrency(value: number): string {
  return `${value.toLocaleString("en-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} \u062C.\u0645`;
}

export default function NewItemPage({ params: { tenant_slug } }: { params: { tenant_slug: string } }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [partName, setPartName] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [currentStock, setCurrentStock] = useState("0");
  const [minAlertQuantity, setMinAlertQuantity] = useState("0");
  const [description, setDescription] = useState("");

  const skuInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    skuInputRef.current?.focus();
  }, []);

  useEffect(() => {
    fetch(`/${tenant_slug}/inventory/api/categories`)
      .then((r) => r.json())
      .then((data) => setCategories(data))
      .catch(() => {});
  }, [tenant_slug]);

  function handleAutoGenerateSku() {
    setSku(generateSku());
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!partName.trim()) {
      setError("\u0627\u0633\u0645 \u0627\u0644\u0635\u0646\u0641 \u0645\u0637\u0644\u0648\u0628");
      return;
    }
    if (!sku.trim()) {
      setError("SKU \u0645\u0637\u0644\u0648\u0628. \u0627\u0645\u0633\u062D \u0628\u0627\u0631\u0643\u0648\u062F \u0623\u0648 \u0623\u0646\u0634\u0626 \u0648\u0627\u062D\u062F\u0627\u064B \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B");
      return;
    }
    const cost = parseFloat(costPrice);
    if (isNaN(cost) || cost < 0) {
      setError("\u0633\u0639\u0631 \u062A\u0643\u0644\u0641\u0629 \u0635\u062D\u064A\u062D \u0645\u0637\u0644\u0648\u0628");
      return;
    }
    const sell = parseFloat(sellingPrice);
    if (isNaN(sell) || sell <= 0) {
      setError("\u0633\u0639\u0631 \u0628\u064A\u0639 \u0635\u062D\u064A\u062D \u0645\u0637\u0644\u0648\u0628");
      return;
    }

    startTransition(async () => {
      const result = await createItemAction({
        partName: partName.trim(),
        sku: sku.trim(),
        barcode: sku.trim(),
        categoryId: categoryId || undefined,
        costPrice: cost,
        sellingPrice: sell,
        currentStock: parseInt(currentStock) || 0,
        minAlertQuantity: parseInt(minAlertQuantity) || 0,
        description: description.trim() || undefined,
      });

      if (!result.success) {
        setError(result.error ?? "\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0635\u0646\u0641");
        return;
      }

      setSuccess(`\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 ${result.data!.name} (${result.data!.sku})`);
      setPartName("");
      setSku("");
      setCostPrice("");
      setSellingPrice("");
      setCurrentStock("0");
      setMinAlertQuantity("0");
      setDescription("");

      setTimeout(() => {
        router.push(`/${tenant_slug}/inventory`);
      }, 1500);
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/${tenant_slug}/inventory`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        \u0627\u0644\u0639\u0648\u062F\u0629 \u0644\u0644\u0645\u062E\u0632\u0646
      </Link>

      <h1 className="mt-4 text-xl font-bold text-gray-900">\u0625\u0636\u0627\u0641\u0629 \u0635\u0646\u0641 \u062C\u062F\u064A\u062F</h1>
      <p className="mt-1 text-sm text-gray-500">
        \u0627\u0645\u0644\u0623 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0623\u062F\u0646\u0627\u0647. \u0627\u0633\u062A\u062E\u062F\u0645 \u0645\u0627\u0633\u062D \u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062F \u0639\u0644\u0649 \u062D\u0642\u0644 SKU \u0644\u0625\u062F\u062E\u0627\u0644 \u0641\u0648\u0631\u064A.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            SKU / \u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062F <span className="text-red-500">*</span>
          </label>
          <p className="mt-0.5 text-xs text-gray-400">
            \u0627\u0636\u063A\u0637 \u0639\u0644\u0649 \u0627\u0644\u062D\u0642\u0644 \u0648\u0627\u0645\u0633\u062D \u0628\u0627\u0631\u0643\u0648\u062F\u060C \u0623\u0648 \u0623\u0646\u0634\u0626 SKU \u0641\u0631\u064A\u062F \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B.
          </p>
          <div className="mt-1 flex gap-2">
            <input
              ref={skuInputRef}
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="\u0627\u0645\u0633\u062D \u0628\u0627\u0631\u0643\u0648\u062F \u0623\u0648 \u0627\u0643\u062A\u0628 SKU..."
              required
              className="block flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={handleAutoGenerateSku}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
              </svg>
              \u0625\u0646\u0634\u0627\u0621 SKU \u062A\u0644\u0642\u0627\u0626\u064A
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            \u0627\u0633\u0645 \u0627\u0644\u0635\u0646\u0641 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={partName}
            onChange={(e) => setPartName(e.target.value)}
            placeholder="\u0645\u062B\u0627\u0644: \u0634\u0627\u0634\u0629 LCD \u0628\u062F\u064A\u0644\u0629"
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">\u0627\u0644\u0648\u0635\u0641</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="\u0648\u0635\u0641 \u0627\u062E\u062A\u064A\u0627\u0631\u064A"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">\u0627\u0644\u062A\u0635\u0646\u064A\u0641</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">\u0628\u062F\u0648\u0646 \u062A\u0635\u0646\u064A\u0641</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">\u0648\u062D\u062F\u0629 \u0627\u0644\u0642\u064A\u0627\u0633</label>
            <select
              defaultValue="piece"
              disabled
              className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500 shadow-sm"
            >
              <option value="piece">\u0642\u0637\u0639\u0629</option>
              <option value="set">\u0645\u062C\u0645\u0648\u0639\u0629</option>
              <option value="meter">\u0645\u062A\u0631</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              \u0633\u0639\u0631 \u0627\u0644\u062A\u0643\u0644\u0641\u0629 <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pl-3 text-sm text-gray-500">
                \u062C.\u0645
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
                required
                className="block w-full rounded-md border border-gray-300 py-2 pr-10 pl-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              \u0633\u0639\u0631 \u0627\u0644\u0628\u064A\u0639 <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pl-3 text-sm text-gray-500">
                \u062C.\u0645
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="0.00"
                required
                className="block w-full rounded-md border border-gray-300 py-2 pr-10 pl-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {costPrice && sellingPrice && Number(sellingPrice) > 0 && (
          <div className="rounded-md bg-gray-50 px-4 py-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">\u0647\u0627\u0645\u0634 \u0627\u0644\u0631\u0628\u062D</span>
              <span
                className={`font-semibold ${
                  Number(sellingPrice) > Number(costPrice)
                    ? "text-green-700"
                    : "text-red-700"
                }`}
              >
                {(
                  ((Number(sellingPrice) - Number(costPrice)) / Number(sellingPrice)) *
                  100
                ).toFixed(1)}
                %
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">\u0627\u0644\u0631\u0628\u062D \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(Number(sellingPrice) - Number(costPrice))}
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">\u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0627\u0644\u0627\u0628\u062A\u062F\u0627\u0626\u064A</label>
            <input
              type="number"
              min="0"
              value={currentStock}
              onChange={(e) => setCurrentStock(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">\u062D\u062F \u0627\u0644\u062A\u0646\u0628\u064A\u0647 \u0644\u0644\u0645\u062E\u0632\u0648\u0646</label>
            <input
              type="number"
              min="0"
              value={minAlertQuantity}
              onChange={(e) => setMinAlertQuantity(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 p-3 text-sm font-medium text-green-800">
            {success} \u062C\u0627\u0631\u064D \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0644\u0644\u0645\u062E\u0632\u0646...
          </div>
        )}

        <div className="flex justify-start gap-3 border-t border-gray-200 pt-4">
          <Link
            href={`/${tenant_slug}/inventory`}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            \u0625\u0644\u063A\u0627\u0621
          </Link>
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
            {isPending ? "\u062C\u0627\u0631\u064D \u0627\u0644\u0625\u0646\u0634\u0627\u0621..." : "\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0635\u0646\u0641"}
          </button>
        </div>
      </form>
    </div>
  );
}
