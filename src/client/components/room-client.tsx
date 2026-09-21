"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, createIdempotencyKey, errorMessage, participantApi } from "../api/client";
import type {
  GameSnapshot,
  PublicPackSummary,
  RealtimeMessage,
  RoomSnapshot,
  Submission,
  TransportState,
} from "../api/types";
import { RealtimeClient } from "../realtime/client";
import { isSoundEnabled, playGameSound, setSoundEnabled } from "../audio/game-sounds";
import {
  Badge,
  Banner,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  IdentityToken,
  PhaseBar,
  Progress,
  SkeletonList,
  Timer,
} from "./ui";

function initialTaskDistribution(counts: { easy: number; medium: number; hard: number }) {
  const result = { easy: 0, medium: 0, hard: 0 };
  const difficulties = ["easy", "medium", "hard"] as const;
  const target = Math.min(3, counts.easy + counts.medium + counts.hard);
  while (result.easy + result.medium + result.hard < target) {
    const before = result.easy + result.medium + result.hard;
    for (const difficulty of difficulties) {
      if (result[difficulty] < counts[difficulty]) result[difficulty] += 1;
      if (result.easy + result.medium + result.hard === target) break;
    }
    if (result.easy + result.medium + result.hard === before) break;
  }
  return result;
}

export function RoomClient() {
  const router = useRouter();
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [game, setGame] = useState<GameSnapshot | null>(null);
  const [transport, setTransport] = useState<TransportState>("connecting");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const gameRef = useRef<GameSnapshot | null>(null);
  const load = useCallback(async () => {
    setError("");
    try {
      const current = await participantApi.room();
      setRoom(current.data);
      if (current.data.gameId || current.data.status === "active") {
        const snapshot = await participantApi.snapshot();
        setGame(snapshot.data);
        gameRef.current = snapshot.data;
      }
    } catch (cause) {
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 404)) {
        setRoom(null);
      } else setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const realtime = new RealtimeClient({
      onTransport: setTransport,
      onResync: () => {
        realtime.requestResync(gameRef.current?.stateVersion ?? 0);
        void load();
      },
      onMessage: (message: RealtimeMessage) => {
        if (message.type === "room.snapshot") setRoom(message.data);
        if (message.type === "game.snapshot") {
          setGame(message.data);
          gameRef.current = message.data;
        }
        if (message.type === "presence.changed")
          setRoom((current) =>
            current
              ? {
                  ...current,
                  participants: current.participants.map((p) =>
                    p.id === message.data.participantId
                      ? { ...p, presence: message.data.presence }
                      : p,
                  ),
                }
              : current,
          );
        if (message.type === "session.revoked")
          setError("Your room session ended. Start or join a room to continue.");
      },
    });
    realtime.connect();
    return () => realtime.destroy();
  }, [load]);
  if (loading)
    return (
      <main className="game-page">
        <PhaseBar phase="lobby" />
        <div className="game-content">
          <SkeletonList />
        </div>
      </main>
    );
  if (!room)
    return (
      <main className="game-page">
        <div className="game-content">
          <EmptyState
            title="This room is unavailable"
            description={
              error || "It may have ended, expired, or your session is no longer active."
            }
            action={<Button onClick={() => router.replace("/play")}>Start or join a room</Button>}
          />
        </div>
      </main>
    );
  return (
    <main className="game-page">
      <SoundToggle />
      {transport !== "connected" && (
        <div className="connection-banner" role="status">
          {transport === "revoked" ? "Session ended" : "Reconnecting you to the room…"}
        </div>
      )}
      {error && <Banner tone="danger">{error}</Banner>}
      {game ? (
        <GameView
          game={game}
          setGame={(next) => {
            gameRef.current = next;
            setGame(next);
          }}
          room={room}
          onReplay={(nextRoom) => {
            setRoom(nextRoom);
            gameRef.current = null;
            setGame(null);
          }}
          onError={setError}
        />
      ) : (
        <LobbyView
          room={room}
          setRoom={setRoom}
          onStart={(next) => {
            gameRef.current = next;
            setGame(next);
          }}
          onError={setError}
        />
      )}
    </main>
  );
}

function SoundToggle() {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => setEnabled(isSoundEnabled()), []);
  return (
    <button
      className="sound-toggle"
      type="button"
      aria-pressed={enabled}
      aria-label={enabled ? "Mute game sounds" : "Enable game sounds"}
      title={enabled ? "Mute game sounds" : "Enable game sounds"}
      onClick={() => {
        const next = !enabled;
        setEnabled(next);
        setSoundEnabled(next);
        if (next) playGameSound("ui");
      }}
    >
      <span aria-hidden="true">{enabled ? "♪" : "×"}</span>
      <small>{enabled ? "Sound on" : "Muted"}</small>
    </button>
  );
}

