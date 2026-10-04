export type GamePhase =
  "task" | "discussion" | "review" | "voting" | "result" | "game_over" | "abandoned";
export type GameRole = "crew" | "imposter";
export type LifeStatus = "alive" | "killed" | "ejected";
export type Winner = "crew" | "imposters";

export interface PlayerBand {
  imposters: number;
  tasksPerPlayer: number;
}

export function playerBand(playerCount: number): PlayerBand {
  if (!Number.isInteger(playerCount) || playerCount < 4 || playerCount > 12)
    throw new RangeError("Games require between 4 and 12 players.");
  return playerCount <= 7
    ? { imposters: 1, tasksPerPlayer: 3 }
    : { imposters: 2, tasksPerPlayer: 4 };
}

export function maximumImposterCount(playerCount: number): number {
  if (!Number.isInteger(playerCount) || playerCount < 3 || playerCount > 15)
    throw new RangeError("Games require between 3 and 15 players.");
  // Always leave strictly more crew than impostors when the game begins.
  return Math.floor((playerCount - 1) / 2);
}

export function recommendedImposterCount(playerCount: number): number {
  if (playerCount <= 6) return 1;
  if (playerCount <= 10) return 2;
  return 3;
}

const transitions: Record<GamePhase, readonly GamePhase[]> = {
  task: ["discussion", "game_over", "abandoned"],
  discussion: ["review", "voting", "game_over", "abandoned"],
  review: ["voting", "game_over", "abandoned"],
  voting: ["result", "game_over", "abandoned"],
  result: ["task", "game_over", "abandoned"],
  game_over: [],
  abandoned: [],
};

export function canTransition(from: GamePhase, to: GamePhase): boolean {
  return transitions[from].includes(to);
}

export interface WinState {
  livingCrew: number;
  livingImposters: number;
  totalRealTasks: number;
  completedRealTasks: number;
}

// The order is deliberate and is the authoritative simultaneous-outcome precedence.
export function determineWinner(state: WinState): Winner | null {
  if (state.livingImposters === 0) return "crew";
  if (state.totalRealTasks > 0 && state.completedRealTasks === state.totalRealTasks) return "crew";
  if (state.livingImposters >= state.livingCrew) return "imposters";
  return null;
}

export function resolveReview(votes: readonly ("valid" | "invalid")[]): "valid" | "invalid" {
  const invalid = votes.filter((vote) => vote === "invalid").length;
  const valid = votes.length - invalid;
  return invalid > valid ? "invalid" : "valid";
}

export function resolveEjection(votes: readonly (string | null)[]): {
  targetParticipantId: string | null;
  totals: Record<string, number>;
  skip: number;
} {
  const totals: Record<string, number> = {};
  let skip = 0;
  for (const vote of votes) {
    if (vote === null) skip += 1;
    else totals[vote] = (totals[vote] ?? 0) + 1;
  }
  const entries = Object.entries(totals);
  const highest = Math.max(skip, 0, ...entries.map(([, count]) => count));
  const leaders = entries.filter(([, count]) => count === highest);
  const targetParticipantId = highest > skip && leaders.length === 1 ? leaders[0][0] : null;
  return { targetParticipantId, totals, skip };
}

function unit(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

/**
 * Manual meetings become available more slowly early in a round and when little
 * task progress has been made. The selected meeting duration is the base unit.
 */
export function meetingCooldownSeconds(
  meetingDurationSeconds: number,
  taskProgress: number,
  timeProgress: number,
): number {
  const taskRemaining = 1 - unit(taskProgress);
  const timeRemaining = 1 - unit(timeProgress);
  const multiplier = 0.75 + 0.75 * taskRemaining + 0.5 * timeRemaining;
  return Math.max(30, Math.round(meetingDurationSeconds * multiplier));
}

/**
 * The host's duration is the starting cooldown. We subtract the average of game-time
 * and crew-task completion from that base, capped at an 85% reduction. This keeps the
 * formula predictable while preventing a zero-second elimination loop.
 */
export function killCooldownSeconds(
  baseSeconds: number,
  taskProgress: number,
  timeProgress: number,
): number {
  const completed = Math.min(0.85, (unit(taskProgress) + unit(timeProgress)) / 2);
  return Math.max(5, Math.round(baseSeconds * (1 - completed)));
}

export interface CapabilityState {
  phase: GamePhase;
  role: GameRole;
  lifeStatus: LifeStatus;
  isHost: boolean;
  winner: Winner | null;
}

export function capabilitiesFor(state: CapabilityState): string[] {
  if (state.winner || state.phase === "game_over" || state.phase === "abandoned") return [];
  const capabilities: string[] = [];
  if (state.isHost) capabilities.push("end_game");
  if (state.phase === "task") {
    if (state.lifeStatus === "alive" || state.role === "crew") capabilities.push("submit_evidence");
    if (state.role === "imposter" && state.lifeStatus === "alive") capabilities.push("kill");
    if (state.lifeStatus === "alive") capabilities.push("call_meeting");
  }
  if (state.lifeStatus === "alive") capabilities.push("flag_evidence");
  if (["discussion", "review", "voting"].includes(state.phase) && state.lifeStatus === "alive")
    capabilities.push("participate_in_meeting");
  return capabilities;
}
