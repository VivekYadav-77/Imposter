import { describe, expect, it } from "vitest";

import { parseTaskCsv } from "../../src/client/admin/csv.js";

describe("admin task CSV import", () => {
  it("auto maps common columns and boolean values", () => {
    expect(
      parseTaskCsv("description,status\nFirst task,active\nSecond task,disabled").tasks,
    ).toEqual([
      { description: "First task", isActive: true },
      { description: "Second task", isActive: false },
    ]);
  });

  it("supports quoted commas, escaped quotes, and headerless files", () => {
    expect(
      parseTaskCsv('task,enabled\n"Find a sign, then wave",yes\n"Say ""hello""",no').tasks,
    ).toEqual([
      { description: "Find a sign, then wave", isActive: true },
      { description: 'Say "hello"', isActive: false },
    ]);
    expect(parseTaskCsv("One task\nAnother task").tasks).toHaveLength(2);
  });

  it("ignores empty rows and enforces the map task limit", () => {
    const source = [
      "task",
      "",
      ...Array.from({ length: 17 }, (_, index) => `Task ${index + 1}`),
    ].join("\n");
    const result = parseTaskCsv(source);
    expect(result.tasks).toHaveLength(15);
    expect(result.ignoredRows).toBe(1);
    expect(result.truncatedRows).toBe(2);
  });
});
