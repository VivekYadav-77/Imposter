export type GamePhase =
  | "task"
  | "discussion"
  | "review"
  | "voting"
  | "result"
  | "game_over"
  | "abandoned";
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
    if (state.lifeStatus === "alive" || state.role === "crew") capabilities.push("complete_task");
    if (state.role === "imposter" && state.lifeStatus === "alive") capabilities.push("kill");
  }
  if (["discussion", "review", "voting"].includes(state.phase) && state.lifeStatus === "alive")
    capabilities.push("participate_in_meeting");
  return capabilities;
}