function LobbyView({
  room,
  setRoom,
  onStart,
  onError,
}: {
  room: RoomSnapshot;
  setRoom: (room: RoomSnapshot) => void;
  onStart: (game: GameSnapshot) => void;
  onError: (message: string) => void;
}) {
  const [packs, setPacks] = useState<PublicPackSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [roleInfo, setRoleInfo] = useState<PublicPackSummary["roles"][number] | null>(null);
  const canSettings = room.self.capabilities.includes("change_settings");
  const canStart = room.self.capabilities.includes("start_game");
  const selectedPack = packs.find((pack) => pack.id === room.settings.selectedTaskPack?.id);
  const availableTaskCounts =
    selectedPack?.difficultyTaskCounts ??
    room.settings.selectedTaskPack?.difficultyTaskCounts ??
    room.settings.taskCounts;
  useEffect(() => {
    if (canSettings)
      participantApi
        .packs()
        .then((r) => setPacks(r.data))
        .catch((e: unknown) => onError(errorMessage(e)));
  }, [canSettings, onError]);
  const update = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      setRoom((await participantApi.updateSettings(body)).data);
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const start = async () => {
    setBusy(true);
    try {
      onStart((await participantApi.start()).data);
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const leave = async () => {
    setBusy(true);
    try {
      await participantApi.leave();
      window.location.assign("/play");
    } catch (e) {
      onError(errorMessage(e));
      setBusy(false);
    }
  };
  const copy = async () => {
    await navigator.clipboard.writeText(room.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  return (
    <>
      <PhaseBar phase="lobby" identity={room.self.nickname}>
        <button
          className="room-code"
          onClick={() => void copy()}
          aria-label={`Copy room code ${room.code}`}
        >
          <small>ROOM CODE</small>
          <strong>{room.code}</strong>
          <span>Copy</span>
        </button>
      </PhaseBar>
      <div className={`game-content lobby-layout ${canSettings ? "" : "lobby-layout-player"}`}>
        <section className="lobby-main">
          <div className="lobby-invite-card">
            <div>
              <p className="eyebrow">Invite your crew</p>
              <h1>{room.code}</h1>
              <p>Share this code. Players can join from any phone, tablet, or computer.</p>
            </div>
            <Button variant="secondary" onClick={() => void copy()}>
              {copied ? "Code copied" : "Copy room code"}
            </Button>
          </div>
          <div className="lobby-readiness">
            <div>
              <strong>
                {room.participants.length >= room.minPlayers
                  ? "Ready to start"
                  : `${room.minPlayers - room.participants.length} more needed`}
              </strong>
              <span>
                {room.participants.length} joined · minimum {room.minPlayers} · capacity {room.maxPlayers}
              </span>
            </div>
            <div
              className="readiness-track"
              role="progressbar"
              aria-label="Players needed to start"
              aria-valuemin={0}
              aria-valuemax={room.minPlayers}
              aria-valuenow={Math.min(room.participants.length, room.minPlayers)}
            >
              <span
                style={{
                  width: `${Math.min(100, (room.participants.length / room.minPlayers) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Players present</p>
              <h2>Lobby roster</h2>
            </div>
            <Badge tone="info">
              {room.participants.length}/{room.maxPlayers}
            </Badge>
          </div>
          <div className="roster-grid">
            {room.participants.map((player) => (
              <article className="roster-item" key={player.id}>
                <IdentityToken name={player.nickname} status={player.presence} />
                <div>
                  <strong title={player.nickname}>{player.nickname}</strong>
                  <span>{player.presence === "connected" ? "In the room" : "Away"}</span>
                </div>
                {player.isHost && <Badge tone="warning">Host</Badge>}
              </article>
            ))}
          </div>
        </section>
        {canSettings && (
          <aside className="settings-card">
            <div className="settings-card-heading">
              <div>
                <p className="eyebrow">Host setup</p>
                <h2>Game settings</h2>
              </div>
              <Badge tone={busy ? "warning" : "success"}>{busy ? "Saving" : "Saved"}</Badge>
            </div>
            <section className="settings-section">
              <div className="settings-section-heading">
                <span>01</span>
                <div>
                  <strong>Game basics</strong>
                  <small>Choose the map and total play time.</small>
                </div>
              </div>
              <label className="field">
              <span className="field-label">Map</span>
              <select
                value={room.settings.selectedTaskPack?.id ?? ""}
                onChange={(event) => {
                  const id = event.target.value;
                  const selected = packs.find((pack) => pack.id === id);
                  void update(
                    selected
                      ? {
                          selectedTaskPackId: selected.id,
                          taskCounts: initialTaskDistribution(selected.difficultyTaskCounts),
                        }
                      : { selectedTaskPackId: null },
                  );
                }}
                disabled={busy}
              >
                <option value="">Choose a published map</option>
                {packs.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.name} · {pack.activeTaskCount} tasks
                  </option>
                ))}
              </select>
              </label>
              <TimerSelect
                label="Game time"
                value={room.settings.taskPhaseSeconds}
                values={[300, 600, 900, 1200, 1800, 3600]}
                onChange={(value) => void update({ taskPhaseSeconds: value })}
              />
            </section>
            <section className="settings-section meeting-settings-section">
              <div className="settings-section-heading">
                <span>02</span>
                <div>
                  <strong>Meeting voting</strong>
                  <small>Pick one clear rule for ending a vote.</small>
                </div>
              </div>
              <MeetingVotingControl
                mode={room.settings.meetingVotingMode}
                duration={room.settings.meetingDurationSeconds}
                busy={busy}
                onModeChange={(mode) => void update({ meetingVotingMode: mode })}
                onDurationChange={(value) => void update({ meetingDurationSeconds: value })}
              />
            </section>
            <section className="settings-section">
              <div className="settings-section-heading">
                <span>03</span>
                <div>
                  <strong>Game balance</strong>
                  <small>Control actions, meetings, and impostors.</small>
                </div>
              </div>
            <CustomDurationField
              label="Impostor cooldown base"
              value={room.settings.imposterCooldownSeconds}
              min={10}
              max={300}
              onApply={(value) => void update({ imposterCooldownSeconds: value })}
              hint="The live cooldown subtracts the average game-time and crew-task completion from this base."
            />
            <label className="field">
              <span className="field-label">Meetings per player</span>
              <select
                value={room.settings.meetingsPerPlayer}
                disabled={busy}
                onChange={(event) => void update({ meetingsPerPlayer: Number(event.target.value) })}
              >
                {Array.from({ length: 6 }, (_, count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
              <span className="field-hint">
                Initial cooldown estimate:{" "}
                {formatDuration(room.settings.estimatedMeetingCooldownSeconds)}. It adapts to
                elapsed time and task progress.
              </span>
            </label>
            <label className="field">
              <span className="field-label">Impostors</span>
              <select
                value={room.settings.imposterCount}
                onChange={(event) => void update({ imposterCount: Number(event.target.value) })}
                disabled={busy}
              >
                {room.settings.allowedImposterCounts.map((count) => (
                  <option key={count} value={count}>
                    {count}
                    {count === 1 ? " (recommended for small rooms)" : ""}
                  </option>
                ))}
              </select>
              <span className="field-hint">
                Options keep crewmates in the majority at game start.
              </span>
            </label>
            </section>
            <details className="settings-section settings-collapsible" open>
              <summary>
                <span className="settings-section-heading">
                  <span>04</span>
                  <span>
                    <strong>Tasks per player</strong>
                    <small>{Object.values(room.settings.taskCounts).reduce((sum, count) => sum + count, 0)} tasks selected</small>
                  </span>
                </span>
                <span aria-hidden="true">⌄</span>
              </summary>
            <div className="difficulty-settings">
              {(["easy", "medium", "hard"] as const).map((difficulty) => (
                <label className="field compact-field" key={difficulty}>
                  <span className="field-label">
                    {difficulty[0].toUpperCase() + difficulty.slice(1)}
                  </span>
                  <select
                    value={room.settings.taskCounts[difficulty]}
                    disabled={
                      busy ||
                      !room.settings.selectedTaskPack ||
                      availableTaskCounts[difficulty] === 0
                    }
                    onChange={(event) =>
                      void update({
                        taskCounts: {
                          ...room.settings.taskCounts,
                          [difficulty]: Number(event.target.value),
                        },
                      })
                    }
                  >
                    {Array.from(
                      {
                        length:
                          Math.min(
                            availableTaskCounts[difficulty],
                            15 -
                              Object.entries(room.settings.taskCounts)
                                .filter(([name]) => name !== difficulty)
                                .reduce((sum, [, count]) => sum + count, 0),
                          ) + 1,
                      },
                      (_, index) => (
                        <option key={index} value={index}>
                          {index}
                        </option>
                      ),
                    )}
                  </select>
                  <span className="field-hint">
                    {availableTaskCounts[difficulty]} active on this map
                  </span>
                </label>
              ))}
            </div>
            </details>
            {room.settings.selectedTaskPack?.roles.length ? (
              <details className="settings-section settings-collapsible">
                <summary>
                  <span className="settings-section-heading">
                    <span>05</span>
                    <span>
                      <strong>Crew roles</strong>
                      <small>Optional specialist allocation</small>
                    </span>
                  </span>
                  <span aria-hidden="true">⌄</span>
                </summary>
                <div className="role-settings">
                {room.settings.selectedTaskPack.roles.map((role) => (
                  <label className="field compact-field" key={role.name}>
                    <button
                      type="button"
                      className="role-info-trigger"
                      onClick={() => setRoleInfo(role)}
                      aria-label={`About the ${role.name} role`}
                    >
                      <span>{role.name}</span>
                      <span aria-hidden="true">i</span>
                    </button>
                    <select
                      value={room.settings.roleCounts[role.name] ?? 0}
                      disabled={busy}
                      onChange={(event) =>
                        void update({
                          roleCounts: {
                            ...room.settings.roleCounts,
                            [role.name]: Number(event.target.value),
                          },
                        })
                      }
                    >
                      {Array.from(
                        {
                          length: Math.max(
                            1,
                            room.participants.length - room.settings.imposterCount + 1,
                          ),
                        },
                        (_, index) => (
                          <option key={index} value={index}>
                            {index}
                          </option>
                        ),
                      )}
                    </select>
                    <span className="field-hint">Select how many crewmates receive this role.</span>
                  </label>
                ))}
                </div>
              </details>
            ) : null}
          </aside>
        )}
      </div>
      <div className="sticky-actions">
        {canStart ? (
          <>
            <span className="action-note">
              {room.settings.selectedTaskPack
                ? room.participants.length >= room.minPlayers
                  ? `${room.participants.length} players ready · minimum ${room.minPlayers}`
                  : `${room.minPlayers - room.participants.length} more player${room.minPlayers - room.participants.length === 1 ? "" : "s"} needed`
                : "Choose a map before starting."}
            </span>
            <Button
              loading={busy}
              disabled={
                !room.settings.selectedTaskPack || room.participants.length < room.minPlayers
              }
              onClick={() => void start()}
            >
              Start game
            </Button>
          </>
        ) : (
          <span className="waiting-copy">Waiting for the host to start…</span>
        )}
        <Button variant="ghost" onClick={() => setLeaving(true)}>
          Leave room
        </Button>
      </div>
      <ConfirmDialog
        open={leaving}
        onClose={() => setLeaving(false)}
        onConfirm={() => void leave()}
        title="Leave this room?"
        description="Your place in the room will be released. If you are host, hosting may transfer."
        confirmLabel="Leave room"
        dangerous
        loading={busy}
      />
      <Dialog
        open={Boolean(roleInfo)}
        title={roleInfo?.name ?? "Crew role"}
        onClose={() => setRoleInfo(null)}
      >
        <div className="role-detail-grid">
          <div>
            <span>Specialization</span>
            <strong>{roleInfo?.specialization}</strong>
          </div>
          <div>
            <span>Ability</span>
            <strong>{roleInfo?.ability}</strong>
          </div>
        </div>
      </Dialog>
    </>
  );
}

function TimerSelect({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: number;
  values: number[];
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {values.map((seconds) => (
          <option value={seconds} key={seconds}>
            {seconds >= 60 ? `${seconds / 60} min` : `${seconds} sec`}
          </option>
        ))}
      </select>
    </label>
  );
}

function MeetingVotingControl({
  mode,
  duration,
  busy,
  onModeChange,
  onDurationChange,
}: {
  mode: "timed" | "all_voted";
  duration: number;
  busy: boolean;
  onModeChange: (mode: "timed" | "all_voted") => void;
  onDurationChange: (seconds: number) => void;
}) {
  const [draft, setDraft] = useState(String(duration));
  useEffect(() => setDraft(String(duration)), [duration]);
  const parsed = Number(draft);
  const valid = Number.isInteger(parsed) && parsed >= 30 && parsed <= 1800;
  const presets = [60, 90, 120, 180, 300, 600, 900];
  return (
    <div className="meeting-rule-control">
      <div className="meeting-mode-grid" role="radiogroup" aria-label="Meeting voting rule">
        <button
          type="button"
          role="radio"
          aria-checked={mode === "timed"}
          className={mode === "timed" ? "selected" : ""}
          disabled={busy}
          onClick={() => onModeChange("timed")}
        >
          <span className="meeting-mode-icon" aria-hidden="true">◷</span>
          <strong>Timed vote</strong>
          <small>Ends when everyone votes or time runs out.</small>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "all_voted"}
          className={mode === "all_voted" ? "selected" : ""}
          disabled={busy}
          onClick={() => onModeChange("all_voted")}
        >
          <span className="meeting-mode-icon" aria-hidden="true">✓</span>
          <strong>Wait for everyone</strong>
          <small>No timer. Every living player must vote.</small>
        </button>
      </div>
      {mode === "timed" && (
        <div className="meeting-duration-editor">
          <div className="field-label-row">
            <span className="field-label">Voting time</span>
            <strong>{formatDuration(duration)}</strong>
          </div>
          <div className="duration-presets" aria-label="Quick voting time choices">
            {presets.map((seconds) => (
              <button
                type="button"
                key={seconds}
                className={duration === seconds ? "selected" : ""}
                disabled={busy}
                onClick={() => onDurationChange(seconds)}
              >
                {seconds < 60 ? `${seconds}s` : `${seconds / 60}m`}
              </button>
            ))}
          </div>
          <label className="meeting-custom-time">
            <span>Custom</span>
            <input
              type="number"
              min={30}
              max={1800}
              step={5}
              value={draft}
              disabled={busy}
              aria-invalid={!valid}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && valid && parsed !== duration) {
                  event.preventDefault();
                  onDurationChange(parsed);
                }
              }}
            />
            <span>seconds</span>
            <Button
              variant="secondary"
              disabled={busy || !valid || parsed === duration}
              onClick={() => onDurationChange(parsed)}
            >
              Set
            </Button>
          </label>
          <small className="field-hint">Choose a preset or enter 30–1800 seconds.</small>
        </div>
      )}
    </div>
  );
}

function CustomDurationField({
  label,
  value,
  min,
  max,
  onApply,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onApply: (value: number) => void;
  hint?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const parsed = Number(draft);
  const valid = Number.isInteger(parsed) && parsed >= min && parsed <= max;
  return (
    <label className="field custom-duration-field">
      <span className="field-label">{label}</span>
      <span className="duration-input-row">
        <input
          type="number"
          min={min}
          max={max}
          step={5}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-invalid={!valid}
        />
        <span>seconds</span>
        <Button
          variant="secondary"
          disabled={!valid || parsed === value}
          onClick={() => onApply(parsed)}
        >
          Apply
        </Button>
      </span>
      <span className="field-hint">
        {hint ?? `Choose any whole number from ${min} to ${max} seconds.`}
      </span>
    </label>
  );
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${remainder ? `${remainder}s` : ""}`.trim() : `${seconds}s`;
}

function GameView({
  game,
  setGame,
  room,
  onReplay,
  onError,
}: {
  game: GameSnapshot;
  setGame: (game: GameSnapshot) => void;
  room: RoomSnapshot;
  onReplay: (room: RoomSnapshot) => void;
  onError: (message: string) => void;
}) {
  const [roleAcknowledged, setRoleAcknowledged] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const previousPhase = useRef(game.phase);
  const previousLifeStatus = useRef(game.self.lifeStatus);
  const previousProgress = useRef(game.progress.percent);
  const terminalSoundPlayed = useRef(false);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) setRevealed(false);
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", hide);
    };
  }, []);
  useEffect(() => {
    if (!roleAcknowledged) return;
    if (previousLifeStatus.current === "alive" && game.self.lifeStatus !== "alive")
      playGameSound("eliminated");
    if (game.progress.percent > previousProgress.current) playGameSound("task-complete");
    if (previousPhase.current !== game.phase) {
      if (["discussion", "review"].includes(game.phase)) playGameSound("meeting");
      else if (game.phase === "voting") playGameSound("vote");
      else if (game.phase === "result") playGameSound("result");
    }
    if (
      (game.phase === "game_over" || game.phase === "abandoned") &&
      !terminalSoundPlayed.current
    ) {
      const selfWon =
        (game.winner === "crew" && game.self.role === "crew") ||
        (game.winner === "imposters" && game.self.role === "imposter");
      window.setTimeout(() => playGameSound(selfWon ? "victory" : "defeat"), 480);
      terminalSoundPlayed.current = true;
    }
    previousPhase.current = game.phase;
    previousLifeStatus.current = game.self.lifeStatus;
    previousProgress.current = game.progress.percent;
  }, [game, roleAcknowledged]);
  if (!roleAcknowledged)
    return (
      <RoleReveal
        role={game.self.role}
        crewRole={game.self.crewRole}
        revealed={revealed}
        setRevealed={setRevealed}
        onContinue={() => {
          if (game.phase !== "game_over" && game.phase !== "abandoned")
            playGameSound(game.self.role === "crew" ? "role-crew" : "role-imposter");
          setRevealed(false);
          setRoleAcknowledged(true);
        }}
      />
    );
  if (game.phase === "game_over" || game.phase === "abandoned")
    return <TerminalView game={game} room={room} onReplay={onReplay} onError={onError} />;
  if (game.phase === "task")
    return <TaskView game={game} setGame={setGame} room={room} onError={onError} />;
  return <MeetingView game={game} setGame={setGame} room={room} onError={onError} />;
}

function RoleReveal({
  role,
  crewRole,
  revealed,
  setRevealed,
  onContinue,
}: {
  role: "crew" | "imposter";
  crewRole: GameSnapshot["self"]["crewRole"];
  revealed: boolean;
  setRevealed: (value: boolean) => void;
  onContinue: () => void;
}) {
  return (
    <section className="role-screen">
      <p className="eyebrow">Private briefing</p>
      <div className={`role-card ${revealed ? "revealed" : "sealed"}`}>
        <span className="seal-mark" aria-hidden="true">
          ◉
        </span>
        {revealed ? (
          <div>
            <p>Your role</p>
            <h1>{role === "crew" ? "CREW" : "IMPOSTER"}</h1>
            <p>
              {role === "crew"
                ? "Complete your tasks. Watch everyone."
                : "Blend in. Eliminate quietly."}
            </p>
            {role === "crew" && crewRole && (
              <div className="crew-role-brief">
                <strong>{crewRole.name}</strong>
                <span>{crewRole.specialization}</span>
                <small>{crewRole.ability}</small>
              </div>
            )}
          </div>
        ) : (
          <div>
            <h1>SEALED</h1>
            <p>Keep this screen to yourself.</p>
          </div>
        )}
      </div>
      <Button
        className="reveal-button"
        variant={revealed ? "secondary" : "primary"}
        onPointerDown={() => setRevealed(true)}
        onPointerUp={() => setRevealed(false)}
        onPointerCancel={() => setRevealed(false)}
        onClick={() => setRevealed(!revealed)}
      >
        {revealed ? "Hide role" : "Press and hold to reveal"}
      </Button>
      <Button variant="ghost" disabled={!revealed} onClick={onContinue}>
        I understand
      </Button>
      <p className="privacy-note">Your role will hide if you switch apps or lock your phone.</p>
    </section>
  );
}

function TaskView({
  game,
  setGame,
  room,
  onError,
}: {
  game: GameSnapshot;
  setGame: (game: GameSnapshot) => void;
  room: RoomSnapshot;
  onError: (message: string) => void;
}) {
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [killTarget, setKillTarget] = useState<string | null>(null);
  const [gallery, setGallery] = useState(false);
  const [roleInfo, setRoleInfo] = useState(false);
  const [confirmMeeting, setConfirmMeeting] = useState(false);
  const [meetingBusy, setMeetingBusy] = useState(false);
  const [covertOpen, setCovertOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const selected = game.assignments.find((task) => task.id === assignmentId);
  const killReady =
    !game.cooldowns.killAvailableAt || new Date(game.cooldowns.killAvailableAt).getTime() <= now;
  const killWasReady = useRef(killReady);
  useEffect(() => {
    if (!killWasReady.current && killReady && game.self.role === "imposter")
      playGameSound("cooldown-ready");
    killWasReady.current = killReady;
  }, [game.self.role, killReady]);
  const canKill = game.self.capabilities.includes("kill") && killReady;
  const meetingReady =
    (!game.cooldowns.meetingAvailableAt ||
      new Date(game.cooldowns.meetingAvailableAt).getTime() <= now) &&
    game.meetingRules.hasCompletedTask &&
    game.meetingRules.remainingForSelf > 0 &&
    game.self.lifeStatus === "alive";
  const kill = async () => {
    if (!killTarget) return;
    try {
      setGame((await participantApi.kill(killTarget, game.stateVersion)).data);
      playGameSound("kill");
      setKillTarget(null);
    } catch (e) {
      onError(errorMessage(e));
      setKillTarget(null);
    }
  };
  const callMeeting = async () => {
    setMeetingBusy(true);
    try {
      setGame((await participantApi.callMeeting(game.stateVersion)).data);
      setConfirmMeeting(false);
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setMeetingBusy(false);
    }
  };
  const roleDetails =
    game.self.role === "imposter"
      ? {
          name: "Imposter",
          specialization: "Deception",
          ability: "Quietly eliminate living players while blending in with the crew.",
        }
      : (game.self.crewRole ?? {
          name: "Crew",
          specialization: "Task operations",
          ability: "Complete assignments, call meetings, and identify every imposter.",
        });
  return (
    <>
      <PhaseBar phase="tasks" identity={room.self.nickname}>
        <div className="header-game-status">
          <Progress value={game.progress.percent} max={100} label="Crew progress" />
          <Timer deadline={game.phaseDeadlineAt} label="Task time" />
        </div>
      </PhaseBar>
      <div className="game-content narrow">
        <section className="live-identity-card">
          <IdentityToken name={room.self.nickname} status="connected" />
          <div>
            <span>Playing as</span>
            <strong>{room.self.nickname}</strong>
            <small>{roleDetails.name}</small>
          </div>
          <button
            className="info-button"
            onClick={() => setRoleInfo(true)}
            aria-label="View role details"
          >
            i
          </button>
        </section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{game.taskPack.name}</p>
            <h1>{game.self.lifeStatus === "alive" ? "Your assignments" : "Ghost assignments"}</h1>
          </div>
          <Button variant="ghost" onClick={() => setGallery(true)}>
            Evidence
          </Button>
        </div>
        {game.self.lifeStatus !== "alive" && (
          <section className="eliminated-banner" role="status" aria-live="polite">
            <span className="eliminated-mark" aria-hidden="true">
              ✕
            </span>
            <div>
              <p className="eyebrow">Status update</p>
              <h2>
                {game.self.lifeStatus === "killed" ? "You were eliminated" : "You were ejected"}
              </h2>
              <p>
                Stay silent about what you saw. You can still finish ghost assignments, but you can
                no longer vote or call meetings.
              </p>
            </div>
            <Badge tone="danger">Ghost mode</Badge>
          </section>
        )}
        <div className="task-list">
          {game.assignments.map((task, index) => (
            <button
              className={`task-card ${task.status === "completed" ? "task-complete" : ""}`}
              key={task.id}
              onClick={() => setAssignmentId(task.id)}
            >
              <span className="task-number">{String(index + 1).padStart(2, "0")}</span>
              <span>
                <strong>{task.description}</strong>
                <small>{task.difficulty[0].toUpperCase() + task.difficulty.slice(1)} task</small>
                <small>
                  {task.status === "completed"
                    ? "Proof submitted · processing may still reopen this task"
                    : "Open to add photo proof"}
                </small>
              </span>
              <Badge tone={task.status === "completed" ? "success" : "warning"}>
                {task.status === "completed" ? "Submitted" : "To do"}
              </Badge>
            </button>
          ))}
        </div>
        {game.self.role === "imposter" && game.self.lifeStatus === "alive" && (
          <section className={`covert-console ${covertOpen ? "is-open" : ""}`}>
            {!covertOpen ? (
              <button className="covert-cover" onClick={() => setCovertOpen(true)}>
                <span aria-hidden="true">◌</span>
                <strong>Private utility</strong>
                <small>Tap to unlock · shield this screen</small>
              </button>
            ) : (
              <>
                <div className="covert-console-heading">
                  <div>
                    <p className="eyebrow">Impostor console</p>
                    <h2>{canKill ? "Target acquisition" : "Systems recharging"}</h2>
                  </div>
                  <button className="covert-lock" onClick={() => setCovertOpen(false)}>
                    Lock
                  </button>
                </div>
                {!killReady && game.cooldowns.killAvailableAt && (
                  <Timer deadline={game.cooldowns.killAvailableAt} label="Available in" />
                )}
                <label className="field target-select-field">
                  <span className="field-label">Living crew target</span>
                  <select
                    value={killTarget ?? ""}
                    disabled={!canKill}
                    onChange={(event) => setKillTarget(event.target.value || null)}
                  >
                    <option value="">Select one crew member…</option>
                    {game.participants
                      .filter((player) => game.self.killableParticipantIds.includes(player.id))
                      .map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.nickname}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="elimination-ledger">
                  <span>Your eliminations</span>
                  {game.self.knownEliminatedParticipantIds.length ? (
                    <div>
                      {game.self.knownEliminatedParticipantIds.map((id) => (
                        <Badge key={id} tone="danger">
                          {game.participants.find((player) => player.id === id)?.nickname ??
                            "Unknown"}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <small>No confirmed eliminations</small>
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </div>
      <aside className="meeting-action-rail">
        <Button
          variant="secondary"
          disabled={!meetingReady}
          onClick={() => setConfirmMeeting(true)}
          title={
            !game.meetingRules.hasCompletedTask
              ? "Complete one task first"
              : game.meetingRules.remainingForSelf === 0
                ? "No meetings remaining"
                : !meetingReady
                  ? "Meeting cooldown active"
                  : "Call a meeting"
          }
        >
          Call meeting
        </Button>
        <small>{game.meetingRules.remainingForSelf} remaining</small>
        {!meetingReady && game.cooldowns.meetingAvailableAt && (
          <Timer deadline={game.cooldowns.meetingAvailableAt} label="Available in" />
        )}
      </aside>
      <UploadDialog
        open={Boolean(selected)}
        assignment={selected ?? null}
        game={game}
        setGame={setGame}
        onClose={() => setAssignmentId(null)}
        onError={onError}
      />
      <EvidenceGallery
        open={gallery}
        onClose={() => setGallery(false)}
        game={game}
        onError={onError}
      />
      <ConfirmDialog
        open={Boolean(killTarget)}
        onClose={() => setKillTarget(null)}
        onConfirm={() => void kill()}
        title="Eliminate this player?"
        description={`Only the eliminated player will be notified. Your next elimination is available after the ${formatDuration(game.cooldowns.killCooldownSeconds)} adaptive cooldown.`}
        confirmLabel="Eliminate player"
        dangerous
      />
      <ConfirmDialog
        open={confirmMeeting}
        onClose={() => setConfirmMeeting(false)}
        onConfirm={() => void callMeeting()}
        title="Call a meeting?"
        description={`${game.meetingRules.votingMode === "all_voted" ? "Voting stays open until every living player votes." : `Voting will open for ${formatDuration(game.meetingRules.durationSeconds)}.`} You will have ${Math.max(0, game.meetingRules.remainingForSelf - 1)} meeting calls left.`}
        confirmLabel="Open meeting"
        loading={meetingBusy}
      />
      <Dialog open={roleInfo} title={roleDetails.name} onClose={() => setRoleInfo(false)}>
        <div className="role-detail-grid">
          <div>
            <span>Specialization</span>
            <strong>{roleDetails.specialization}</strong>
          </div>
          <div>
            <span>Ability</span>
            <strong>{roleDetails.ability}</strong>
          </div>
        </div>
      </Dialog>
    </>
  );
}

function UploadDialog({
  open,
  assignment,
  game,
  setGame,
  onClose,
  onError,
}: {
  open: boolean;
  assignment: GameSnapshot["assignments"][number] | null;
  game: GameSnapshot;
  setGame: (game: GameSnapshot) => void;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "uploading" | "processing" | "done">("idle");
  const [policy, setPolicy] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (!open) {
      setFile(null);
      setState("idle");
      setPolicy("");
    }
  }, [open]);
  if (!assignment) return null;
  const upload = async () => {
    if (!file) return;
    setState("uploading");
    try {
      const intent = (
        await participantApi.uploadIntent(
          assignment.id,
          file,
          game.stateVersion,
          createIdempotencyKey(),
        )
      ).data;
      setPolicy(intent.policy.notice);
      const response = await fetch(intent.url, {
        method: intent.method,
        headers: intent.headers,
        body: file,
      });
      if (!response.ok) throw new Error("Storage upload failed");
      setState("processing");
      await participantApi.confirmUpload(
        assignment.id,
        intent.uploadId,
        game.stateVersion,
        createIdempotencyKey(),
      );
      const latest = await participantApi.snapshot();
      setGame(latest.data);
      playGameSound("upload");
      setState("done");
    } catch (e) {
      onError(errorMessage(e));
      setState("idle");
    }
  };
  return (
    <Dialog open={open} title="Submit task evidence" onClose={onClose}>
      <p className="task-description">{assignment.description}</p>
      <p className="muted">
        Get the whole task in frame. Confirmation completes it provisionally; processing can reject
        the image and reopen the task.
      </p>
      {file && previewUrl && (
        <div className="selected-file-preview">
          <img className="upload-preview" src={previewUrl} alt="Selected evidence thumbnail" />
          <Button variant="secondary" onClick={() => setPreviewOpen(true)}>
            Preview image
          </Button>
        </div>
      )}
      {policy && <Banner tone="info">{policy}</Banner>}
      {state === "processing" || state === "done" ? (
        <div className="processing-state">
          <span className="scan-line" />
          <h3>{state === "done" ? "Proof submitted" : "Confirming proof…"}</h3>
          <p>
            {state === "done"
              ? "It remains provisional until media processing finishes."
              : "Keep this page open for a moment."}
          </p>
        </div>
      ) : (
        <>
          <label className="file-picker">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <span>{file ? "Choose another photo" : "Take or choose a photo"}</span>
            <small>JPEG, PNG or WebP · maximum 5 MB</small>
          </label>
          <div className="dialog-actions">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => void upload()}
              loading={state === "uploading"}
              disabled={!file || (file?.size ?? 0) > 5_242_880}
            >
              Upload proof
            </Button>
          </div>
        </>
      )}
      {state === "done" && <Button onClick={onClose}>Back to tasks</Button>}
      <ImagePreview
        open={previewOpen}
        src={previewUrl}
        alt="Selected task evidence"
        onClose={() => setPreviewOpen(false)}
      />
    </Dialog>
  );
}

function EvidenceGallery({
  open,
  onClose,
  game,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  game: GameSnapshot;
  onError: (message: string) => void;
}) {
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [flagId, setFlagId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ src: string; alt: string } | null>(null);
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    participantApi
      .submissions()
      .then((r) => setItems(r.data))
      .catch((e: unknown) => onError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [open, onError]);
  const flag = async () => {
    if (!flagId) return;
    try {
      await participantApi.flag(flagId, game.stateVersion, null);
      setItems((current) =>
        current.map((item) =>
          item.id === flagId ? { ...item, flaggedBySelf: true, reviewStatus: "flagged" } : item,
        ),
      );
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setFlagId(null);
    }
  };
  return (
    <Dialog open={open} title="Room evidence" onClose={onClose}>
      {loading ? (
        <SkeletonList />
      ) : items.length === 0 ? (
        <EmptyState
          title="No evidence yet"
          description="Accepted room photos will appear here when the server makes them available."
        />
      ) : (
        <div className="evidence-grid">
          {items.map((item) => (
            <article className="evidence-card" key={item.id}>
              {item.image ? (
                <>
                  <img
                    src={item.image.url}
                    alt={`Evidence submitted by ${item.uploader.nickname}`}
                  />
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setPreview({
                        src: item.image!.url,
                        alt: `Evidence submitted by ${item.uploader.nickname}`,
                      })
                    }
                  >
                    Preview image
                  </Button>
                </>
              ) : (
                <div className="image-placeholder">{item.processingStatus}</div>
              )}
              <div>
                <strong>{item.uploader.nickname}</strong>
                <Badge
                  tone={
                    item.processingStatus === "accepted"
                      ? "success"
                      : item.processingStatus === "rejected"
                        ? "danger"
                        : "warning"
                  }
                >
                  {item.processingStatus}
                </Badge>
              </div>
              {game.self.capabilities.includes("flag_evidence") &&
                item.uploader.id !== game.self.participantId &&
                !item.flaggedBySelf && (
                  <Button variant="ghost" onClick={() => setFlagId(item.id)}>
                    Flag for review
                  </Button>
                )}
            </article>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(flagId)}
        onClose={() => setFlagId(null)}
        onConfirm={() => void flag()}
        title="Flag this photo?"
        description="The room may review it during the next meeting. You cannot flag your own evidence."
        confirmLabel="Flag photo"
        dangerous
      />
      <ImagePreview
        open={Boolean(preview)}
        src={preview?.src ?? null}
        alt={preview?.alt ?? "Evidence preview"}
        onClose={() => setPreview(null)}
      />
    </Dialog>
  );
}

function ImagePreview({
  open,
  src,
  alt,
  onClose,
}: {
  open: boolean;
  src: string | null;
  alt: string;
  onClose: () => void;
}) {
  if (!open || !src) return null;
  return (
    <div
      className="image-preview-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={onClose}
    >
      <div className="image-preview-modal" onClick={(event) => event.stopPropagation()}>
        <button className="image-preview-close" onClick={onClose} aria-label="Close image preview">
          ×
        </button>
        <img src={src} alt={alt} />
      </div>
    </div>
  );
}

function MeetingView({
  game,
  setGame,
  room,
  onError,
}: {
  game: GameSnapshot;
  setGame: (game: GameSnapshot) => void;
  room: RoomSnapshot;
  onError: (message: string) => void;
}) {
  const meeting = game.meeting;
  const [vote, setVote] = useState<string | null>(null);
  const [reviewVote, setReviewVote] = useState<"valid" | "invalid" | null>(null);
  const [busy, setBusy] = useState(false);
  if (!meeting)
    return (
      <>
        <PhaseBar phase="meeting" identity={room.self.nickname} />
        <div className="game-content">
          <EmptyState
            title="Meeting is syncing"
            description="The authoritative meeting record is not available yet."
          />
        </div>
      </>
    );
  const submitVote = async () => {
    if (vote === null) return;
    setBusy(true);
    try {
      await participantApi.ejectionVote(
        meeting.id,
        vote === "skip" ? null : vote,
        game.stateVersion,
      );
      const latest = await participantApi.snapshot();
      setGame(latest.data);
      playGameSound("vote");
      setVote(null);
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const submitReview = async () => {
    const id = meeting.reviewItem?.id;
    if (!id || !reviewVote) return;
    setBusy(true);
    try {
      await participantApi.reviewVote(id, reviewVote, game.stateVersion);
      const latest = await participantApi.snapshot();
      setGame(latest.data);
      playGameSound("vote");
      setReviewVote(null);
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const reported = game.participants.find((p) => p.id === meeting.reportedParticipantId);
  const canVote = meeting.capabilities.includes("vote_ejection");
  return (
    <>
      <PhaseBar
        phase={game.phase === "result" ? "results" : "meeting"}
        identity={room.self.nickname}
      >
        {game.phaseDeadlineAt || meeting.deadlineAt ? (
          <Timer
            deadline={game.phaseDeadlineAt ?? meeting.deadlineAt}
            label={game.phase === "result" ? "Returning soon" : "Meeting time"}
          />
        ) : (
          <Badge tone="info">Waiting for every vote</Badge>
        )}
      </PhaseBar>
      <div className="game-content narrow meeting-view">
        <p className="eyebrow">Meeting {meeting.sequenceNumber}</p>
        <h1>
          {game.phase === "discussion"
            ? meeting.triggerType === "kill"
              ? "A player was eliminated"
              : meeting.triggerType === "user_called"
                ? "Meeting called"
                : "Time’s up"
            : game.phase === "review"
              ? "Review the evidence"
              : game.phase === "voting"
                ? "Who do you trust least?"
                : "Room decision"}
        </h1>
        {game.phase === "discussion" && (
          <>
            <p className="lead">
              {meeting.triggerType === "kill"
                ? `${reported?.nickname ?? "A player"} is out. Gather and talk face to face.`
                : "The task window closed. Gather and talk face to face."}
            </p>
            <Banner tone="info">This app does not record or carry your conversation.</Banner>
          </>
        )}
        {game.phase === "review" && (
          <section className="review-card">
            {meeting.reviewItem?.image?.url ? (
              <img src={meeting.reviewItem.image.url} alt="Evidence under review" />
            ) : (
              <div className="image-placeholder">Evidence under review</div>
            )}
            <h2>{meeting.reviewItem?.description ?? "Is this evidence valid?"}</h2>
            <p className="muted">
              Submitted by {meeting.reviewItem?.uploader?.nickname ?? "a room participant"}
            </p>
            {meeting.capabilities.includes("participate_in_meeting") && (
              <div className="choice-grid">
                <button
                  className={reviewVote === "valid" ? "selected" : ""}
                  onClick={() => setReviewVote("valid")}
                >
                  Valid proof
                </button>
                <button
                  className={reviewVote === "invalid" ? "selected danger-choice" : "danger-choice"}
                  onClick={() => setReviewVote("invalid")}
                >
                  Invalid proof
                </button>
              </div>
            )}
          </section>
        )}
        {game.phase === "voting" && (
          <>
            {game.meetingRules.votingMode === "all_voted" && (
              <Banner tone="info">
                No timer is running. This meeting resolves after every eligible living player votes.
              </Banner>
            )}
            <p className="lead">
              {canVote
                ? "Vote to eject, or skip if you’re not sure. You can replace your vote until voting locks."
                : "You can observe this meeting, but dead and eliminated players cannot vote."}
            </p>
            <div className="voting-grid">
              {meeting.eligibleParticipants.map((player) => (
                <button
                  key={player.id}
                  className={vote === player.id ? "voting-option selected" : "voting-option"}
                  disabled={!canVote}
                  onClick={() => setVote(player.id)}
                >
                  <IdentityToken name={player.nickname} />
                  <strong>{player.nickname}</strong>
                </button>
              ))}
              <button
                className={vote === "skip" ? "voting-option selected" : "voting-option"}
                disabled={!canVote}
                onClick={() => setVote("skip")}
              >
                <span className="skip-icon">—</span>
                <strong>Skip</strong>
              </button>
            </div>
            <p className="vote-count">
              {meeting.votesCast} vote{meeting.votesCast === 1 ? "" : "s"} cast
            </p>
          </>
        )}
        {game.phase === "result" && <ResultBlock game={game} />}
      </div>
      {game.phase === "review" && reviewVote && (
        <div className="sticky-actions">
          <Button loading={busy} onClick={() => void submitReview()}>
            Confirm {reviewVote} vote
          </Button>
        </div>
      )}
      {game.phase === "voting" && vote && canVote && (
        <div className="sticky-actions">
          <Button loading={busy} onClick={() => void submitVote()}>
            Confirm {vote === "skip" ? "skip" : "ejection vote"}
          </Button>
        </div>
      )}
    </>
  );
}

function ResultBlock({ game }: { game: GameSnapshot }) {
  const result = game.meeting?.result;
  const ejected = game.participants.find((p) => p.id === result?.ejectedParticipantId);
  return (
    <section className="result-card elimination-reveal" aria-live="assertive">
      <span className="stamp">DECISION</span>
      <h2>{ejected ? `${ejected.nickname} was ejected` : "No one was ejected"}</h2>
      <p>Roles remain private. The game will continue from the authoritative server state.</p>
    </section>
  );
}

function TerminalView({
  game,
  room,
  onReplay,
  onError,
}: {
  game: GameSnapshot;
  room: RoomSnapshot;
  onReplay: (room: RoomSnapshot) => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [easterEgg, setEasterEgg] = useState(0);
  const won =
    game.winner === "crew"
      ? "Crew wins"
      : game.winner === "imposters"
        ? "Imposters win"
        : "Room ended";
  return (
    <>
      <PhaseBar phase="results" />
      <div className="game-content">
        <section className="terminal-card">
          <span className="stamp">CASE CLOSED</span>
          <p className="eyebrow">Final outcome</p>
          <h1>{won}</h1>
          <p>
            {game.winner === "crew"
              ? "Every imposter has been found."
              : game.winner === "imposters"
                ? "The room never caught on."
                : "This game was abandoned before a winner was decided."}
          </p>
          <p className="privacy-note">
            Other players’ roles and individual ballots remain private.
          </p>
          <button
            className={`orbit-crewmate ${easterEgg >= 3 ? "hatched" : ""}`}
            aria-label="A suspicious tiny crewmate"
            onClick={() =>
              setEasterEgg((count) => {
                if (count === 2) playGameSound("easter-egg");
                else playGameSound("ui");
                return Math.min(3, count + 1);
              })
            }
          >
            {easterEgg >= 3 ? "ඞ" : "◒"}
          </button>
          {easterEgg >= 3 && (
            <div className="easter-egg" role="status">
              <span>✦</span> The smallest crewmate was suspicious all along. <span>✦</span>
            </div>
          )}
          <div className="replay-panel">
            <h2>{room.self.isHost ? "Play again with this room?" : "Rejoin this room?"}</h2>
            <p>
              {room.self.isHost
                ? "Yes returns you to the lobby settings with the same room code and crew."
                : "Yes keeps your place and waits in the lobby until the host starts."}
            </p>
            <div className="dialog-actions">
              <Button
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    onReplay((await participantApi.replay()).data);
                  } catch (error) {
                    onError(errorMessage(error));
                    setBusy(false);
                  }
                }}
              >
                Yes, play again
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await participantApi.leave();
                    window.location.assign("/");
                  } catch (error) {
                    onError(errorMessage(error));
                    setBusy(false);
                  }
                }}
              >
                No, go home
              </Button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
