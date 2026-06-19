import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password", "/portal"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPortal = pathname.split("/").includes("portal");
  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r)) || isPortal;
  const isStatic =
    pathname.startsWith("/_next") || pathname === "/favicon.ico";
  const isAuthApi = pathname.startsWith("/api/auth");

  if (isPublic || isStatic || isAuthApi) {
    return NextResponse.next();
  }

  const token = await getToken({ req });

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const parts = pathname.split("/").filter(Boolean);
  const urlTenantSlug = parts[0] ?? null;

  if (urlTenantSlug && token.tenantSlug !== urlTenantSlug) {
    const corrected = new URL(
      `/${token.tenantSlug}/${parts.slice(1).join("/")}`,
      req.url,
    );
    return NextResponse.redirect(corrected);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
