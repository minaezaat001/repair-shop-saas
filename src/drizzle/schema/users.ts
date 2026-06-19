import { relations } from "drizzle-orm";
import { pgTable, unique, uuid, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { branches } from "./tenants";

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  roleName: varchar("role_name", { length: 50 }).notNull(),
  description: text("description"),
  isSystem: boolean("is_system").default(false),
  priorityLevel: varchar("priority_level", { length: 10 }).default("0"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => ({
  unqTenantRole: unique("unq_tenant_role").on(t.tenantId, t.roleName),
}));

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  roleId: uuid("role_id")
    .notNull()
    .references(() => roles.id),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at", { mode: "date" }),
  pinCode: varchar("pin_code", { length: 6 }),
  locale: varchar("locale", { length: 10 }).default("ar"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { mode: "date" }),
});

export const userBranchAssignments = pgTable("user_branch_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  roleOverride: uuid("role_override").references(() => roles.id),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const rolesRelations = relations(roles, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [roles.tenantId],
    references: [tenants.id],
  }),
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
  branchAssignments: many(userBranchAssignments),
}));

export const userBranchAssignmentsRelations = relations(userBranchAssignments, ({ one }) => ({
  user: one(users, {
    fields: [userBranchAssignments.userId],
    references: [users.id],
  }),
  branch: one(branches, {
    fields: [userBranchAssignments.branchId],
    references: [branches.id],
  }),
  roleOverride: one(roles, {
    fields: [userBranchAssignments.roleOverride],
    references: [roles.id],
  }),
}));
