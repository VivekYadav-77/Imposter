import { randomInt } from "node:crypto";

export type RandomIndex = (upperExclusive: number) => number;

export function secureShuffle<T>(values: readonly T[], randomIndex: RandomIndex = randomInt): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = randomIndex(index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function sampleDistinct<T>(
  values: readonly T[],
  count: number,
  randomIndex?: RandomIndex,
): T[] {
  if (count < 0 || count > values.length) throw new RangeError("Sample exceeds available values.");
  return secureShuffle(values, randomIndex).slice(0, count);
}

export interface AssignmentPlan<P, T> {
  roles: Map<P, "crew" | "imposter">;
  tasks: Map<P, T[]>;
}

export function createAssignmentPlan<P, T>(
  participants: readonly P[],
  tasks: readonly T[],
  imposterCount: number,
  tasksPerPlayer: number,
  randomIndex: RandomIndex = randomInt,
): AssignmentPlan<P, T> {
  if (imposterCount < 1 || imposterCount >= participants.length)
    throw new RangeError("Imposter count is invalid.");
  const shuffledPlayers = secureShuffle(participants, randomIndex);
  const imposters = new Set(shuffledPlayers.slice(0, imposterCount));
  return {
    roles: new Map(
      participants.map((participant) => [
        participant,
        imposters.has(participant) ? ("imposter" as const) : ("crew" as const),
      ]),
    ),
    tasks: new Map(
      participants.map((participant) => [
        participant,
        sampleDistinct(tasks, tasksPerPlayer, randomIndex),
      ]),
    ),
  };
}
