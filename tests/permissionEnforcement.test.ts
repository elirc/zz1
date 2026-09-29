import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/session", () => ({
  getOptionalSession: vi.fn()
}));

import { getOptionalSession } from "@/lib/auth/session";
import { POST } from "@/app/api/org/invitations/route";

describe("permission enforcement", () => {
  it("returns 403 when a sales rep calls an org-admin invitation endpoint", async () => {
    // This test matters because hidden admin buttons in the UI do not protect the backend from direct API calls.
    // It catches the class of bug where tenant membership is checked but role-to-permission policy is skipped.
    vi.mocked(getOptionalSession).mockResolvedValue({
      userId: "user_rep",
      email: "rep@northwindcrm.dev",
      fullName: "Reese Rep",
      platformRole: "NONE",
      userStatus: "ACTIVE",
      membership: {
        membershipId: "membership_rep",
        organizationId: "org_northwind",
        organizationName: "Northwind Revenue",
        organizationStatus: "ACTIVE",
        role: "SALES_REP",
        status: "ACTIVE"
      }
    } as any);

    const request = new NextRequest("http://localhost/api/org/invitations", {
      method: "POST",
      body: JSON.stringify({
        email: "new.person@example.com",
        role: "READ_ONLY"
      }),
      headers: {
        "content-type": "application/json"
      }
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe("permission_denied");
  });
});
