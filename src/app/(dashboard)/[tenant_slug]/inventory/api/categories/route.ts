import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, schema } from "@/drizzle/client";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json([], { status: 401 });
  }

  const categories = await db.query.inventoryCategories.findMany({
    where: eq(schema.inventoryCategories.tenantId, session.user.tenantId),
    orderBy: (cat, { asc }) => [asc(cat.name)],
    columns: { id: true, name: true },
  });

  return NextResponse.json(categories);
}
