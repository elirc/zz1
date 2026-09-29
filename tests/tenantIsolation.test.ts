import { describe, expect, it, vi } from "vitest";
import { leadRepository } from "@/repositories/leadRepository";
import { OrgRequestContext } from "@/types/context";

describe("tenant isolation", () => {
  it("always injects organizationId into lead list queries", async () => {
    // This test matters because a single missing tenant filter can leak another customer's data without crashing.
    // It catches the class of bug where a repository method accepts ctx but forgets to apply ctx.tenantId in the final query.
    const ctx = {
      tenantId: "org_A",
      membership: {
        membershipId: "mem_A",
        organizationId: "org_A",
        organizationName: "Tenant A",
        organizationStatus: "ACTIVE",
        role: "ORGANIZATION_ADMIN",
        status: "ACTIVE"
      },
      requestId: "req_1",
      session: {
        userId: "user_A",
        email: "admin@tenant-a.dev",
        fullName: "Admin A",
        platformRole: "NONE",
        userStatus: "ACTIVE",
        membership: null
      }
    } as unknown as OrgRequestContext;

    const findMany = vi.fn().mockResolvedValue([]);
    const fakeDb = {
      lead: { findMany }
    } as any;

    await leadRepository.list(ctx, fakeDb, { status: "NEW" }, 1, 20);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org_A",
          status: "NEW"
        })
      })
    );
  });
});
