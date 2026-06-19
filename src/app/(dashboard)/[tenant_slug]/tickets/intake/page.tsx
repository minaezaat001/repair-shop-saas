"use client";

import { useState, useTransition } from "react";
import { useRouter, useParams } from "next/navigation";
import { createTicketAction } from "@/app/actions/tickets";

type DeviceType = "laptop" | "desktop" | "tablet" | "phone" | "printer" | "other";

const DEVICE_TYPES: { value: DeviceType; label: string }[] = [
  { value: "laptop", label: "لابتوب" },
  { value: "desktop", label: "كمبيوتر مكتبي" },
  { value: "tablet", label: "تابلت" },
  { value: "phone", label: "موبايل" },
  { value: "printer", label: "طابعة" },
  { value: "other", label: "أخرى" },
];

const CONDITION_ITEMS = [
  { id: "scratches", label: "خدوش / صدمات ظاهرة" },
  { id: "cracks", label: "شاشة مكسورة / هيكل تالف" },
  { id: "power_adapter", label: "تم استلام شاحن" },
  { id: "missing_parts", label: "أزرار / منافذ / براغي مفقودة" },
  { id: "liquid_damage", label: "اشتباه تلف بالسوائل" },
  { id: "battery_swollen", label: "بطارية منتفخة" },
  { id: "no_boot", label: "لا يعمل" },
  { id: "overheating", label: "سخونة زائدة" },
];

export default function IntakePage() {
  const router = useRouter();
  const params = useParams<{ tenant_slug: string }>();
  const [isPending, startTransition] = useTransition();

  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const [deviceType, setDeviceType] = useState<DeviceType>("laptop");
  const [deviceBrand, setDeviceBrand] = useState("");
  const [deviceModel, setDeviceModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");

  const [reportedProblem, setReportedProblem] = useState("");
  const [conditionNotes, setConditionNotes] = useState("");
  const [conditionFlags, setConditionFlags] = useState<Set<string>>(new Set());
  const [estimatedCost, setEstimatedCost] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");

  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  function toggleCondition(id: string) {
    setConditionFlags((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!phone.trim() || !fullName.trim() || !reportedProblem.trim()) {
      setToast({ type: "error", message: "رقم الهاتف والاسم والمشكلة المبلغ عنها مطلوبة" });
      return;
    }

    startTransition(async () => {
      const result = await createTicketAction({
        customer: {
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
        },
        deviceType,
        deviceBrand: deviceBrand.trim() || undefined,
        deviceModel: deviceModel.trim() || undefined,
        serialNumber: serialNumber.trim() || undefined,
        reportedProblem: reportedProblem.trim(),
        notes: [
          conditionFlags.size > 0
            ? `حالة الجهاز: ${[...conditionFlags].join(", ")}`
            : null,
          conditionNotes.trim() || null,
        ]
          .filter(Boolean)
          .join("\n"),
      });

      if (result.success && result.data) {
        setToast({ type: "success", message: `تم إنشاء التيكت ${result.data.ticketNumber}` });
        setTimeout(() => {
          router.push(`/${params.tenant_slug}/tickets`);
        }, 1000);
      } else {
        setToast({ type: "error", message: result.error ?? "فشل إنشاء التيكت" });
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">استقبال جهاز جديد</h2>
        <p className="mt-1 text-sm text-gray-500">
          تسجيل جهاز جديد للصيانة. جميع الحقول المميزة بـ * مطلوبة.
        </p>
      </div>

      {toast && (
        <div
          className={`rounded-lg p-4 text-sm shadow-sm ${
            toast.type === "success"
              ? "bg-green-50 text-green-800 ring-1 ring-green-600/20"
              : "bg-red-50 text-red-800 ring-1 ring-red-600/20"
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === "success" ? (
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            ) : (
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            )}
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="mr-auto text-current opacity-60 hover:opacity-100"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">بيانات العميل</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="رقم الهاتف *">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="مثال: 0100 000 0000"
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                required
              />
            </Field>
            <Field label="الاسم بالكامل *">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="اسم العميل"
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                required
              />
            </Field>
            <Field label="البريد الإلكتروني">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">تفاصيل الجهاز</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="نوع الجهاز *">
              <select
                value={deviceType}
                onChange={(e) => setDeviceType(e.target.value as DeviceType)}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                required
              >
                {DEVICE_TYPES.map((dt) => (
                  <option key={dt.value} value={dt.value}>
                    {dt.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="الماركة">
              <input
                type="text"
                value={deviceBrand}
                onChange={(e) => setDeviceBrand(e.target.value)}
                placeholder="مثال: Dell, HP, Apple"
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </Field>
            <Field label="الموديل">
              <input
                type="text"
                value={deviceModel}
                onChange={(e) => setDeviceModel(e.target.value)}
                placeholder="مثال: XPS 15, ProBook 450"
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </Field>
            <Field label="الرقم التسلسلي / السيريال">
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="سيريال الجهاز أو IMEI"
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">المشكلة المبلغ عنها *</h3>
          <textarea
            value={reportedProblem}
            onChange={(e) => setReportedProblem(e.target.value)}
            rows={3}
            placeholder="وصف المشكلة التي أبلغ بها العميل..."
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-y"
            required
          />
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">الفحص المبدئي وملاحظات الاستلام</h3>
          <p className="text-xs text-gray-400 mb-3">
            حدد أي ملاحظات ظاهرة أثناء الفحص المبدئي
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CONDITION_ITEMS.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 text-sm cursor-pointer hover:bg-gray-50 transition-colors has-[:checked]:border-blue-300 has-[:checked]:bg-blue-50"
              >
                <input
                  type="checkbox"
                  checked={conditionFlags.has(item.id)}
                  onChange={() => toggleCondition(item.id)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {item.label}
              </label>
            ))}
          </div>
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              ملاحظات إضافية
            </label>
            <textarea
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
              rows={2}
              placeholder="أي ملاحظات إضافية عن حالة الجهاز..."
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-y"
            />
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">التكلفة المتوقعة والموعد</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="التكلفة المتوقعة (ج.م)">
              <div className="relative">
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  ج.م
                </span>
                <input
                  type="number"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none pr-12"
                />
              </div>
            </Field>
            <Field label="تاريخ التسليم الواعد">
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </Field>
          </div>
        </section>

        <div className="flex items-center justify-start gap-3 border-t border-gray-200 pt-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                جارٍ الإنشاء...
              </>
            ) : (
              "إنشاء التيكت"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
