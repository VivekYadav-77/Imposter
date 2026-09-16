import { describe, expect, it } from "vitest";

import { createPackSchema, updatePackSchema } from "../../src/modules/task-packs/schemas.js";

describe("task-pack input validation", () => {
  it("normalizes ordered string items and trimmed metadata", () => {
    const result = createPackSchema.parse({ name: "  Office  ", items: [" First ", "Second"] });
    expect(result.name).toBe("Office");
    expect(result.items).toEqual([
      { description: "First", isActive: true },
      { description: "Second", isActive: true },
    ]);
  });

  it("rejects excessive item counts and item lengths", () => {
    expect(
      createPackSchema.safeParse({ name: "Pack", items: Array(16).fill("task") }).success,
    ).toBe(false);
    expect(createPackSchema.safeParse({ name: "Pack", items: ["x".repeat(281)] }).success).toBe(
      false,
    );
  });

  it("requires a revision and a complete mutable change", () => {
    expect(updatePackSchema.safeParse({ expectedRevision: 1 }).success).toBe(false);
    expect(updatePackSchema.safeParse({ expectedRevision: 1, items: [] }).success).toBe(true);
  });

  it("accepts task difficulty and validates complete map roles", () => {
    const result = createPackSchema.parse({
      name: "Station",
      items: [{ description: "Restart reactor", difficulty: "hard" }],
      roles: [{ name: "Engineer", specialization: "Systems", ability: "Repair one sabotage." }],
    });
    expect(result.items[0]).toMatchObject({ difficulty: "hard" });
    expect(result.roles[0].name).toBe("Engineer");
    expect(
      createPackSchema.safeParse({
        name: "Station",
        roles: [{ name: "Engineer", specialization: "", ability: "Repair" }],
      }).success,
    ).toBe(false);
  });
});
