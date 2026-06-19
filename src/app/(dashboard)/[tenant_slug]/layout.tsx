import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

const ROLE_AR: Record<string, string> = {
  owner: "مالك",
  manager: "مدير",
  cashier: "كاشير",
  technician: "فني",
  viewer: "مشاهد",
};

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { tenant_slug: string };
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user) {
    redirect("/login");
  }

  if (user.tenantSlug !== params.tenant_slug) {
    redirect(`/${user.tenantSlug}`);
  }

  return (
    <div dir="rtl" className="flex min-h-screen bg-gray-50">
      <aside className="flex w-64 flex-col bg-gray-900 text-white">
        <div className="flex h-14 items-center border-b border-gray-700 px-4">
          <h1 className="text-base font-semibold tracking-tight">
            Core Repair Academy
          </h1>
        </div>

        <div className="flex-1 px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            القائمة
          </p>
          <nav className="mt-2 space-y-1">
            <SidebarLink href={`/${params.tenant_slug}`}>الرئيسية</SidebarLink>
            <SidebarLink href={`/${params.tenant_slug}/tickets`}>تيكتات الصيانة</SidebarLink>
            <SidebarLink href={`/${params.tenant_slug}/pos`}>البيع المباشر (POS)</SidebarLink>
            <SidebarLink href={`/${params.tenant_slug}/inventory`}>المخزن والقطع</SidebarLink>
            <SidebarLink href={`/${params.tenant_slug}/cash-drawer`}>خزنة الوردية</SidebarLink>
          </nav>

          <p className="mt-6 text-xs font-medium uppercase tracking-wider text-gray-400">
            المحاسبة والآجل
          </p>
          <nav className="mt-2 space-y-1">
            <SidebarLink href={`/${params.tenant_slug}/suppliers`}>الموردين وحسابات الشراء</SidebarLink>
            <SidebarLink href={`/${params.tenant_slug}/customers/credit`}>ديون العملاء والتحصيل</SidebarLink>
            <SidebarLink href="#">التقارير</SidebarLink>
          </nav>
        </div>

        <div className="border-t border-gray-700 px-4 py-3">
          <p className="text-sm font-medium truncate text-left">{user.name}</p>
          <p className="text-xs text-gray-400 truncate text-left">{user.email}</p>
          <span className="mt-1 inline-block rounded bg-gray-700 px-2 py-0.5 text-xs">
            {ROLE_AR[user.roleName] ?? user.roleName}
          </span>
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        <header className="flex h-14 items-center border-b bg-white px-6">
          <p className="text-sm text-gray-500">
            الفرع: <span className="font-medium text-gray-900">الفرع الرئيسي - القاهرة</span>
          </p>
        </header>
        <div className="flex-1 p-6">{children}</div>
      </main>
    </div>
  );
}

function SidebarLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`block rounded px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-gray-800 text-white"
          : "text-gray-300 hover:bg-gray-800 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
