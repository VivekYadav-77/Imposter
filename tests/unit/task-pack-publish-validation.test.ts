import { describe, expect, it } from "vitest";

import { findTaskContentIssues } from "../../src/modules/task-packs/publish-validation.js";

describe("task-pack publish content validation", () => {
  it("accepts unique review-ready instructions", () => {
    expect(
      findTaskContentIssues([
        { position: 1, description: "Photograph the signal console" },
        { position: 2, description: "Find the emergency beacon" },
        { position: 3, description: "Recreate the crew warning pose" },
      ]),
    ).toEqual({ duplicateItemPositions: [], placeholderItemPositions: [] });
  });

  it("flags normalized duplicates and obvious keyboard-mash placeholders", () => {
    expect(
      findTaskContentIssues([
        { position: 1, description: "sdfsdfds" },
        { position: 2, description: "dsfsdfsdf" },
        { position: 3, description: "  SDFSDFDS  " },
      ]),
    ).toEqual({ duplicateItemPositions: [3], placeholderItemPositions: [1, 2] });
  });

  it("does not reject short labels or uppercase acronyms", () => {
    expect(
      findTaskContentIssues([
        { position: 1, description: "Lobby" },
        { position: 2, description: "CPR" },
      ]),
    ).toEqual({ duplicateItemPositions: [], placeholderItemPositions: [] });
  });
});
