import { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const { db, schema } = await import("@/drizzle/client");
        const bcrypt = await import("bcryptjs");

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await db.query.users.findFirst({
          where: eq(schema.users.email, email),
          with: {
            role: true,
            tenant: true,
            branchAssignments: {
              where: (ub, { eq }) => eq(ub.isPrimary, true),
              limit: 1,
              with: { branch: true },
            },
          },
        });

        if (!user || !user.isActive || !user.tenant?.isActive) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        const primaryAssignment = user.branchAssignments[0];
        const tenantSlug = slugify(user.tenant.tradingName ?? user.tenant.legalName);

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          tenantId: user.tenantId,
          branchId: primaryAssignment?.branchId ?? "",
          roleName: user.role.roleName,
          tenantSlug,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.tenantId = user.tenantId;
        token.branchId = user.branchId;
        token.roleName = user.roleName;
        token.tenantSlug = user.tenantSlug;
      }

      if (trigger === "update" && session) {
        Object.assign(token, session);
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.tenantId = token.tenantId as string;
      session.user.branchId = token.branchId as string;
      session.user.roleName = token.roleName as string;
      session.user.tenantSlug = token.tenantSlug as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
  secret: process.env.AUTH_SECRET,
};
