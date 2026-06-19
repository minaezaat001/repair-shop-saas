import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, schema } from "@/drizzle/client";
import { eq, and, asc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { generateInvoiceFromTicketAction } from "@/app/actions/billing";
import { CollectPayment } from "./collect-payment";

function formatCurrency(value: string | number | null | undefined): string {
  if (value == null) return "—";
  return `${Number(value).toLocaleString("en-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ج.م`;
}

const INVOICE_STATUS_AR: Record<string, string> = {
  draft: "مسودة",
  issued: "صادر",
  paid: "مدفوع",
  partially_paid: "مدفوع جزئياً",
  overdue: "متأخر",
  cancelled: "ملغي",
};

function InvoiceStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-500/20",
    issued: "bg-yellow-100 text-yellow-700 ring-1 ring-inset ring-yellow-600/20",
    paid: "bg-green-100 text-green-700 ring-1 ring-inset ring-green-600/20",
    partially_paid: "bg-orange-100 text-orange-700 ring-1 ring-inset ring-orange-600/20",
    overdue: "bg-red-100 text-red-700 ring-1 ring-inset ring-red-600/20",
    cancelled: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-500/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
        styles[status] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {INVOICE_STATUS_AR[status] ?? status.replace(/_/g, " ")}
    </span>
  );
}

interface PageProps {
  params: { id: string; tenant_slug: string };
}

