import "next-auth";
import "next-auth/jwt";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    tenantId: string;
    branchId: string;
    roleName: string;
    tenantSlug: string;
  }

  interface Session {
    user: {
      id: string;
      tenantId: string;
      branchId: string;
      roleName: string;
      tenantSlug: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    tenantId: string;
    branchId: string;
    roleName: string;
    tenantSlug: string;
  }
}
