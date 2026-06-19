"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignTechnicianAction, updateTicketStatusAction } from "@/app/actions/tickets";

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

const ALL_STATUSES = [
  "intake",
  "diagnosis",
  "quote_approval",
  "in_progress",
  "completed",
  "delivered",
  "closed",
  "cancelled",
] as const;

interface Props {
  ticketId: string;
  currentTechnicianId: string | null;
  currentStatus: string;
  technicians: { id: string; fullName: string }[];
}

export function ActionsPanel({
  ticketId,
  currentTechnicianId,
  currentStatus,
  technicians,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleTechnicianChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const technicianId = e.target.value;
    startTransition(async () => {
      await assignTechnicianAction({ ticketId, technicianId });
      router.refresh();
    });
  }

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value;
    startTransition(async () => {
      await updateTicketStatusAction({ ticketId, newStatus });
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">الإجراءات</h3>
      </div>
      <div className="space-y-4 px-4 py-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
            تعيين فني
          </label>
          <select
            value={currentTechnicianId ?? ""}
            onChange={handleTechnicianChange}
            disabled={isPending}
            className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">— غير معين —</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
            تغيير الحالة
          </label>
          <select
            value={currentStatus}
            onChange={handleStatusChange}
            disabled={isPending}
            className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_AR[s] ?? s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        {isPending && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            جارٍ الحفظ...
          </div>
        )}
      </div>
    </div>
  );
}
