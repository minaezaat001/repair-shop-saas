import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, schema } from "@/drizzle/client";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PartsManager, type PartLine } from "./parts-manager";
import { ActionsPanel } from "./actions-panel";

const DEVICE_TYPE_LABELS: Record<string, string> = {
  laptop: "لابتوب",
  desktop: "كمبيوتر مكتبي",
  tablet: "تابلت",
  phone: "موبايل",
  printer: "طابعة",
  other: "أخرى",
};

const STATUS_STYLES: Record<string, string> = {
  intake: "bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-600/20",
  diagnosis: "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  quote_approval: "bg-orange-100 text-orange-700 ring-1 ring-inset ring-orange-600/20",
  in_progress: "bg-indigo-100 text-indigo-700 ring-1 ring-inset ring-indigo-600/20",
  completed: "bg-green-100 text-green-700 ring-1 ring-inset ring-green-600/20",
  delivered: "bg-teal-100 text-teal-700 ring-1 ring-inset ring-teal-600/20",
  closed: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-500/20",
  cancelled: "bg-red-100 text-red-700 ring-1 ring-inset ring-red-600/20",
};

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

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
        STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {STATUS_AR[status] ?? status.replace(/_/g, " ")}
    </span>
  );
}

function formatDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "الآن";
  if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  if (diffDays < 7) return `منذ ${diffDays} يوم`;

  return date.toLocaleDateString("en-EG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value: string | number | null | undefined): string {
  if (value == null) return "—";
  return `${Number(value).toLocaleString("en-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ج.م`;
}

interface PageProps {
  params: { id: string; tenant_slug: string };
}

