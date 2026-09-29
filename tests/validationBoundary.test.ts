import { describe, expect, it } from "vitest";
import { createLeadSchema } from "@/lib/validation/leadSchemas";

describe("validation boundary", () => {
  it("rejects malformed lead creation input", () => {
    // This test matters because Zod is the last clean boundary before bad input reaches business logic and persistence.
    // It catches the class of bug where an invalid email or missing lead name would otherwise drift into partial records.
    const result = createLeadSchema.safeParse({
      name: "",
      email: "not-an-email",
      source: "WEBSITE",
      priority: "MEDIUM",
      tags: []
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toBeTruthy();
      expect(result.error.flatten().fieldErrors.email).toBeTruthy();
    }
  });
});
