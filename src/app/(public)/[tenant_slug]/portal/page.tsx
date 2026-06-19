"use client";

import { useState, useTransition } from "react";
import { trackTicketPublicAction, type PublicTicketInfo } from "@/app/actions/portal";

const STEP_AR: { label: string; desc: string }[] = [
  { label: "تم استلام الجهاز", desc: "تم استلام جهازك في مركز الصيانة" },
  { label: "قيد الفحص والتشخيص", desc: "يتم فحص الجهاز وتشخيص المشكلة" },
  { label: "جاري الإصلاح والعمل عليه", desc: "يعمل الفنيون على إصلاح جهازك" },
  { label: "الجهاز جاهز للتسليم", desc: "يمكنك القدوم لاستلام جهازك" },
];

function statusToStep(status: string): number {
  switch (status) {
    case "intake": return 0;
    case "diagnosis":
    case "quote_approval": return 1;
    case "in_progress": return 2;
    case "completed":
    case "delivered": return 3;
    case "closed": return 3;
    case "cancelled": return -1;
    default: return -1;
  }
}

const STATUS_AR: Record<string, string> = {
  intake: "استلام",
  diagnosis: "تشخيص",
  quote_approval: "موافقة عرض سعر",
  in_progress: "قيد الصيانة",
  completed: "مكتمل",
  delivered: "تم التسليم",
  closed: "مغلق",
  cancelled: "ملغي",
};

const DEVICE_TYPE_AR: Record<string, string> = {
  laptop: "لابتوب",
  desktop: "كمبيوتر مكتبي",
  tablet: "تابلت",
  phone: "موبايل",
  printer: "طابعة",
  other: "أخرى",
};

function formatCurrency(value: string | null | undefined): string {
  if (!value) return "—";
  return `${Number(value).toLocaleString("en-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ج.م`;
}

