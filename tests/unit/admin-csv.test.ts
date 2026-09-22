import { describe, expect, it } from "vitest";

import { downloadableTaskCsv, parseTaskCsv, sampleTaskCsv } from "../../src/client/admin/csv.js";

describe("admin task CSV import", () => {
  it("auto maps common columns and boolean values", () => {
    expect(
      parseTaskCsv("description,status\nFirst task,active\nSecond task,disabled").tasks,
    ).toEqual([
      { description: "First task", isActive: true, difficulty: "medium" },
      { description: "Second task", isActive: false, difficulty: "medium" },
    ]);
  });

  it("supports quoted commas, escaped quotes, and headerless files", () => {
    expect(
      parseTaskCsv('task,enabled\n"Find a sign, then wave",yes\n"Say ""hello""",no').tasks,
    ).toEqual([
      { description: "Find a sign, then wave", isActive: true, difficulty: "medium" },
      { description: 'Say "hello"', isActive: false, difficulty: "medium" },
    ]);
    expect(parseTaskCsv("One task\nAnother task").tasks).toHaveLength(2);
  });

  it("round-trips the downloadable template with difficulty and active values", () => {
    const result = parseTaskCsv(sampleTaskCsv);
    expect(result.tasks).toHaveLength(6);
    expect(result.tasks.map((task) => task.difficulty)).toEqual([
      "easy",
      "easy",
      "medium",
      "medium",
      "hard",
      "hard",
    ]);
    expect(result.tasks.at(-1)?.isActive).toBe(false);
    expect(downloadableTaskCsv.startsWith("\uFEFFtask_description,difficulty,active\r\n")).toBe(
      true,
    );
  });

  it("recognizes common difficulty labels and defaults unknown values to medium", () => {
    const result = parseTaskCsv(
      "description,level,active\nEasy task,beginner,yes\nHard task,difficult,yes\nOther task,custom,yes",
    );
    expect(result.tasks.map((task) => task.difficulty)).toEqual(["easy", "hard", "medium"]);
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
