import { describe, expect, it } from "vitest";

import {
  canTransition,
  capabilitiesFor,
  determineWinner,
  playerBand,
} from "../../src/modules/games/domain.js";
import { createAssignmentPlan } from "../../src/modules/games/random.js";

function seeded(seed: number) {
  let state = seed >>> 0;
  return (upperExclusive: number) => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return Math.floor((((value ^ (value >>> 14)) >>> 0) / 4_294_967_296) * upperExclusive);
  };
}

describe("game domain policies", () => {
  it("uses the fixed player bands and rejects unsupported sizes", () => {
    for (let count = 4; count <= 7; count += 1)
      expect(playerBand(count)).toEqual({ imposters: 1, tasksPerPlayer: 3 });
    for (let count = 8; count <= 12; count += 1)
      expect(playerBand(count)).toEqual({ imposters: 2, tasksPerPlayer: 4 });
    expect(() => playerBand(3)).toThrow(RangeError);
    expect(() => playerBand(13)).toThrow(RangeError);
  });

  it("enforces the state graph", () => {
    expect(canTransition("task", "discussion")).toBe(true);
    expect(canTransition("task", "voting")).toBe(false);
    expect(canTransition("result", "task")).toBe(true);
    expect(canTransition("game_over", "task")).toBe(false);
  });

  it("uses crew-first winner precedence", () => {
    expect(
      determineWinner({
        livingCrew: 0,
        livingImposters: 0,
        totalRealTasks: 3,
        completedRealTasks: 0,
      }),
    ).toBe("crew");
    expect(
      determineWinner({
        livingCrew: 1,
        livingImposters: 1,
        totalRealTasks: 3,
        completedRealTasks: 3,
      }),
    ).toBe("crew");
    expect(
      determineWinner({
        livingCrew: 1,
        livingImposters: 1,
        totalRealTasks: 3,
        completedRealTasks: 2,
      }),
    ).toBe("imposters");
  });

  it("allows crew ghosts to work without meeting influence", () => {
    expect(
      capabilitiesFor({
        phase: "task",
        role: "crew",
        lifeStatus: "killed",
        isHost: false,
        winner: null,
      }),
    ).toEqual(["complete_task"]);
    expect(
      capabilitiesFor({
        phase: "voting",
        role: "crew",
        lifeStatus: "killed",
        isHost: false,
        winner: null,
      }),
    ).toEqual([]);
  });

  it("keeps capabilities valid for every phase, role, life, and host combination", () => {
    const phases = [
      "task",
      "discussion",
      "review",
      "voting",
      "result",
      "game_over",
      "abandoned",
    ] as const;
    const roles = ["crew", "imposter"] as const;
    const lifeStatuses = ["alive", "killed", "ejected"] as const;
    for (const phase of phases)
      for (const role of roles)
        for (const lifeStatus of lifeStatuses)
          for (const isHost of [false, true]) {
            const capabilities = capabilitiesFor({
              phase,
              role,
              lifeStatus,
              isHost,
              winner: phase === "game_over" ? "crew" : null,
            });
            if (phase === "game_over" || phase === "abandoned") expect(capabilities).toEqual([]);
            if (lifeStatus !== "alive" && role === "imposter")
              expect(capabilities).not.toContain("complete_task");
            if (lifeStatus !== "alive") {
              expect(capabilities).not.toContain("kill");
              expect(capabilities).not.toContain("participate_in_meeting");
            }
            if (role === "crew") expect(capabilities).not.toContain("kill");
          }
  });
});

describe("role and task distribution", () => {
  it("preserves all invariants over many deterministic random streams", () => {
    const tasks = Array.from({ length: 10 }, (_, index) => `task-${index}`);
    for (let count = 4; count <= 12; count += 1) {
      const band = playerBand(count);
      const participants = Array.from({ length: count }, (_, index) => `player-${index}`);
      const observedImposters = new Set<string>();
      for (let seed = 1; seed <= 200; seed += 1) {
        const plan = createAssignmentPlan(
          participants,
          tasks,
          band.imposters,
          band.tasksPerPlayer,
          seeded(seed),
        );
        const imposters = participants.filter((id) => plan.roles.get(id) === "imposter");
        expect(imposters).toHaveLength(band.imposters);
        imposters.forEach((id) => observedImposters.add(id));
        for (const participant of participants) {
          const assigned = plan.tasks.get(participant)!;
          expect(assigned).toHaveLength(band.tasksPerPlayer);
          expect(new Set(assigned).size).toBe(band.tasksPerPlayer);
          expect(assigned.every((task) => tasks.includes(task))).toBe(true);
        }
      }
      expect(observedImposters.size).toBe(count);
    }
  });
});
