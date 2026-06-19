"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordPaymentAction } from "@/app/actions/billing";

const PAYMENT_METHODS = [
  { value: "cash", label: "نقدي" },
  { value: "card", label: "بطاقة" },
  { value: "wallet", label: "محفظة" },
] as const;

interface Props {
  invoiceId: string;
  totalAmount: number;
}

function formatCurrency(value: number): string {
  return `${value.toLocaleString("en-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ج.م`;
}

export function CollectPayment({ invoiceId, totalAmount }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await recordPaymentAction({
        invoiceId,
        amountPaid: totalAmount,
        paymentMethod: paymentMethod as "cash" | "card" | "wallet",
      });

      if (!result.success) {
        setError(result.error ?? "فشل الدفع");
        return;
      }

      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
          طريقة الدفع
        </label>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setPaymentMethod(m.value)}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                paymentMethod === m.value
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-md bg-gray-50 px-4 py-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">الإجمالي المستحق</span>
          <span className="font-semibold text-gray-900">
            {formatCurrency(totalAmount)}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {isPending ? "جارٍ المعالجة..." : `تحصيل ${formatCurrency(totalAmount)}`}
      </button>
    </form>
  );
}