export default async function InvoicePage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { tenantId, branchId, tenantSlug, roleName } = session.user;
  if (tenantSlug !== params.tenant_slug) redirect(`/${tenantSlug}/tickets`);

  if (roleName === "technician") {
    redirect(`/${tenantSlug}/tickets/${params.id}?error=unauthorized`);
  }

  const ticket = await db.query.tickets.findFirst({
    where: and(
      eq(schema.tickets.id, params.id),
      eq(schema.tickets.tenantId, tenantId),
      eq(schema.tickets.branchId, branchId),
    ),
    with: { customer: true },
  });

  if (!ticket) notFound();
  if (ticket.status === "cancelled") {
    redirect(`/${tenantSlug}/tickets/${params.id}`);
  }

  const inventoryParts = await db
    .select({
      id: schema.ticketPartsUsed.id,
      partName: schema.inventoryItems.itemName,
      qty: schema.ticketPartsUsed.qtyUsed,
      lineTotal: schema.ticketPartsUsed.lineTotal,
    })
    .from(schema.ticketPartsUsed)
    .innerJoin(
      schema.inventoryItems,
      eq(schema.ticketPartsUsed.itemId, schema.inventoryItems.id),
    )
    .where(eq(schema.ticketPartsUsed.ticketId, params.id));

  const externalParts = await db
    .select({
      id: schema.ticketExternalParts.id,
      partName: schema.ticketExternalParts.partName,
      qty: schema.ticketExternalParts.qty,
      lineTotal: schema.ticketExternalParts.lineTotal,
    })
    .from(schema.ticketExternalParts)
    .where(eq(schema.ticketExternalParts.ticketId, params.id));

  const diagnosticFees = await db
    .select({
      id: schema.ticketDiagnosticReports.id,
      laborCost: schema.ticketDiagnosticReports.laborCost,
      technicalFindings: schema.ticketDiagnosticReports.technicalFindings,
    })
    .from(schema.ticketDiagnosticReports)
    .where(eq(schema.ticketDiagnosticReports.ticketId, params.id));

  const invoice = await db.query.invoices.findFirst({
    where: and(
      eq(schema.invoices.ticketId, params.id),
      eq(schema.invoices.tenantId, tenantId),
    ),
    with: {
      lineItems: {
        orderBy: (items, { asc }) => [asc(items.sortOrder)],
      },
    },
  });

  const allPartsTotal =
    inventoryParts.reduce((s, p) => s + Number(p.lineTotal), 0) +
    externalParts.reduce((s, p) => s + Number(p.lineTotal), 0);

  const diagnosticFee = Number(ticket.diagnosticFee ?? 0);
  const laborTotal = diagnosticFees.reduce((s, r) => s + Number(r.laborCost ?? 0), 0);

  return (
    <div>
      <Link
        href={`/${tenantSlug}/tickets/${params.id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        العودة للتيكت
      </Link>

      <div className="mx-auto mt-4 max-w-3xl">
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  فاتورة {invoice?.invoiceNumber ?? "—"}
                </h1>
                <p className="mt-0.5 text-sm text-gray-500">
                  التيكت: {ticket.ticketNumber}
                </p>
              </div>
              {invoice && <InvoiceStatusBadge status={invoice.status} />}
            </div>
          </div>

          <div className="px-6 py-5">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  العميل
                </h3>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {ticket.customer?.fullName}
                </p>
                <p className="text-sm text-gray-600">{ticket.customer?.phone}</p>
                {ticket.customer?.email && (
                  <p className="text-sm text-gray-600">{ticket.customer.email}</p>
                )}
              </div>
              <div className="text-left">
                <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  الجهاز
                </h3>
                <p className="mt-1 text-sm font-medium text-gray-900 capitalize">
                  {ticket.deviceType}
                </p>
                <p className="text-sm text-gray-600">
                  {[ticket.deviceBrand, ticket.deviceModel]
                    .filter(Boolean)
                    .join(" / ") || "—"}
                </p>
                {ticket.serialNumber && (
                  <p className="text-sm text-gray-500">S/N: {ticket.serialNumber}</p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    البيان
                    </th>
                    <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      المبلغ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inventoryParts.length > 0 && (
                    <tr>
                      <td className="py-2.5 text-gray-900">قطع من المخزن</td>
                      <td className="py-2.5 text-left text-gray-900">
                        {formatCurrency(allPartsTotal)}
                      </td>
                    </tr>
                  )}
                  {externalParts.map((p) => (
                    <tr key={`ext-${p.id}`}>
                      <td className="py-2.5 text-gray-900">
                        {p.partName}
                        <span className="mr-1.5 text-xs text-gray-400">x{p.qty}</span>
                      </td>
                      <td className="py-2.5 text-left text-gray-900">
                        {formatCurrency(p.lineTotal)}
                      </td>
                    </tr>
                  ))}
                  {diagnosticFee > 0 && (
                    <tr>
                      <td className="py-2.5 text-gray-900">رسوم الفحص</td>
                      <td className="py-2.5 text-left text-gray-900">
                        {formatCurrency(diagnosticFee)}
                      </td>
                    </tr>
                  )}
                  {diagnosticFees.length > 0 && (
                    <tr>
                      <td className="py-2.5 text-gray-900">رسوم الصيانة / الخدمة</td>
                      <td className="py-2.5 text-left text-gray-900">
                        {formatCurrency(laborTotal)}
                      </td>
                    </tr>
                  )}

                  {invoice?.lineItems
                    ?.filter(
                      (li) =>
                        li.description !== "Inventory Parts" &&
                        li.description !== "Diagnostic Fee" &&
                        li.description !== "Labor / Service Fees" &&
                        !externalParts.some(
                          (ep) => ep.partName === li.description,
                        ),
                    )
                    .map((li) => (
                      <tr key={li.id}>
                        <td className="py-2.5 text-gray-900">{li.description}</td>
                        <td className="py-2.5 text-left text-gray-900">
                          {formatCurrency(li.lineTotal)}
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  {(Number(ticket.estimatedCost ?? 0) > 0 ||
                    invoice?.discountAmount ||
                    invoice?.taxAmount) && (
                    <>
                      {Number(ticket.estimatedCost) > 0 && (
                        <tr className="border-t border-gray-200">
                          <td className="py-2.5 text-xs text-gray-500">
                            التكلفة المتوقعة
                          </td>
                          <td className="py-2.5 text-left text-xs text-gray-500">
                            {formatCurrency(ticket.estimatedCost)}
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                  {invoice && (
                    <>
                      {Number(invoice.discountAmount) > 0 && (
                        <tr className="border-t border-gray-200">
                          <td className="py-2.5 text-sm text-gray-600">
                            الخصم
                            {Number(invoice.discountPct) > 0 &&
                              ` (${invoice.discountPct}%)`}
                          </td>
                          <td className="py-2.5 text-left text-sm text-red-600">
                            -{formatCurrency(invoice.discountAmount)}
                          </td>
                        </tr>
                      )}
                      {Number(invoice.taxAmount) > 0 && (
                        <tr>
                          <td className="py-2.5 text-sm text-gray-600">
                            الضريبة
                            {Number(invoice.taxPct) > 0 &&
                              ` (${invoice.taxPct}%)`}
                          </td>
                          <td className="py-2.5 text-left text-sm text-gray-900">
                            {formatCurrency(invoice.taxAmount)}
                          </td>
                        </tr>
                      )}
                      <tr className="border-t-2 border-gray-900">
                        <td className="py-3 text-base font-bold text-gray-900">
                          الإجمالي المستحق
                        </td>
                        <td className="py-3 text-left text-base font-bold text-gray-900">
                          {formatCurrency(invoice.totalAmount)}
                        </td>
                      </tr>
                      {Number(invoice.paidAmount) > 0 && (
                        <tr>
                          <td className="py-2 text-sm text-green-700">المدفوع</td>
                          <td className="py-2 text-left text-sm font-medium text-green-700">
                            {formatCurrency(invoice.paidAmount)}
                          </td>
                        </tr>
                      )}
                      {Number(invoice.balanceDue) > 0 && (
                        <tr>
                          <td className="py-2 text-sm text-orange-700">
                            المتبقي
                          </td>
                          <td className="py-2 text-left text-sm font-medium text-orange-700">
                            {formatCurrency(invoice.balanceDue)}
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tfoot>
              </table>
            </div>

            {!invoice && (
              <div className="mt-6">
                <form
                  action={async () => {
                    "use server";
                    await generateInvoiceFromTicketAction(params.id);
                  }}
                >
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
                    </svg>
                    إنشاء الفاتورة
                  </button>
                </form>
              </div>
            )}

            {invoice && invoice.status === "issued" && (
              <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
                <h3 className="text-sm font-semibold text-green-900">
                  تحصيل الدفع
                </h3>
                <p className="mt-1 text-xs text-green-700">
                  سجل الدفع لتحديد الفاتورة كمدفوعة وإغلاق التيكت.
                </p>
                <div className="mt-3">
                  <CollectPayment
                    invoiceId={invoice.id}
                    totalAmount={Number(invoice.totalAmount)}
                  />
                </div>
              </div>
            )}

            {invoice && invoice.status === "paid" && (
              <div className="mt-6 rounded-md bg-green-50 px-4 py-3 text-center text-sm text-green-800">
                <svg className="mx-auto h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <p className="mt-1 font-medium">تم الدفع</p>
                <p className="text-xs">
                  {formatCurrency(invoice.paidAmount)} تم تحصيلها
                </p>
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          {invoice?.createdAt &&
            `صدرت ${invoice.createdAt.toLocaleDateString("en-EG", { day: "numeric", month: "long", year: "numeric" })}`}
        </p>
      </div>
    </div>
  );
}
