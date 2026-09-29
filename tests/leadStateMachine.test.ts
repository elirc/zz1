import { describe, expect, it } from "vitest";
import { LeadStatus } from "@prisma/client";
import { AppError } from "@/lib/http/errors";
import { assertAllowedLeadTransition } from "@/services/leadService";

describe("invalid lead transitions", () => {
  it("rejects illegal lead status jumps", () => {
    // This test matters because invalid state jumps corrupt reporting and downstream workflow assumptions.
    // It catches the class of bug where a backend accepts a status patch that should only be reachable through an intermediate step.
    expect(() => assertAllowedLeadTransition(LeadStatus.NEW, LeadStatus.CONVERTED)).toThrowError(AppError);
    expect(() => assertAllowedLeadTransition(LeadStatus.NEW, LeadStatus.CONVERTED)).toThrow(
      /Lead status cannot move/
    );
  });
});