export default async function TicketDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { tenantId, branchId, tenantSlug } = session.user;
  if (tenantSlug !== params.tenant_slug) redirect(`/${tenantSlug}/tickets`);

  const [ticket] = await db
    .select({
      id: schema.tickets.id,
      ticketNumber: schema.tickets.ticketNumber,
      status: schema.tickets.status,
      deviceType: schema.tickets.deviceType,
      deviceBrand: schema.tickets.deviceBrand,
      deviceModel: schema.tickets.deviceModel,
      serialNumber: schema.tickets.serialNumber,
      reportedProblem: schema.tickets.reportedProblem,
      notes: schema.tickets.notes,
      estimatedCost: schema.tickets.estimatedCost,
      expectedDeliveryDate: schema.tickets.expectedDeliveryDate,
      assignedTechnicianId: schema.tickets.assignedTechnicianId,
      createdAt: schema.tickets.createdAt,
      updatedAt: schema.tickets.updatedAt,
      customerName: schema.customers.fullName,
      customerPhone: schema.customers.phone,
      customerEmail: schema.customers.email,
      technicianName: schema.users.fullName,
    })
    .from(schema.tickets)
    .leftJoin(schema.customers, eq(schema.tickets.customerId, schema.customers.id))
    .leftJoin(schema.users, eq(schema.tickets.assignedTechnicianId, schema.users.id))
    .where(
      and(
        eq(schema.tickets.id, params.id),
        eq(schema.tickets.tenantId, tenantId),
        eq(schema.tickets.branchId, branchId),
        sql`${schema.tickets.deletedAt} IS NULL`,
      ),
    )
    .limit(1);

  if (!ticket) notFound();

  const statusHistory = await db
    .select({
      id: schema.ticketStatusHistory.id,
      fromStatus: schema.ticketStatusHistory.fromStatus,
      toStatus: schema.ticketStatusHistory.toStatus,
      note: schema.ticketStatusHistory.note,
      createdAt: schema.ticketStatusHistory.createdAt,
      changedByName: schema.users.fullName,
    })
    .from(schema.ticketStatusHistory)
    .leftJoin(schema.users, eq(schema.ticketStatusHistory.changedBy, schema.users.id))
    .where(eq(schema.ticketStatusHistory.ticketId, params.id))
    .orderBy(asc(schema.ticketStatusHistory.createdAt));

  const inventoryParts = await db
    .select({
      id: schema.ticketPartsUsed.id,
      partName: schema.inventoryItems.itemName,
      qty: schema.ticketPartsUsed.qtyUsed,
      unitCost: schema.ticketPartsUsed.unitCost,
      lineTotal: schema.ticketPartsUsed.lineTotal,
      createdAt: schema.ticketPartsUsed.createdAt,
    })
    .from(schema.ticketPartsUsed)
    .innerJoin(
      schema.inventoryItems,
      eq(schema.ticketPartsUsed.itemId, schema.inventoryItems.id),
    )
    .where(eq(schema.ticketPartsUsed.ticketId, params.id))
    .orderBy(desc(schema.ticketPartsUsed.createdAt));

  const externalParts = await db
    .select({
      id: schema.ticketExternalParts.id,
      partName: schema.ticketExternalParts.partName,
      supplierName: schema.ticketExternalParts.supplierName,
      qty: schema.ticketExternalParts.qty,
      unitCost: schema.ticketExternalParts.unitCost,
      lineTotal: schema.ticketExternalParts.lineTotal,
      createdAt: schema.ticketExternalParts.createdAt,
    })
    .from(schema.ticketExternalParts)
    .where(eq(schema.ticketExternalParts.ticketId, params.id))
    .orderBy(desc(schema.ticketExternalParts.createdAt));

  const allParts: PartLine[] = [
    ...inventoryParts.map((p) => ({
      id: p.id,
      type: "inventory" as const,
      partName: p.partName,
      qty: p.qty,
      unitCost: p.unitCost,
      lineTotal: p.lineTotal,
      createdAt: p.createdAt,
    })),
    ...externalParts.map((p) => ({
      id: p.id,
      type: "external" as const,
      partName: p.partName,
      qty: p.qty,
      unitCost: p.unitCost,
      lineTotal: p.lineTotal,
      createdAt: p.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const totalCost = allParts.reduce((sum, p) => sum + Number(p.lineTotal), 0);

  const technicians = await db
    .select({
      id: schema.users.id,
      fullName: schema.users.fullName,
    })
    .from(schema.users)
    .innerJoin(schema.roles, eq(schema.users.roleId, schema.roles.id))
    .innerJoin(
      schema.userBranchAssignments,
      eq(schema.users.id, schema.userBranchAssignments.userId),
    )
    .where(
      and(
        eq(schema.users.tenantId, tenantId),
        eq(schema.users.isActive, true),
        eq(schema.roles.roleName, "technician"),
        eq(schema.userBranchAssignments.branchId, branchId),
      ),
    )
    .orderBy(asc(schema.users.fullName));

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/${tenantSlug}/tickets`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          العودة إلى التيكتات
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">{ticket.ticketNumber}</h1>
          <StatusBadge status={ticket.status} />
          <span className="mr-auto text-xs text-gray-400">
            أُنشئ {formatDate(ticket.createdAt)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">بيانات العميل</h2>
            </div>
            <div className="px-4 py-4">
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-medium text-gray-500">الاسم</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900">{ticket.customerName}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">رقم الهاتف</dt>
                  <dd className="mt-0.5 text-sm text-gray-900">{ticket.customerPhone}</dd>
                </div>
                {ticket.customerEmail && (
                  <div className="col-span-2">
                    <dt className="text-xs font-medium text-gray-500">البريد الإلكتروني</dt>
                    <dd className="mt-0.5 text-sm text-gray-900">{ticket.customerEmail}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">معلومات الجهاز</h2>
            </div>
            <div className="px-4 py-4">
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-medium text-gray-500">النوع</dt>
                  <dd className="mt-0.5">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {DEVICE_TYPE_LABELS[ticket.deviceType] ?? ticket.deviceType}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">الرقم التسلسلي</dt>
                  <dd className="mt-0.5 text-sm text-gray-900">{ticket.serialNumber ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">الماركة</dt>
                  <dd className="mt-0.5 text-sm text-gray-900">{ticket.deviceBrand ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">الموديل</dt>
                  <dd className="mt-0.5 text-sm text-gray-900">{ticket.deviceModel ?? "—"}</dd>
                </div>
              </dl>

              <div className="mt-4">
                <dt className="text-xs font-medium text-gray-500">المشكلة المبلغ عنها</dt>
                <dd className="mt-0.5 whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm text-gray-900">
                  {ticket.reportedProblem}
                </dd>
              </div>

              {ticket.notes && (
                <div className="mt-4">
                  <dt className="text-xs font-medium text-gray-500">ملاحظات الفحص</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm text-gray-700">
                    {ticket.notes}
                  </dd>
                </div>
              )}

              {ticket.estimatedCost && (
                <div className="mt-4 flex items-center gap-2 rounded-md bg-indigo-50 px-3 py-2">
                  <span className="text-xs font-medium text-indigo-700">التكلفة المتوقعة:</span>
                  <span className="text-sm font-semibold text-indigo-900">
                    {formatCurrency(ticket.estimatedCost)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">سجل الحالات</h2>
            </div>
            <div className="px-4 py-4">
              {statusHistory.length === 0 ? (
                <p className="text-sm text-gray-500">لا توجد تغييرات في الحالة</p>
              ) : (
                <div className="relative">
                  <div className="absolute bottom-2 right-[7px] top-2 w-0.5 bg-gray-200" />
                  <div className="space-y-6">
                    {statusHistory.map((entry, idx) => (
                      <div key={entry.id} className="relative flex gap-4">
                        <div className="min-w-0 flex-1 text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {entry.fromStatus
                              ? `${STATUS_AR[entry.fromStatus] ?? entry.fromStatus.replace(/_/g, " ")} ← ${STATUS_AR[entry.toStatus] ?? entry.toStatus.replace(/_/g, " ")}`
                              : STATUS_AR[entry.toStatus] ?? entry.toStatus.replace(/_/g, " ")}
                          </p>
                          <div className="mt-0.5 flex items-center justify-end gap-2 text-xs text-gray-500">
                            <span>{formatDate(entry.createdAt)}</span>
                            <span>&middot;</span>
                            <span>بواسطة {entry.changedByName ?? "غير معروف"}</span>
                          </div>
                          {entry.note && (
                            <p className="mt-1 rounded bg-gray-50 px-2 py-1 text-xs italic text-gray-600 text-right">
                              {entry.note}
                            </p>
                          )}
                        </div>
                        <div
                          className={`relative z-10 mt-1.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full ring-2 ring-white ${
                            idx === 0 ? "bg-indigo-500" : "bg-gray-300"
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <PartsManager ticketId={params.id} parts={allParts} totalCost={totalCost} />

          <ActionsPanel
            ticketId={params.id}
            currentTechnicianId={ticket.assignedTechnicianId}
            currentStatus={ticket.status}
            technicians={technicians}
          />
        </div>
      </div>
    </div>
  );
}