export default function PortalPage({
  params: { tenant_slug },
}: {
  params: { tenant_slug: string };
}) {
  const [isPending, startTransition] = useTransition();
  const [ticketNumber, setTicketNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<PublicTicketInfo | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!ticketNumber.trim() || !phone.trim()) {
      setError("يرجى إدخال رقم التيكت ورقم الهاتف");
      return;
    }

    startTransition(async () => {
      const result = await trackTicketPublicAction(
        tenant_slug,
        ticketNumber.trim(),
        phone.trim(),
      );

      if (result.success) {
        setTicket(result.data);
      } else {
        setError(result.error);
        setTicket(null);
      }
    });
  }

  function handleBack() {
    setTicket(null);
    setError(null);
    setTicketNumber("");
    setPhone("");
  }

  const activeStep = ticket ? statusToStep(ticket.status) : -1;
  const isCancelled = ticket?.status === "cancelled";

  function parseConditionFlags(notes: string | null): string[] {
    if (!notes) return [];
    const match = notes.match(/حالة الجهاز:\s*(.+)/);
    if (!match) return [];
    return match[1].split(",").map((s) => s.trim());
  }

  function stripConditionPrefix(notes: string | null): string {
    if (!notes) return "";
    return notes.replace(/حالة الجهاز:.*(\n|$)/, "").trim();
  }

  if (isCancelled) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-red-800">التيكت ملغي</h1>
          <p className="mt-1 text-sm text-red-600">
            التيكت {ticket.ticketNumber} تم إلغاؤه. يرجى التواصل مع مركز الصيانة للمزيد من التفاصيل.
          </p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center shadow-sm">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs text-red-500">العميل</span>
              <p className="mt-0.5 font-medium text-red-900">{ticket.customerName}</p>
            </div>
            <div>
              <span className="text-xs text-red-500">الجهاز</span>
              <p className="mt-0.5 font-medium text-red-900">
                {DEVICE_TYPE_AR[ticket.deviceType] ?? ticket.deviceType}
                {ticket.deviceBrand ? ` (${ticket.deviceBrand})` : ""}
              </p>
            </div>
          </div>
        </div>
        <div className="text-center">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            تتبع تيكت آخر
          </button>
        </div>
      </div>
    );
  }

  if (ticket && !isCancelled) {
    const conditionFlags = parseConditionFlags(ticket.notes);
    const extraNotes = stripConditionPrefix(ticket.notes);
    const currentStep = activeStep;

    return (
      <>
        <div className="print:hidden space-y-8">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-gray-900">
              حالة التيكت {ticket.ticketNumber}
            </h1>
            <p className="mt-1 text-sm text-gray-500">{ticket.customerName}</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="relative">
              {STEP_AR.map((step, idx) => {
                const isComplete = idx < currentStep;
                const isCurrent = idx === currentStep;

                return (
                  <div key={idx} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
                          isComplete
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : isCurrent
                              ? "border-indigo-500 bg-indigo-500 text-white"
                              : "border-gray-300 bg-white text-gray-400"
                        }`}
                      >
                        {isComplete ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        ) : (
                          idx + 1
                        )}
                      </div>
                      {idx < STEP_AR.length - 1 && (
                        <div className={`h-10 w-0.5 ${isComplete ? "bg-emerald-400" : "bg-gray-200"}`} />
                      )}
                    </div>
                    <div className={`pb-10 ${idx === STEP_AR.length - 1 ? "pb-0" : ""}`}>
                      <p
                        className={`text-sm font-semibold ${
                          isCurrent ? "text-indigo-700" : isComplete ? "text-gray-900" : "text-gray-400"
                        }`}
                      >
                        {step.label}
                      </p>
                      <p
                        className={`text-xs ${
                          isCurrent || isComplete ? "text-gray-500" : "text-gray-300"
                        }`}
                      >
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">تفاصيل الجهاز</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-gray-500">نوع الجهاز</span>
                <p className="mt-0.5 font-medium text-gray-900">
                  {DEVICE_TYPE_AR[ticket.deviceType] ?? ticket.deviceType}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">الماركة</span>
                <p className="mt-0.5 font-medium text-gray-900">
                  {ticket.deviceBrand ?? "—"}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">الموديل</span>
                <p className="mt-0.5 font-medium text-gray-900">
                  {ticket.deviceModel ?? "—"}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">الحالة الحالية</span>
                <span className="mt-0.5 inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                  {STATUS_AR[ticket.status] ?? ticket.status}
                </span>
              </div>
              {ticket.expectedDeliveryDate && (
                <div className="col-span-2">
                  <span className="text-xs text-gray-500">تاريخ التسليم المتوقع</span>
                  <p className="mt-0.5 font-medium text-emerald-700">{ticket.expectedDeliveryDate}</p>
                </div>
              )}
              {ticket.estimatedCost && (
                <div className="col-span-2">
                  <span className="text-xs text-gray-500">التكلفة التقديرية</span>
                  <p className="mt-0.5 text-lg font-bold text-gray-900">{formatCurrency(ticket.estimatedCost)}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => window.print()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
              </svg>
              طباعة / تحميل الإيصال
            </button>
            <button
              onClick={handleBack}
              className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              تتبع تيكت آخر
            </button>
          </div>
        </div>

        <div className="hidden print:block" dir="rtl">
          <div className="mx-auto max-w-sm p-4 text-right" style={{ fontFamily: "Arial, sans-serif" }}>
            <div className="mb-4 text-center border-b-2 border-gray-900 pb-3">
              <h1 className="text-lg font-bold text-gray-900">{ticket.tenantName}</h1>
              <p className="text-xs text-gray-500">إيصال استلام جهاز</p>
            </div>

            <table className="w-full text-xs mb-4">
              <tbody>
                <tr>
                  <td className="py-1 font-bold text-gray-900 w-24">رقم التيكت:</td>
                  <td className="py-1 text-gray-700">{ticket.ticketNumber}</td>
                </tr>
                <tr>
                  <td className="py-1 font-bold text-gray-900">التاريخ:</td>
                  <td className="py-1 text-gray-700">{ticket.createdAt}</td>
                </tr>
              </tbody>
            </table>

            <div className="mb-3">
              <p className="text-xs font-bold text-gray-900 border-b border-gray-300 pb-1 mb-1">بيانات العميل</p>
              <table className="w-full text-xs">
                <tbody>
                  <tr>
                    <td className="py-0.5 text-gray-500 w-20">الاسم:</td>
                    <td className="py-0.5 text-gray-900">{ticket.customerName}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 text-gray-500">الهاتف:</td>
                    <td className="py-0.5 text-gray-900">{ticket.customerPhone}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mb-3">
              <p className="text-xs font-bold text-gray-900 border-b border-gray-300 pb-1 mb-1">بيانات الجهاز</p>
              <table className="w-full text-xs">
                <tbody>
                  <tr>
                    <td className="py-0.5 text-gray-500 w-20">النوع:</td>
                    <td className="py-0.5 text-gray-900">{DEVICE_TYPE_AR[ticket.deviceType] ?? ticket.deviceType}</td>
                  </tr>
                  {ticket.deviceBrand && (
                    <tr>
                      <td className="py-0.5 text-gray-500">الماركة:</td>
                      <td className="py-0.5 text-gray-900">{ticket.deviceBrand}</td>
                    </tr>
                  )}
                  {ticket.deviceModel && (
                    <tr>
                      <td className="py-0.5 text-gray-500">الموديل:</td>
                      <td className="py-0.5 text-gray-900">{ticket.deviceModel}</td>
                    </tr>
                  )}
                  {ticket.serialNumber && (
                    <tr>
                      <td className="py-0.5 text-gray-500">السيريال:</td>
                      <td className="py-0.5 text-gray-900">{ticket.serialNumber}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mb-3">
              <p className="text-xs font-bold text-gray-900 border-b border-gray-300 pb-1 mb-1">المشكلة المبلغ عنها</p>
              <p className="text-xs text-gray-700 leading-relaxed">{ticket.reportedProblem}</p>
            </div>

            {conditionFlags.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-bold text-gray-900 border-b border-gray-300 pb-1 mb-1">ملاحظات الفحص المبدئي</p>
                <ul className="text-xs text-gray-700 list-none pr-0">
                  {conditionFlags.map((flag, i) => (
                    <li key={i} className="py-0.5">✓ {flag}</li>
                  ))}
                </ul>
              </div>
            )}

            {extraNotes && (
              <div className="mb-3">
                <p className="text-xs font-bold text-gray-900 border-b border-gray-300 pb-1 mb-1">ملاحظات إضافية</p>
                <p className="text-xs text-gray-700">{extraNotes}</p>
              </div>
            )}

            <div className="mb-4 border-t border-gray-900 pt-2">
              <table className="w-full text-xs">
                <tbody>
                  {ticket.estimatedCost && (
                    <tr>
                      <td className="py-0.5 font-bold text-gray-900">التكلفة التقديرية:</td>
                      <td className="py-0.5 text-left font-bold text-gray-900">{formatCurrency(ticket.estimatedCost)}</td>
                    </tr>
                  )}
                  {ticket.expectedDeliveryDate && (
                    <tr>
                      <td className="py-0.5 text-gray-500">الموعد المتوقع:</td>
                      <td className="py-0.5 text-left text-emerald-700">{ticket.expectedDeliveryDate}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 border-t-2 border-gray-900 pt-3 text-center text-xs text-gray-600 space-y-1">
              <p>يرجى إحضار هذا الإيصال عند استلام الجهاز</p>
              <p>شكراً لثقتكم في مركز الصيانة</p>
              <p className="text-gray-400 mt-2">{ticket.ticketNumber} | {ticket.createdAt}</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg">
          <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900">تتبع حالة الصيانة</h1>
        <p className="mt-1 text-sm text-gray-500">
          أدخل رقم التيكت ورقم هاتفك لمعرفة حالة جهازك
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              رقم التيكت <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <svg
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75" />
              </svg>
              <input
                type="text"
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value)}
                placeholder="مثال: TKT-2026-00001"
                className="block w-full rounded-lg border border-gray-300 py-3 pr-10 pl-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              رقم الهاتف المحمول <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <svg
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
              </svg>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="مثال: +201000000000"
                className="block w-full rounded-lg border border-gray-300 py-3 pr-10 pl-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 ring-1 ring-inset ring-red-600/10">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <span>{error}</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-3 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
          >
            {isPending ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                جارٍ البحث...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                تتبع التيكت
              </>
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-gray-400">
        هذه الخدمة مقدمة من مركز الصيانة الخاص بكم
      </p>
    </div>
  );
}
