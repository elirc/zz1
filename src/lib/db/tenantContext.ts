/**
 * Centralizes tenant scope helpers used by repository functions.
 * Called by files in src/repositories and referenced by auth/tenant docs.
 * Calls HTTP error helpers so missing tenant scope fails loudly instead of leaking data quietly.
 * A junior engineer often treats organizationId as optional and accidentally leaves one query unscoped.
 */
import { forbiddenError } from "@/lib/http/errors";
import { OrgRequestContext, RequestContext } from "@/types/context";

type TenantWhere = Record<string, unknown>;

export function requireTenantContext(ctx: RequestContext): OrgRequestContext {
  if (!ctx.tenantId || !ctx.session.membership) {
    throw forbiddenError("tenant_scope_required", "This request requires an active organization context.");
  }

  return {
    ...ctx,
    membership: ctx.session.membership,
    tenantId: ctx.tenantId
  };
}

export function withTenantScope<T extends TenantWhere>(ctx: OrgRequestContext, where?: T): T & { organizationId: string } {
  return {
    ...(where ?? ({} as T)),
    organizationId: ctx.tenantId
  };
}

export function assertSameTenant(ctx: OrgRequestContext, organizationId: string) {
  if (ctx.tenantId !== organizationId) {
    // ⚠️ SENIOR NOTE: This guard exists because loading a parent record is not proof that every child record belongs to the same tenant.
    throw forbiddenError("cross_tenant_access", "Cross-tenant access is not allowed.");
  }
}
