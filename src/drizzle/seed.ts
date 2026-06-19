import "dotenv/config";
import bcrypt from "bcryptjs";
import { db, schema } from "./client";

async function seed() {
  console.log("Seeding database...\n");

  const [tenant] = await db
    .insert(schema.tenants)
    .values({
      slug: "core-repair",
      legalName: "Core Repair Academy",
      tradingName: "Core Repair",
      email: "info@corerepair.com",
      phone: "+201000000000",
      addressLine1: "1 Cairo Centre",
      city: "Cairo",
      country: "Egypt",
      currency: "EGP",
      timezone: "Africa/Cairo",
      subscriptionPlan: "growth",
      subscriptionStatus: "active",
    })
    .returning();

  console.log(`  Tenant: "${tenant.legalName}"`);

  const [role] = await db
    .insert(schema.roles)
    .values({
      tenantId: tenant.id,
      roleName: "owner",
      description: "Full system access",
      priorityLevel: "100",
      isSystem: true,
    })
    .onConflictDoNothing({ target: [schema.roles.tenantId, schema.roles.roleName] })
    .returning();

  console.log(`  Role: "${role.roleName}"`);

  const [branch] = await db
    .insert(schema.branches)
    .values({
      tenantId: tenant.id,
      branchCode: "CAIRO-MAIN",
      name: "Main Cairo Branch",
      addressLine1: "1 Cairo Centre",
      city: "Cairo",
      phone: "+201000000000",
      email: "cairo@corerepair.com",
      isHeadOffice: true,
      isActive: true,
    })
    .returning();

  console.log(`  Branch: "${branch.name}"`);

  const hash = bcrypt.hashSync("admin123", 10);

  const [user] = await db
    .insert(schema.users)
    .values({
      tenantId: tenant.id,
      email: "admin@corerepair.com",
      passwordHash: hash,
      fullName: "Super Admin",
      phone: "+201000000001",
      roleId: role.id,
      isActive: true,
      locale: "en",
    })
    .returning();

  console.log(`  User: "${user.email}" / password: admin123`);

  await db.insert(schema.userBranchAssignments).values({
    userId: user.id,
    branchId: branch.id,
    isPrimary: true,
  });

  console.log(`  User assigned to branch: "${branch.name}"`);
  console.log("\nSeeding complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("\nSeed failed:", err);
  process.exit(1);
});
