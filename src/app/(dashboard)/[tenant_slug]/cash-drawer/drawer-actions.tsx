"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  openCashDrawerSessionAction,
  closeCashDrawerSessionAction,
} from "@/app/actions/billing";

function formatCurrency(value: number): string {
  return `${value.toLocaleString("en-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ج.م`;
}

interface OpenDrawerFormProps {
  onSuccess?: () => void;
}

export function OpenDrawerForm({ onSuccess }: OpenDrawerFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openingBalance, setOpeningBalance] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const balance = parseFloat(openingBalance);
    if (isNaN(balance) || balance < 0) {
      setError("يرجى إدخال رصيد افتتاحي صحيح");
      return;
    }

    startTransition(async () => {
      const result = await openCashDrawerSessionAction(balance);
      if (!result.success) {
        setError(result.error ?? "فشل فتح الخزنة");
        return;
      }
      setOpeningBalance("");
      router.refresh();
      onSuccess?.();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          الرصيد الافتتاحي <span className="text-red-500">*</span>
        </label>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pl-3 text-sm text-gray-500">
            ج.م
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
            placeholder="0.00"
            required
            className="block w-full rounded-md border border-gray-300 py-2 pr-10 pl-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {isPending ? "جارٍ الفتح..." : "فتح الخزنة"}
      </button>
    </form>
  );
}

interface CloseDrawerFormProps {
  expectedTotal: number;
}

export function CloseDrawerForm({ expectedTotal }: CloseDrawerFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [closingBalance, setClosingBalance] = useState(String(expectedTotal));
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ variance: number } | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const balance = parseFloat(closingBalance);
    if (isNaN(balance) || balance < 0) {
      setError("يرجى إدخال رصيد إغلاق صحيح");
      return;
    }

    startTransition(async () => {
      const res = await closeCashDrawerSessionAction(balance);
      if (!res.success) {
        setError(res.error ?? "فشل إغلاق الخزنة");
        return;
      }
      setResult({ variance: res.data!.variance });
      router.refresh();
    });
  }

  if (result) {
    return (
      <div className="space-y-3">
        <div
          className={`rounded-md p-4 text-center ${
            Math.abs(result.variance) < 0.01
              ? "bg-green-50"
              : "bg-amber-50"
          }`}
        >
          <svg
            className={`mx-auto h-8 w-8 ${
              Math.abs(result.variance) < 0.01 ? "text-green-600" : "text-amber-600"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={
                Math.abs(result.variance) < 0.01
                  ? "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  : "M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              }
            />
          </svg>
          <p
            className={`mt-2 text-sm font-semibold ${
              Math.abs(result.variance) < 0.01
                ? "text-green-800"
                : "text-amber-800"
            }`}
          >
            {Math.abs(result.variance) < 0.01
              ? "تم إغلاق الوردية — لا توجد فروق"
              : `تم إغلاق الوردية بفارق ${formatCurrency(Math.abs(result.variance))}`}
          </p>
          <p className="text-xs text-gray-500">
            المتوقع: {formatCurrency(expectedTotal)} &middot; المعدود:{" "}
            {formatCurrency(Number(closingBalance))}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-md bg-blue-50 px-4 py-3">
        <div className="flex justify-between text-sm">
          <span className="text-blue-700">الإجمالي المتوقع</span>
          <span className="font-semibold text-blue-900">
            {formatCurrency(expectedTotal)}
          </span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          الرصيد الختامي المعدود <span className="text-red-500">*</span>
        </label>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pl-3 text-sm text-gray-500">
            ج.م
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={closingBalance}
            onChange={(e) => setClosingBalance(e.target.value)}
            required
            className="block w-full rounded-md border border-gray-300 py-2 pr-10 pl-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {isPending ? "جارٍ الإغلاق..." : "إغلاق الوردية"}
      </button>
    </form>
  );
}
