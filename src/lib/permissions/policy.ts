/**
 * Defines role-to-permission policy for organization-scoped CRM actions.
 * Called by tenant guards, services, and tests whenever access checks must be explicit.
 * Calls HTTP error helpers so permission failures stay centralized and reviewable.
 * A junior engineer often spreads role checks across UI files and creates invisible authorization gaps.
 */
import { MembershipRole } from "@prisma/client";
import { forbiddenError } from "@/lib/http/errors";
import { OrgRequestContext } from "@/types/context";

export const ORG_PERMISSIONS = {
  ORG_SETTINGS_MANAGE: "org.settings.manage",
  ORG_USERS_READ: "org.users.read",
  ORG_USERS_WRITE: "org.users.write",
  ORG_ROLES_MANAGE: "org.roles.manage",
  PIPELINES_MANAGE: "pipelines.manage",
  LEADS_READ: "leads.read",
  LEADS_WRITE: "leads.write",
  LEADS_ASSIGN: "leads.assign",
  LEADS_CONVERT: "leads.convert",
  CONTACTS_READ: "contacts.read",
  CONTACTS_WRITE: "contacts.write",
  DEALS_READ: "deals.read",
  DEALS_WRITE: "deals.write",
  DEALS_STAGE_MOVE: "deals.stage.move",
  ACTIVITIES_READ: "activities.read",
  ACTIVITIES_WRITE: "activities.write",
  SAVED_VIEWS_MANAGE: "saved_views.manage",
  EXPORTS_READ: "exports.read",
  EXPORTS_WRITE: "exports.write",
  REPORTS_READ: "reports.read",
  AUDIT_LOG_READ: "audit_log.read"
} as const;

export type OrgPermission = (typeof ORG_PERMISSIONS)[keyof typeof ORG_PERMISSIONS];

const allPermissions = Object.values(ORG_PERMISSIONS);

const rolePermissions: Record<MembershipRole, OrgPermission[]> = {
  ORGANIZATION_ADMIN: allPermissions,
  SALES_MANAGER: [
    ORG_PERMISSIONS.ORG_USERS_READ,
    ORG_PERMISSIONS.LEADS_READ,
    ORG_PERMISSIONS.LEADS_WRITE,
    ORG_PERMISSIONS.LEADS_ASSIGN,
    ORG_PERMISSIONS.LEADS_CONVERT,
    ORG_PERMISSIONS.CONTACTS_READ,
    ORG_PERMISSIONS.CONTACTS_WRITE,
    ORG_PERMISSIONS.DEALS_READ,
    ORG_PERMISSIONS.DEALS_WRITE,
    ORG_PERMISSIONS.DEALS_STAGE_MOVE,
    ORG_PERMISSIONS.ACTIVITIES_READ,
    ORG_PERMISSIONS.ACTIVITIES_WRITE,
    ORG_PERMISSIONS.SAVED_VIEWS_MANAGE,
    ORG_PERMISSIONS.EXPORTS_READ,
    ORG_PERMISSIONS.EXPORTS_WRITE,
    ORG_PERMISSIONS.REPORTS_READ,
    ORG_PERMISSIONS.AUDIT_LOG_READ
  ],
  SALES_REP: [
    ORG_PERMISSIONS.LEADS_READ,
    ORG_PERMISSIONS.LEADS_WRITE,
    ORG_PERMISSIONS.LEADS_CONVERT,
    ORG_PERMISSIONS.CONTACTS_READ,
    ORG_PERMISSIONS.CONTACTS_WRITE,
    ORG_PERMISSIONS.DEALS_READ,
    ORG_PERMISSIONS.DEALS_WRITE,
    ORG_PERMISSIONS.DEALS_STAGE_MOVE,
    ORG_PERMISSIONS.ACTIVITIES_READ,
    ORG_PERMISSIONS.ACTIVITIES_WRITE,
    ORG_PERMISSIONS.SAVED_VIEWS_MANAGE,
    ORG_PERMISSIONS.EXPORTS_READ,
    ORG_PERMISSIONS.EXPORTS_WRITE,
    ORG_PERMISSIONS.REPORTS_READ
  ],
  READ_ONLY: [
    ORG_PERMISSIONS.LEADS_READ,
    ORG_PERMISSIONS.CONTACTS_READ,
    ORG_PERMISSIONS.DEALS_READ,
    ORG_PERMISSIONS.ACTIVITIES_READ,
    ORG_PERMISSIONS.EXPORTS_READ,
    ORG_PERMISSIONS.REPORTS_READ,
    ORG_PERMISSIONS.AUDIT_LOG_READ
  ]
};

export function listPermissionsForRole(role: MembershipRole) {
  return rolePermissions[role];
}

export function hasOrgPermission(role: MembershipRole, permission: OrgPermission) {
  return rolePermissions[role].includes(permission);
}

export function assertOrgPermission(ctx: OrgRequestContext, permission: OrgPermission) {
  if (!hasOrgPermission(ctx.membership.role, permission)) {
    // ⚠️ SENIOR NOTE: Role checks must stay server-side. UI-only hiding is not authorization and will fail under direct API calls.
    throw forbiddenError(
      "permission_denied",
      `Role ${ctx.membership.role} cannot perform ${permission} in organization ${ctx.tenantId}.`
    );
  }
}
