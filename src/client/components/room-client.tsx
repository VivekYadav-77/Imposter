"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  ApiError,
  createIdempotencyKey,
  errorMessage,
  participantApi,
  userApi,
} from "../api/client";
import type {
  GameSnapshot,
  PublicPackSummary,
  RealtimeMessage,
  RoomSnapshot,
  Submission,
  TransportState,
} from "../api/types";
import { RealtimeClient } from "../realtime/client";
import { playGameSound, playMeetingAlert } from "../audio/game-sounds";
import {
  evidenceImageErrorMessage,
  normalizeEvidenceImage,
} from "../image/normalize-evidence-image";
import { uploadEvidenceObject } from "../image/upload-evidence-object";
import { avatarById, type AvatarId } from "../../shared/avatars";
import { PlayerAvatar } from "./player-avatar";
import { GoogleSignInLink } from "./google-sign-in";
import {
  Badge,
  Banner,
  Button,
  ConfirmDialog,
  Dialog,
  Drawer,
  EmptyState,
  GameShell,
  GameSelect,
  Icon,
  IconButton,
  IdentityToken,
  PhaseBar,
  Progress,
  SkeletonList,
  Timer,
  Toast,
  WholeNumberField,
} from "./ui";

type GameToastDetail = { message: string; tone: "success" | "danger" | "info" };
const GAME_TOAST_EVENT = "imposter-game:toast";

type AvatarAccentStyle = CSSProperties & { "--avatar-dark": string; "--avatar-light": string };
function avatarAccentStyle(id: AvatarId): AvatarAccentStyle {
  const avatar = avatarById(id);
  return { "--avatar-dark": avatar.dark, "--avatar-light": avatar.light };
}

function gameToast(message: string, tone: GameToastDetail["tone"] = "success") {
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent<GameToastDetail>(GAME_TOAST_EVENT, { detail: { message, tone } }),
    );
}

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

function ResponsiveSettingsDetails({
  index,
  title,
  description,
  className = "",
  children,
}: {
  index: string;
  title: string;
  description: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const sync = () => setOpen(!media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return (
    <details
      className={`settings-section settings-collapsible responsive-settings ${className}`}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span className="settings-section-heading">
          <span>{index}</span>
          <span>
            <strong>{title}</strong>
            <small>{description}</small>
          </span>
        </span>
        <Icon name="chevron" size={18} />
      </summary>
      <div className="responsive-settings-content">
        {children}
        <button type="button" className="section-close-button" onClick={() => setOpen(false)}>
          Close {title}
          <Icon name="chevron" size={17} aria-hidden="true" />
        </button>
      </div>
    </details>
  );
}

export function RoomClient() {
  const router = useRouter();
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [game, setGame] = useState<GameSnapshot | null>(null);
  const [transport, setTransport] = useState<TransportState>("connecting");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Array<GameToastDetail & { id: number }>>([]);
  const lastToast = useRef<{ message: string; tone: GameToastDetail["tone"]; at: number } | null>(
    null,
  );
  const gameRef = useRef<GameSnapshot | null>(null);
  const previousLobbyParticipants = useRef<Set<string> | null>(null);
  const gameWasActive = useRef(false);
  const reportError = useCallback((message: string) => {
    setError(message);
    gameToast(message, "danger");
  }, []);
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
    if (!room || room.status !== "lobby" || game) {
      previousLobbyParticipants.current = null;
      return;
    }
    const current = new Set(room.participants.map((participant) => participant.id));
    const previous = previousLobbyParticipants.current;
    if (
      previous &&
      room.participants.some(
        (participant) =>
          participant.id !== room.self.participantId && !previous.has(participant.id),
      )
    )
      playGameSound("player-join");
    previousLobbyParticipants.current = current;
  }, [game, room]);
  useEffect(() => {
    if (game && !gameWasActive.current) playGameSound("game-start");
    gameWasActive.current = Boolean(game);
  }, [game]);
  useEffect(() => {
    if (!game || game.phase === "game_over" || game.phase === "abandoned") return;
    const warnBeforeExit = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = true;
    };
    window.addEventListener("beforeunload", warnBeforeExit);
    return () => window.removeEventListener("beforeunload", warnBeforeExit);
  }, [game]);
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<GameToastDetail>).detail;
      const receivedAt = Date.now();
      if (
        lastToast.current?.message === detail.message &&
        lastToast.current.tone === detail.tone &&
        receivedAt - lastToast.current.at < 1_500
      )
        return;
      lastToast.current = { ...detail, at: receivedAt };
      const id = Date.now() + Math.random();
      setToasts((current) => [...current.slice(-2), { ...detail, id }]);
      window.setTimeout(
        () => setToasts((current) => current.filter((toast) => toast.id !== id)),
        detail.tone === "danger" ? 6000 : 3600,
      );
    };
    window.addEventListener(GAME_TOAST_EVENT, receive);
    return () => window.removeEventListener(GAME_TOAST_EVENT, receive);
  }, []);
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
          reportError("Your room session ended. Start or join a room to continue.");
      },
    });
    realtime.connect();
    return () => realtime.destroy();
  }, [load, reportError]);
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
        <GameShell phase="lobby">
          <div className="game-content">
            <EmptyState
              title="This room is unavailable"
              description={
                error || "It may have ended, expired, or your session is no longer active."
              }
              action={<Button onClick={() => router.replace("/play")}>Start or join a room</Button>}
            />
          </div>
        </GameShell>
      </main>
    );
  return (
    <main className="game-page">
      {transport !== "connected" && (
        <div className="connection-banner" role="status">
          {transport === "revoked"
            ? "This saved seat is no longer available."
            : "Connection lost. Your seat is saved; restoring the latest game state…"}
        </div>
      )}
      <div className="game-toast-region" aria-label="Game notifications">
        {toasts.map((toast) => (
          <Toast key={toast.id} tone={toast.tone}>
            <span>{toast.message}</span>
            <IconButton
              className="toast-dismiss"
              icon="close"
              label="Dismiss notification"
              onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
            />
          </Toast>
        ))}
      </div>
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
          onError={reportError}
        />
      ) : (
        <LobbyView
          room={room}
          setRoom={setRoom}
          onStart={(next) => {
            gameRef.current = next;
            setGame(next);
          }}
          onError={reportError}
        />
      )}
    </main>
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
  const pendingSettings = useRef<Record<string, unknown>>({});
  const settingsTimer = useRef<number | null>(null);
  const settingsSaving = useRef(false);
  const settingsSavePromise = useRef<Promise<void> | null>(null);
  const canSettings = room.self.capabilities.includes("change_settings");
  const canStart = room.self.capabilities.includes("start_game");
  const startDisabled =
    !canStart || !room.settings.selectedTaskPack || room.participants.length < room.minPlayers;
  const startMessage = !canStart
    ? "Waiting for the host to start the game."
    : !room.settings.selectedTaskPack
      ? "Choose a map to complete setup."
      : room.participants.length < room.minPlayers
        ? `${room.minPlayers - room.participants.length} more player${room.minPlayers - room.participants.length === 1 ? "" : "s"} needed before starting.`
        : "Settings complete. Your crew is ready to begin.";
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
  const flushSettings = useCallback(async (): Promise<boolean> => {
    if (settingsSaving.current) {
      await settingsSavePromise.current;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      if (Object.keys(pendingSettings.current).length > 0) return flushSettings();
      return true;
    }
    if (Object.keys(pendingSettings.current).length === 0) return true;
    if (settingsTimer.current !== null) {
      window.clearTimeout(settingsTimer.current);
      settingsTimer.current = null;
    }
    const body = pendingSettings.current;
    pendingSettings.current = {};
    settingsSaving.current = true;
    let saved = false;
    setBusy(true);
    try {
      const request = participantApi.updateSettings(body);
      settingsSavePromise.current = request.then(
        () => undefined,
        () => undefined,
      );
      setRoom((await request).data);
      saved = true;
      if (Object.keys(pendingSettings.current).length === 0) gameToast("Game settings saved.");
    } catch (e) {
      pendingSettings.current = { ...body, ...pendingSettings.current };
      onError(errorMessage(e));
    } finally {
      settingsSaving.current = false;
      settingsSavePromise.current = null;
      setBusy(false);
      if (saved && Object.keys(pendingSettings.current).length > 0)
        settingsTimer.current = window.setTimeout(() => void flushSettings(), 650);
    }
    return saved;
  }, [onError, setRoom]);
  const update = (body: Record<string, unknown>) => {
    const next = { ...pendingSettings.current, ...body };
    if (body.taskCounts && typeof body.taskCounts === "object") {
      const changed = Object.fromEntries(
        Object.entries(body.taskCounts).filter(
          ([key, value]) =>
            room.settings.taskCounts[key as keyof typeof room.settings.taskCounts] !== value,
        ),
      );
      next.taskCounts = {
        ...room.settings.taskCounts,
        ...(pendingSettings.current.taskCounts as Record<string, unknown> | undefined),
        ...changed,
      };
    }
    if (body.roleCounts && typeof body.roleCounts === "object") {
      const changed = Object.fromEntries(
        Object.entries(body.roleCounts).filter(
          ([key, value]) => room.settings.roleCounts[key] !== value,
        ),
      );
      next.roleCounts = {
        ...room.settings.roleCounts,
        ...(pendingSettings.current.roleCounts as Record<string, unknown> | undefined),
        ...changed,
      };
    }
    pendingSettings.current = next;
    if (settingsTimer.current !== null) window.clearTimeout(settingsTimer.current);
    settingsTimer.current = window.setTimeout(() => void flushSettings(), 650);
  };
  useEffect(
    () => () => {
      if (settingsTimer.current !== null) window.clearTimeout(settingsTimer.current);
    },
    [],
  );
  const start = async () => {
    setBusy(true);
    try {
      if (!(await flushSettings())) return;
      onStart((await participantApi.start()).data);
      gameToast("Game started. Keep your role private.", "info");
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
    gameToast("Room code copied. Your crew can join now.");
    window.setTimeout(() => setCopied(false), 1800);
  };
  return (
    <>
      <PhaseBar phase="lobby" identity={room.self.nickname} avatarId={room.self.avatarId} />
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
                {room.participants.length} joined · minimum {room.minPlayers} · capacity{" "}
                {room.maxPlayers}
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
              <article
                className="roster-item avatar-accent-card"
                key={player.id}
                style={avatarAccentStyle(player.avatarId)}
              >
                <IdentityToken
                  name={player.nickname}
                  avatarId={player.avatarId}
                  status={player.presence}
                />
                <div>
                  <strong title={player.nickname}>{player.nickname}</strong>
                  <span>
                    {avatarById(player.avatarId).name} ·{" "}
                    {player.presence === "connected" ? "In the room" : "Away"}
                  </span>
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
                <p className="settings-intro">
                  Configure the round below. Changes are grouped and saved when you pause.
                </p>
              </div>
              <div className="settings-heading-actions">
                <Badge tone={busy ? "warning" : "success"}>{busy ? "Saving" : "Saved"}</Badge>
              </div>
            </div>
            <section className="settings-section">
              <div className="settings-section-heading">
                <span>01</span>
                <div>
                  <strong>Game basics</strong>
                  <small>Choose the map and total play time.</small>
                </div>
              </div>
              <GameSelect
                label="Map"
                value={room.settings.selectedTaskPack?.id ?? ""}
                placeholder="Choose a published map"
                disabled={busy}
                options={packs.map((pack) => ({
                  value: pack.id,
                  label: `${pack.name} · ${pack.activeTaskCount} tasks`,
                }))}
                onChange={(id) => {
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
              />
              <GameDurationControl
                value={room.settings.taskPhaseSeconds}
                onChange={(value) => void update({ taskPhaseSeconds: value })}
                busy={busy}
              />
            </section>
            <ResponsiveSettingsDetails
              index="02"
              title="Meeting voting"
              description="Pick one clear rule for ending a vote."
              className="meeting-settings-section"
            >
              <MeetingVotingControl
                mode={room.settings.meetingVotingMode}
                duration={room.settings.meetingDurationSeconds}
                busy={busy}
                onModeChange={(mode) => void update({ meetingVotingMode: mode })}
                onDurationChange={(value) => void update({ meetingDurationSeconds: value })}
              />
              <div className="vote-visibility-control">
                <span className="field-label">Ballot visibility</span>
                <div role="radiogroup" aria-label="Ballot visibility">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={room.settings.voteVisibility === "private"}
                    className={room.settings.voteVisibility === "private" ? "selected" : ""}
                    disabled={busy}
                    onClick={() => void update({ voteVisibility: "private" })}
                  >
                    <span aria-hidden="true">
                      <Icon name="lock" size={20} />
                    </span>
                    <strong>Private</strong>
                    <small>Only totals appear after voting.</small>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={room.settings.voteVisibility === "public"}
                    className={room.settings.voteVisibility === "public" ? "selected" : ""}
                    disabled={busy}
                    onClick={() => void update({ voteVisibility: "public" })}
                  >
                    <span aria-hidden="true">
                      <Icon name="eye" size={20} />
                    </span>
                    <strong>Public</strong>
                    <small>Everyone sees who voted for whom.</small>
                  </button>
                </div>
              </div>
              <div className="vote-visibility-control">
                <span className="field-label">Evidence visibility</span>
                <div role="radiogroup" aria-label="Evidence visibility">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={room.settings.evidenceVisibility === "public"}
                    className={room.settings.evidenceVisibility === "public" ? "selected" : ""}
                    disabled={busy}
                    onClick={() => void update({ evidenceVisibility: "public" })}
                  >
                    <span aria-hidden="true">
                      <Icon name="eye" size={20} />
                    </span>
                    <strong>Shared</strong>
                    <small>Everyone can view accepted task photos.</small>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={room.settings.evidenceVisibility === "private"}
                    className={room.settings.evidenceVisibility === "private" ? "selected" : ""}
                    disabled={busy}
                    onClick={() => void update({ evidenceVisibility: "private" })}
                  >
                    <span aria-hidden="true">
                      <Icon name="lock" size={20} />
                    </span>
                    <strong>Private</strong>
                    <small>Players can view only their own task photos.</small>
                  </button>
                </div>
              </div>
            </ResponsiveSettingsDetails>
            <ResponsiveSettingsDetails
              index="03"
              title="Game balance"
              description="Control actions, meetings, and impostors."
            >
              <CustomDurationField
                label="Impostor cooldown base"
                value={room.settings.imposterCooldownSeconds}
                min={10}
                max={300}
                onApply={(value) => void update({ imposterCooldownSeconds: value })}
                hint="The live cooldown subtracts the average game-time and crew-task completion from this base."
              />
              <CustomDurationField
                label="Meeting cooldown"
                value={room.settings.meetingCooldownSeconds}
                min={10}
                max={1800}
                onApply={(value) => void update({ meetingCooldownSeconds: value })}
                hint="Time after a meeting ends before another meeting can be called."
              />
              <WholeNumberField
                label="Meetings per player"
                value={room.settings.meetingsPerPlayer}
                min={0}
                max={10}
                disabled={busy}
                onChange={(value) => void update({ meetingsPerPlayer: value })}
              />
              <div className="vote-visibility-control">
                <span className="field-label">Impostor task needed to call a meeting</span>
                <div role="radiogroup" aria-label="Impostor task requirement for calling a meeting">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={room.settings.imposterMeetingTaskRequirement === "one"}
                    className={
                      room.settings.imposterMeetingTaskRequirement === "one" ? "selected" : ""
                    }
                    disabled={busy}
                    onClick={() => void update({ imposterMeetingTaskRequirement: "one" })}
                  >
                    <strong>One task</strong>
                    <small>Impostors must complete at least one task before calling.</small>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={room.settings.imposterMeetingTaskRequirement === "none"}
                    className={
                      room.settings.imposterMeetingTaskRequirement === "none" ? "selected" : ""
                    }
                    disabled={busy}
                    onClick={() => void update({ imposterMeetingTaskRequirement: "none" })}
                  >
                    <strong>No task</strong>
                    <small>Impostors can call immediately when the cooldown is ready.</small>
                  </button>
                </div>
                <span className="field-hint">
                  Crew members always need one completed task. The caller’s identity is never shown.
                </span>
              </div>
              <WholeNumberField
                label="Impostors"
                value={room.settings.imposterCount}
                min={1}
                max={room.settings.allowedImposterCounts.at(-1) ?? 1}
                disabled={busy}
                hint={`Choose up to ${room.settings.allowedImposterCounts.at(-1) ?? 1} for a ${room.maxPlayers}-player room. Game start uses the safest maximum for the players actually present.`}
                onChange={(value) => void update({ imposterCount: value })}
              />
            </ResponsiveSettingsDetails>
            <details className="settings-section settings-collapsible" open>
              <summary>
                <span className="settings-section-heading">
                  <span>04</span>
                  <span>
                    <strong>Tasks per player</strong>
                    <small>
                      {Object.values(room.settings.taskCounts).reduce(
                        (sum, count) => sum + count,
                        0,
                      )}{" "}
                      tasks selected
                    </small>
                  </span>
                </span>
                <Icon name="chevron" size={18} />
              </summary>
              <div className="difficulty-settings">
                {(["easy", "medium", "hard"] as const).map((difficulty) => (
                  <WholeNumberField
                    className="compact-field"
                    key={difficulty}
                    label={difficulty[0].toUpperCase() + difficulty.slice(1)}
                    value={room.settings.taskCounts[difficulty]}
                    min={0}
                    max={Math.min(
                      availableTaskCounts[difficulty],
                      15 -
                        Object.entries(room.settings.taskCounts)
                          .filter(([name]) => name !== difficulty)
                          .reduce((sum, [, count]) => sum + count, 0),
                    )}
                    disabled={
                      busy ||
                      !room.settings.selectedTaskPack ||
                      availableTaskCounts[difficulty] === 0
                    }
                    hint={`${availableTaskCounts[difficulty]} active on this map`}
                    onChange={(value) =>
                      void update({
                        taskCounts: {
                          ...room.settings.taskCounts,
                          [difficulty]: value,
                        },
                      })
                    }
                  />
                ))}
              </div>
              <button
                type="button"
                className="section-close-button"
                onClick={(event) => {
                  event.currentTarget.closest("details")?.removeAttribute("open");
                }}
              >
                Close tasks per player
                <Icon name="chevron" size={17} aria-hidden="true" />
              </button>
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
                  <Icon name="chevron" size={18} />
                </summary>
                <div className="role-settings">
                  {room.settings.selectedTaskPack.roles.map((role) => {
                    const availableCrew = Math.max(
                      0,
                      room.participants.length - room.settings.imposterCount,
                    );
                    return (
                      <WholeNumberField
                        className="compact-field"
                        key={role.name}
                        label={role.name}
                        labelAction={
                          <button
                            type="button"
                            className="role-info-trigger"
                            onClick={() => setRoleInfo(role)}
                            aria-label={`About the ${role.name} role`}
                          >
                            <span className="sr-only">About {role.name}</span>
                            <span aria-hidden="true">i</span>
                          </button>
                        }
                        value={room.settings.roleCounts[role.name] ?? 0}
                        min={0}
                        max={availableCrew}
                        disabled={busy || availableCrew === 0}
                        hint={
                          availableCrew === 0
                            ? "This becomes editable when at least one crewmate joins the room."
                            : `Assign this role to up to ${availableCrew} crewmate${availableCrew === 1 ? "" : "s"}.`
                        }
                        onChange={(value) =>
                          void update({
                            roleCounts: {
                              ...room.settings.roleCounts,
                              [role.name]: value,
                            },
                          })
                        }
                      />
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="section-close-button"
                  onClick={(event) => {
                    event.currentTarget.closest("details")?.removeAttribute("open");
                  }}
                >
                  Close crew roles
                  <Icon name="chevron" size={17} aria-hidden="true" />
                </button>
              </details>
            ) : null}
            <div className="settings-completion" aria-label="Finish game setup">
              <div>
                <span className="eyebrow">Ready check</span>
                <strong>{startDisabled ? "Complete setup" : "Ready to launch"}</strong>
                <small aria-live="polite">{startMessage}</small>
              </div>
            </div>
          </aside>
        )}
      </div>
      <div className="sticky-actions lobby-actions">
        <span className={canStart ? "action-note" : "waiting-copy"}>
          {canStart
            ? room.settings.selectedTaskPack
              ? room.participants.length >= room.minPlayers
                ? `${room.participants.length} players ready · minimum ${room.minPlayers}`
                : `${room.minPlayers - room.participants.length} more player${room.minPlayers - room.participants.length === 1 ? "" : "s"} needed before the host can start.`
              : "Choose a map before starting."
            : "Waiting for the host to start…"}
        </span>
        {canStart && (
          <Button
            className="settings-start-button"
            loading={busy}
            disabled={startDisabled}
            title={startDisabled ? startMessage : "Start the configured game"}
            onClick={() => void start()}
          >
            Start game
          </Button>
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

function GameDurationControl({
  value,
  onChange,
  busy,
}: {
  value: number;
  onChange: (value: number) => void;
  busy: boolean;
}) {
  return (
    <WholeNumberField
      className="custom-duration-field"
      label="Game time"
      value={value / 60}
      min={5}
      max={240}
      step={5}
      suffix="min"
      disabled={busy}
      hint="Enter a whole number from 5 to 240 minutes. Buttons change the time by 5 minutes."
      onChange={(minutes) => onChange(minutes * 60)}
    />
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
          <span className="meeting-mode-icon" aria-hidden="true">
            ◷
          </span>
          <strong>Timed vote</strong>
          <small>Ends when everyone votes or the selected time runs out.</small>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "all_voted"}
          className={mode === "all_voted" ? "selected" : ""}
          disabled={busy}
          onClick={() => onModeChange("all_voted")}
        >
          <span className="meeting-mode-icon" aria-hidden="true">
            ✓
          </span>
          <strong>Wait for everyone</strong>
          <small>Ends when every connected eligible player has voted.</small>
        </button>
      </div>
      {mode === "timed" && (
        <div className="meeting-duration-editor">
          <WholeNumberField
            label="Maximum voting time"
            value={duration}
            min={30}
            max={1800}
            step={5}
            suffix="seconds"
            disabled={busy}
            hint="Enter a whole number from 30 to 1800 seconds."
            onChange={onDurationChange}
          />
        </div>
      )}
      {mode === "all_voted" && (
        <p className="field-hint meeting-quorum-hint">
          Brief connection drops are ignored. If a player stays offline, their missing ballot stops
          being required and the meeting continues automatically.
        </p>
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
  return (
    <WholeNumberField
      className="custom-duration-field"
      label={label}
      value={value}
      min={min}
      max={max}
      step={5}
      suffix="seconds"
      hint={hint ?? `Choose any whole number from ${min} to ${max} seconds.`}
      onChange={onApply}
    />
  );
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${remainder ? `${remainder}s` : ""}`.trim() : `${seconds}s`;
}

function CompactCountdown({
  deadline,
  readyLabel,
}: {
  deadline: string | null;
  readyLabel: string;
}) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const calculate = () =>
      setRemaining(
        deadline ? Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000)) : 0,
      );
    calculate();
    const timer = window.setInterval(calculate, 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);
  if (!deadline || remaining === 0) return <>{readyLabel}</>;
  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, "0");
  return (
    <>
      {minutes}:{seconds}
    </>
  );
}

function ProgressDonut({ value }: { value: number }) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className="mobile-progress-donut"
      role="progressbar"
      aria-label="Crew progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle className="donut-track" cx="22" cy="22" r="18" />
        <circle
          className="donut-value"
          cx="22"
          cy="22"
          r="18"
          pathLength="100"
          strokeDasharray={`${percent} 100`}
        />
      </svg>
      <strong>{percent}%</strong>
    </div>
  );
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
  const previousMeetingId = useRef(game.meeting?.id ?? null);
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
    const phaseChanged = previousPhase.current !== game.phase;

    // Meeting alerts must not depend on a particular phase or on the role card being
    // acknowledged. The server meeting id changes exactly once for every new meeting.
    const meetingId = game.meeting?.id ?? null;
    if (meetingId && meetingId !== previousMeetingId.current) playMeetingAlert();
    previousMeetingId.current = meetingId;

    // A shared upload sound can reveal private evidence activity. Only public evidence is
    // announced room-wide; the uploader still receives local upload feedback below.
    if (game.evidenceVisibility === "public" && game.progress.percent > previousProgress.current)
      playGameSound("upload");
    previousProgress.current = game.progress.percent;

    if (!roleAcknowledged) {
      previousPhase.current = game.phase;
      return;
    }
    if (previousLifeStatus.current === "alive" && game.self.lifeStatus !== "alive")
      playGameSound("eliminated");
    if (phaseChanged) {
      if (game.phase === "voting") playGameSound("vote");
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
  }, [game, roleAcknowledged]);
  if (game.phase === "game_over" || game.phase === "abandoned")
    return <TerminalView game={game} room={room} onReplay={onReplay} onError={onError} />;
  if (!roleAcknowledged)
    return (
      <RoleReveal
        role={game.self.role}
        crewRole={game.self.crewRole}
        identity={room.self.nickname}
        avatarId={room.self.avatarId}
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
  if (game.phase === "task")
    return <TaskView game={game} setGame={setGame} room={room} onError={onError} />;
  return <MeetingView game={game} setGame={setGame} room={room} onError={onError} />;
}

function RoleReveal({
  role,
  crewRole,
  identity,
  avatarId,
  revealed,
  setRevealed,
  onContinue,
}: {
  role: "crew" | "imposter";
  crewRole: GameSnapshot["self"]["crewRole"];
  identity: string;
  avatarId: AvatarId;
  revealed: boolean;
  setRevealed: (value: boolean) => void;
  onContinue: () => void;
}) {
  return (
    <>
      <PhaseBar phase="role" identity={identity} avatarId={avatarId} />
      <section
        className={`role-screen role-screen-${role} avatar-dashboard`}
        style={avatarAccentStyle(avatarId)}
      >
        <PlayerAvatar id={avatarId} size={96} className="dashboard-avatar-watermark" />
        <p className="eyebrow">Private briefing</p>
        <div className={`role-card ${revealed ? "revealed" : "sealed"}`}>
          <span className="seal-mark" aria-hidden="true">
            <Icon name="eye" size={32} />
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
          aria-pressed={revealed}
          onClick={() => setRevealed(!revealed)}
        >
          {revealed ? "Hide role" : "Reveal role"}
        </Button>
        <Button variant="ghost" disabled={!revealed} onClick={onContinue}>
          I understand
        </Button>
        <p className="privacy-note">Your role will hide if you switch apps or lock your phone.</p>
      </section>
    </>
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
  const [killPickerOpen, setKillPickerOpen] = useState(false);
  const [gallery, setGallery] = useState(false);
  const [roleInfo, setRoleInfo] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"status" | null>(null);
  const [confirmMeeting, setConfirmMeeting] = useState(false);
  const [meetingBusy, setMeetingBusy] = useState(false);
  const [ownProofs, setOwnProofs] = useState<Submission[]>([]);
  const [taskPreview, setTaskPreview] = useState<{ src: string; alt: string } | null>(null);
  const [uploadingAssignments, setUploadingAssignments] = useState<Set<string>>(() => new Set());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let cancelled = false;
    let refreshTimer: number | undefined;
    const refreshOwnProofs = async () => {
      try {
        const response = await participantApi.submissions();
        if (cancelled) return;
        const proofs = response.data.filter((item) => item.uploader.id === game.self.participantId);
        setOwnProofs(proofs);
        setUploadingAssignments((current) => {
          const next = new Set(current);
          for (const proof of proofs)
            if (proof.processingStatus !== "pending") next.delete(proof.assignmentId);
          return next;
        });
        if (proofs.some((item) => item.processingStatus === "pending"))
          refreshTimer = window.setTimeout(() => void refreshOwnProofs(), 1_250);
      } catch (error) {
        if (!cancelled) onError(errorMessage(error));
      }
    };
    void refreshOwnProofs();
    return () => {
      cancelled = true;
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
    };
  }, [game.self.participantId, game.stateVersion, onError]);
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
    (!game.meetingRules.requiresCompletedTask || game.meetingRules.hasCompletedTask) &&
    game.meetingRules.remainingForSelf > 0 &&
    game.self.lifeStatus === "alive";
  const kill = async () => {
    if (!killTarget) return;
    try {
      setGame((await participantApi.kill(killTarget, game.stateVersion)).data);
      playGameSound("kill");
      gameToast("Elimination recorded. Your identity remains hidden.", "info");
      setKillTarget(null);
      setKillPickerOpen(false);
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
      gameToast("Meeting called. Gather the room.", "info");
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
      <GameShell
        phase="tasks"
        identity={room.self.nickname}
        avatarId={room.self.avatarId}
        status={
          <div className="header-game-status">
            <Progress value={game.progress.percent} max={100} label="Crew progress" />
            <Timer deadline={game.phaseDeadlineAt} label="Task time" />
          </div>
        }
      >
        <div
          className="task-command-shell avatar-dashboard"
          style={avatarAccentStyle(room.self.avatarId)}
        >
          <PlayerAvatar id={room.self.avatarId} size={96} className="dashboard-avatar-watermark" />
          <div className="game-content task-command-main">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{game.taskPack.name}</p>
                <h1>
                  {game.self.lifeStatus === "alive" ? "Your assignments" : "Ghost assignments"}
                </h1>
              </div>
              <ProgressDonut value={game.progress.percent} />
            </div>
            {game.self.lifeStatus !== "alive" && (
              <section className="eliminated-banner" role="status" aria-live="polite">
                <span className="eliminated-mark" aria-hidden="true">
                  <Icon name="ghost" size={24} />
                </span>
                <div>
                  <p className="eyebrow">Status update</p>
                  <h2>
                    {game.self.lifeStatus === "killed" ? "You were eliminated" : "You were ejected"}
                  </h2>
                  <p>
                    Stay silent about what you saw. You can still finish ghost assignments, but you
                    can no longer vote or call meetings.
                  </p>
                </div>
                <Badge tone="danger">Ghost mode</Badge>
              </section>
            )}
            <div className="task-list">
              {game.assignments.map((task, index) => {
                const proof = ownProofs.find((item) => item.assignmentId === task.id);
                return (
                  <article
                    className={`task-card ${task.status === "completed" ? "task-complete" : ""}`}
                    key={task.id}
                  >
                    <button className="task-card-main" onClick={() => setAssignmentId(task.id)}>
                      <span className="task-number">{String(index + 1).padStart(2, "0")}</span>
                      <span>
                        <strong>{task.description}</strong>
                        <small className="task-difficulty">
                          <Icon name="difficulty" size={14} />
                          {task.difficulty[0].toUpperCase() + task.difficulty.slice(1)} task
                        </small>
                        <small>
                          {task.status === "completed"
                            ? "Done · processing may still reopen this task"
                            : "Open to add photo proof"}
                        </small>
                      </span>
                      <Badge tone={task.status === "completed" ? "success" : "warning"}>
                        {task.status === "completed" ? "Done" : "To do"}
                      </Badge>
                    </button>
                    <button
                      className="task-proof"
                      type="button"
                      aria-label={
                        proof?.image
                          ? `Preview your photo for ${task.description}`
                          : `Add a photo for ${task.description}`
                      }
                      onClick={() => {
                        if (proof?.image)
                          setTaskPreview({
                            src: proof.image.url,
                            alt: `Your proof for ${task.description}`,
                          });
                        else setAssignmentId(task.id);
                      }}
                    >
                      {uploadingAssignments.has(task.id) ? (
                        <span
                          className="task-upload-loader"
                          role="status"
                          aria-label="Uploading photo"
                        >
                          <Icon name="uploading" size={23} />
                        </span>
                      ) : proof?.image ? (
                        <img src={proof.image.url} alt="" />
                      ) : (
                        <span aria-hidden="true">
                          <Icon name={proof ? "uploading" : "camera"} size={23} />
                        </span>
                      )}
                    </button>
                  </article>
                );
              })}
            </div>
            <ImagePreview
              open={Boolean(taskPreview)}
              src={taskPreview?.src ?? null}
              alt={taskPreview?.alt ?? "Your submitted task photo"}
              onClose={() => setTaskPreview(null)}
            />
            {game.self.role === "imposter" && game.self.lifeStatus === "alive" && (
              <section className="kill-action-card">
                <div>
                  <p className="eyebrow">Impostor ability</p>
                  <strong>
                    {canKill ? "Choose a living crew member" : "Elimination recharging"}
                  </strong>
                </div>
                <Button
                  className="kill-open-button"
                  variant="danger"
                  disabled={!canKill}
                  onClick={() => {
                    setKillTarget(null);
                    setKillPickerOpen(true);
                  }}
                >
                  <Icon name={canKill ? "ghost" : "cooldown"} size={19} />
                  <span>Kill</span>
                  <small>
                    <CompactCountdown
                      deadline={game.cooldowns.killAvailableAt}
                      readyLabel="Ready"
                    />
                  </small>
                </Button>
              </section>
            )}
          </div>
          <aside className="game-context-rail" aria-label="Game controls and status">
            <section
              className="live-identity-card avatar-accent-card"
              style={avatarAccentStyle(room.self.avatarId)}
            >
              <IdentityToken
                name={room.self.nickname}
                avatarId={room.self.avatarId}
                status="connected"
              />
              <div>
                <span>Playing as</span>
                <strong>{room.self.nickname}</strong>
                <small>
                  {avatarById(room.self.avatarId).name} · {roleDetails.name}
                </small>
              </div>
              <IconButton icon="eye" onClick={() => setRoleInfo(true)} label="View role details" />
            </section>
            {game.self.role === "imposter" && (
              <section
                className="elimination-history-card"
                aria-labelledby="elimination-history-title"
              >
                <div className="context-card-heading">
                  <span className="elimination-history-icon" aria-hidden="true">
                    <Icon name="ghost" size={20} />
                  </span>
                  <div>
                    <span className="eyebrow">Private record</span>
                    <strong id="elimination-history-title">Your eliminations</strong>
                  </div>
                  <Badge tone="danger">{game.self.knownEliminatedParticipantIds.length}</Badge>
                </div>
                {game.self.knownEliminatedParticipantIds.length ? (
                  <ul className="elimination-history-list">
                    {game.self.knownEliminatedParticipantIds.map((id) => {
                      const player = game.participants.find((entry) => entry.id === id);
                      return (
                        <li
                          className={player ? "avatar-accent-card" : undefined}
                          key={id}
                          style={player ? avatarAccentStyle(player.avatarId) : undefined}
                        >
                          <IdentityToken
                            name={player?.nickname ?? "Unknown player"}
                            avatarId={player?.avatarId}
                          />
                          <span>
                            <strong>{player?.nickname ?? "Unknown player"}</strong>
                            <small>Eliminated by you</small>
                          </span>
                          <Icon name="check" size={17} />
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="elimination-history-empty">No confirmed eliminations yet.</p>
                )}
              </section>
            )}
            <section className="context-progress-card">
              <div className="context-card-heading">
                <Icon name="tasks" size={20} />
                <strong>Mission status</strong>
              </div>
              <Progress value={game.progress.percent} max={100} label="Crew progress" />
              <Button variant="ghost" onClick={() => setGallery(true)}>
                <Icon name="evidence" size={18} /> View evidence
              </Button>
            </section>
            <section className={`meeting-action-rail ${meetingReady ? "is-ready" : "is-waiting"}`}>
              <div className="context-card-heading">
                <Icon name={meetingReady ? "meeting" : "cooldown"} size={20} />
                <strong>Emergency meeting</strong>
              </div>
              <div className="meeting-call-copy">
                <span>{game.meetingRules.remainingForSelf}</span>
                <small>calls remaining</small>
              </div>
              <Button
                className="meeting-call-button"
                variant="secondary"
                disabled={!meetingReady}
                onClick={() => setConfirmMeeting(true)}
                title={
                  game.meetingRules.requiresCompletedTask && !game.meetingRules.hasCompletedTask
                    ? "Complete one task first"
                    : game.meetingRules.remainingForSelf === 0
                      ? "No meetings remaining"
                      : !meetingReady
                        ? "Meeting cooldown active"
                        : "Call a meeting"
                }
              >
                <Icon name="meeting" size={18} /> Call meeting
              </Button>
              {!meetingReady &&
                game.cooldowns.meetingAvailableAt &&
                new Date(game.cooldowns.meetingAvailableAt).getTime() > now && (
                  <Timer deadline={game.cooldowns.meetingAvailableAt} label="Available in" />
                )}
            </section>
          </aside>
        </div>
      </GameShell>
      <nav className="mobile-game-actions" aria-label="Game actions">
        <button type="button" onClick={() => setMobilePanel("status")}>
          <Icon name="tasks" size={20} />
          <span>Status</span>
          <small>{game.progress.percent}%</small>
        </button>
        <button type="button" onClick={() => setGallery(true)}>
          <Icon name="evidence" size={20} />
          <span>Evidence</span>
          <small>{ownProofs.length}</small>
        </button>
        <button
          type="button"
          className={meetingReady ? "meeting-ready" : ""}
          onClick={() => (meetingReady ? setConfirmMeeting(true) : setMobilePanel("status"))}
          aria-label={meetingReady ? "Call emergency meeting" : "Meeting unavailable; open status"}
        >
          <Icon name={meetingReady ? "meeting" : "cooldown"} size={20} />
          <span>Meeting</span>
          <small>
            {meetingReady ? (
              `${game.meetingRules.remainingForSelf} left`
            ) : (
              <CompactCountdown
                deadline={game.cooldowns.meetingAvailableAt}
                readyLabel="Unavailable"
              />
            )}
          </small>
        </button>
      </nav>
      <Drawer
        open={mobilePanel === "status"}
        title="Game status"
        onClose={() => setMobilePanel(null)}
      >
        <div className="mobile-status-sheet">
          <section className="mobile-status-identity" style={avatarAccentStyle(room.self.avatarId)}>
            <IdentityToken
              name={room.self.nickname}
              avatarId={room.self.avatarId}
              status="connected"
            />
            <span>
              <small>Playing as</small>
              <strong>{room.self.nickname}</strong>
              <b>
                {avatarById(room.self.avatarId).name} · {roleDetails.name}
              </b>
            </span>
            <Button
              variant="ghost"
              onClick={() => {
                setMobilePanel(null);
                setRoleInfo(true);
              }}
            >
              View role
            </Button>
          </section>
          <section>
            <div className="context-card-heading">
              <Icon name="tasks" size={20} />
              <strong>Mission status</strong>
            </div>
            <Progress value={game.progress.percent} max={100} label="Crew progress" />
          </section>
          {game.self.role === "imposter" && (
            <section>
              <div className="context-card-heading">
                <Icon name="ghost" size={20} />
                <strong>Your eliminations</strong>
                <Badge tone="danger">{game.self.knownEliminatedParticipantIds.length}</Badge>
              </div>
              {game.self.knownEliminatedParticipantIds.length ? (
                <ul className="elimination-history-list">
                  {game.self.knownEliminatedParticipantIds.map((id) => {
                    const player = game.participants.find((entry) => entry.id === id);
                    return (
                      <li key={id}>
                        <IdentityToken
                          name={player?.nickname ?? "Unknown player"}
                          avatarId={player?.avatarId}
                        />
                        <span>
                          <strong>{player?.nickname ?? "Unknown player"}</strong>
                          <small>Eliminated by you</small>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="muted">No confirmed eliminations yet.</p>
              )}
            </section>
          )}
          <section>
            <div className="context-card-heading">
              <Icon name={meetingReady ? "meeting" : "cooldown"} size={20} />
              <strong>Emergency meeting</strong>
            </div>
            <p className="muted">
              {meetingReady
                ? `${game.meetingRules.remainingForSelf} call${game.meetingRules.remainingForSelf === 1 ? "" : "s"} remaining.`
                : game.meetingRules.requiresCompletedTask && !game.meetingRules.hasCompletedTask
                  ? "Complete one task before calling a meeting."
                  : game.meetingRules.remainingForSelf === 0
                    ? "You have no meeting calls remaining."
                    : "The meeting cooldown is still active."}
            </p>
            {!meetingReady &&
              game.cooldowns.meetingAvailableAt &&
              new Date(game.cooldowns.meetingAvailableAt).getTime() > now && (
                <Timer deadline={game.cooldowns.meetingAvailableAt} label="Available in" />
              )}
            <Button
              disabled={!meetingReady}
              onClick={() => {
                setMobilePanel(null);
                setConfirmMeeting(true);
              }}
            >
              <Icon name="meeting" size={18} /> Call meeting
            </Button>
          </section>
        </div>
      </Drawer>
      <UploadDialog
        open={Boolean(selected)}
        assignment={selected ?? null}
        game={game}
        setGame={setGame}
        onClose={() => setAssignmentId(null)}
        onError={onError}
        onUploadStart={(id) => setUploadingAssignments((current) => new Set(current).add(id))}
        onUploadFinish={(id) =>
          setUploadingAssignments((current) => {
            const next = new Set(current);
            next.delete(id);
            return next;
          })
        }
      />
      <EvidenceGallery open={gallery} onClose={() => setGallery(false)} onError={onError} />
      <Dialog
        open={killPickerOpen}
        title="Choose a target"
        onClose={() => setKillPickerOpen(false)}
      >
        <div className="kill-target-dialog">
          <p className="muted">
            Select one living crew member. This list scrolls while the popup stays a consistent
            size.
          </p>
          <div className="kill-target-list" role="radiogroup" aria-label="Living crew targets">
            {game.participants
              .filter((player) => game.self.killableParticipantIds.includes(player.id))
              .map((player) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={killTarget === player.id}
                  className={killTarget === player.id ? "selected" : ""}
                  key={player.id}
                  onClick={() => setKillTarget(player.id)}
                >
                  <IdentityToken name={player.nickname} avatarId={player.avatarId} />
                  <span>
                    <strong>{player.nickname}</strong>
                    <small>Living crew member</small>
                  </span>
                  <span className="target-check" aria-hidden="true">
                    <Icon name={killTarget === player.id ? "check" : "ghost"} size={18} />
                  </span>
                </button>
              ))}
          </div>
          <p className="kill-privacy-note">
            <Icon name="lock" size={15} /> Only the eliminated player is notified. Cooldown after
            this action: {formatDuration(game.cooldowns.killCooldownSeconds)}.
          </p>
          <div className="dialog-actions">
            <Button variant="secondary" onClick={() => setKillPickerOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={!killTarget} onClick={() => void kill()}>
              Eliminate player
            </Button>
          </div>
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirmMeeting}
        onClose={() => setConfirmMeeting(false)}
        onConfirm={() => void callMeeting()}
        title="Call a meeting?"
        description={`${game.meetingRules.votingMode === "all_voted" ? "Voting ends when every connected eligible player has voted." : `Voting will open for up to ${formatDuration(game.meetingRules.durationSeconds)}.`} You will have ${Math.max(0, game.meetingRules.remainingForSelf - 1)} meeting calls left.`}
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
  onUploadStart,
  onUploadFinish,
}: {
  open: boolean;
  assignment: GameSnapshot["assignments"][number] | null;
  game: GameSnapshot;
  setGame: (game: GameSnapshot) => void;
  onClose: () => void;
  onError: (message: string) => void;
  onUploadStart: (assignmentId: string) => void;
  onUploadFinish: (assignmentId: string) => void;
}) {
  const activeUploads = useRef(new Set<AbortController>());
  useEffect(() => {
    return () => {
      for (const controller of activeUploads.current) controller.abort();
      activeUploads.current.clear();
    };
  }, []);
  if (!assignment) return null;
  const upload = async (file: File) => {
    const controller = new AbortController();
    let confirmed = false;
    activeUploads.current.add(controller);
    onUploadStart(assignment.id);
    onClose();
    gameToast("Photo selected. Uploading in the background…", "info");
    try {
      const preparedFile = await normalizeEvidenceImage(file, controller.signal);
      if (controller.signal.aborted) return;
      playGameSound("upload-start");
      let expectedStateVersion = game.stateVersion;
      const refreshStateVersion = async () => {
        const latest = await participantApi.snapshot(undefined, controller.signal);
        setGame(latest.data);
        return latest.data.stateVersion;
      };
      const createIntent = () =>
        participantApi.uploadIntent(
          assignment.id,
          preparedFile,
          expectedStateVersion,
          createIdempotencyKey(),
          controller.signal,
        );
      let intent;
      try {
        intent = (await createIntent()).data;
      } catch (error) {
        if (!(error instanceof ApiError) || error.code !== "GAME_STATE_CONFLICT") throw error;
        expectedStateVersion = await refreshStateVersion();
        intent = (await createIntent()).data;
      }
      await uploadEvidenceObject(intent, preparedFile, controller.signal);
      const confirm = () =>
        participantApi.confirmUpload(
          assignment.id,
          intent.uploadId,
          expectedStateVersion,
          createIdempotencyKey(),
          controller.signal,
        );
      try {
        await confirm();
      } catch (error) {
        if (!(error instanceof ApiError) || error.code !== "GAME_STATE_CONFLICT") throw error;
        expectedStateVersion = await refreshStateVersion();
        await confirm();
      }
      const latest = await participantApi.snapshot(undefined, controller.signal);
      setGame(latest.data);
      confirmed = true;
      playGameSound("upload");
      gameToast("Photo uploaded to this task.");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      playGameSound("upload-failure");
      onError(
        e instanceof Error && e.name === "EvidenceImageError"
          ? evidenceImageErrorMessage(e)
          : errorMessage(e),
      );
    } finally {
      activeUploads.current.delete(controller);
      if (!confirmed) onUploadFinish(assignment.id);
    }
  };
  return (
    <Dialog open={open} title="Upload task photo" onClose={onClose}>
      <p className="task-description">{assignment.description}</p>
      <div className="file-picker-panel">
        <div className="file-picker-options">
          <label className="file-picker">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={(event) => {
                const selectedFile = event.target.files?.[0];
                if (selectedFile) void upload(selectedFile);
              }}
            />
            <Icon name="camera" size={28} />
            <span>Take photo</span>
            <small>Open your camera</small>
          </label>
          <label className="file-picker">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const selectedFile = event.target.files?.[0];
                if (selectedFile) void upload(selectedFile);
              }}
            />
            <Icon name="upload" size={28} />
            <span>Choose from gallery</span>
            <small>Select an existing photo</small>
          </label>
        </div>
        <small className="file-picker-note">
          JPEG, PNG or WebP · upload continues in the background after selection
        </small>
      </div>
    </Dialog>
  );
}

function EvidenceGallery({
  open,
  onClose,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
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
  useEffect(() => {
    if (!open) setPreview(null);
  }, [open]);
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
                <button
                  type="button"
                  className="evidence-image-button"
                  aria-label="Preview task evidence"
                  onClick={() =>
                    setPreview({
                      src: item.image!.url,
                      alt: "Task evidence",
                    })
                  }
                >
                  <img src={item.image.url} alt="Task evidence" />
                  <span>↗ View full screen</span>
                </button>
              ) : (
                <div className="image-placeholder">{item.processingStatus}</div>
              )}
              <div>
                <strong>Task evidence</strong>
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
            </article>
          ))}
        </div>
      )}
      <ImagePreview
        open={Boolean(preview)}
        src={preview?.src ?? null}
        alt={preview?.alt ?? "Evidence preview"}
        onClose={() => setPreview(null)}
      />
    </Dialog>
  );
}

function FinalEvidenceSection({ onError }: { onError: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState<{ src: string; alt: string } | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const collected: Submission[] = [];
      let cursor: string | undefined;
      do {
        const response = await participantApi.submissions(cursor);
        collected.push(...response.data.filter((item) => item.image));
        cursor = response.meta.nextCursor;
      } while (cursor);
      setItems(collected);
    } catch (error) {
      setFailed(true);
      onError(errorMessage(error));
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  }, [onError]);
  return (
    <section className="final-evidence" aria-labelledby="final-evidence-title">
      <button
        type="button"
        className="final-evidence-toggle"
        aria-expanded={open}
        aria-controls="final-evidence-content"
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen && !hasLoaded && !loading) void load();
        }}
      >
        <span className="final-evidence-toggle-icon" aria-hidden="true">
          <Icon name="evidence" size={21} />
        </span>
        <span>
          <strong id="final-evidence-title">Evidence</strong>
          <small>Review accepted task photos</small>
        </span>
        {hasLoaded && !failed ? (
          <Badge tone="info">{items.length}</Badge>
        ) : (
          <Icon name="chevron" size={20} />
        )}
      </button>
      <div id="final-evidence-content" className="final-evidence-content" hidden={!open}>
        <div className="final-evidence-heading">
          <div>
            <p className="eyebrow">Case archive</p>
            <h2>Final evidence</h2>
            <p>With the result declared, every player can review the accepted task photos.</p>
          </div>
          {!loading && !failed && (
            <Badge tone="info">
              {items.length} {items.length === 1 ? "photo" : "photos"}
            </Badge>
          )}
        </div>
        {loading ? (
          <SkeletonList />
        ) : failed ? (
          <div className="final-evidence-empty" role="alert">
            <Icon name="warning" size={24} />
            <div>
              <strong>Evidence could not be loaded</strong>
              <small>Your result is safe. Try loading the photo archive again.</small>
            </div>
            <Button variant="secondary" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="final-evidence-empty">
            <Icon name="evidence" size={24} />
            <div>
              <strong>No accepted evidence</strong>
              <small>This game ended without any task photos in the final archive.</small>
            </div>
          </div>
        ) : (
          <div className="final-evidence-grid">
            {items.map((item, index) => (
              <button
                type="button"
                className="final-evidence-item"
                key={item.id}
                aria-label={`Open final evidence photo ${index + 1} of ${items.length}`}
                onClick={() =>
                  setPreview({
                    src: item.image!.url,
                    alt: `Final task evidence ${index + 1}`,
                  })
                }
              >
                <img src={item.image!.url} alt="" />
                <span>
                  <strong>Evidence {String(index + 1).padStart(2, "0")}</strong>
                  <small>View full screen</small>
                </span>
              </button>
            ))}
          </div>
        )}
        <button type="button" className="section-close-button" onClick={() => setOpen(false)}>
          Close evidence
          <Icon name="chevron" size={17} aria-hidden="true" />
        </button>
      </div>
      <ImagePreview
        open={Boolean(preview)}
        src={preview?.src ?? null}
        alt={preview?.alt ?? "Final task evidence"}
        onClose={() => setPreview(null)}
      />
    </section>
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [displayMode, setDisplayMode] = useState<"fit" | "actual">("fit");
  const [imageState, setImageState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    setDisplayMode("fit");
    setImageState("loading");
  }, [src]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && src && !dialog.open) dialog.showModal();
    if ((!open || !src) && dialog.open) dialog.close();
  }, [open, src]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <dialog
      ref={dialogRef}
      className="image-preview-dialog"
      aria-label="Image preview"
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onClose={(event) => event.stopPropagation()}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="image-preview-shell">
        <header className="image-preview-toolbar">
          <div>
            <span className="eyebrow">Photo evidence</span>
            <strong>{alt}</strong>
          </div>
          <div className="image-preview-actions">
            <button
              type="button"
              className={displayMode === "fit" ? "selected" : ""}
              aria-pressed={displayMode === "fit"}
              onClick={() => setDisplayMode("fit")}
            >
              Fit
            </button>
            <button
              type="button"
              className={displayMode === "actual" ? "selected" : ""}
              aria-pressed={displayMode === "actual"}
              onClick={() => setDisplayMode("actual")}
            >
              Full size
            </button>
            <IconButton
              icon="close"
              className="image-preview-close"
              onClick={onClose}
              label="Close image preview"
            />
          </div>
        </header>
        <div className={`image-preview-canvas image-preview-${displayMode}`}>
          {imageState === "loading" && (
            <div className="image-preview-status" role="status">
              <span className="spinner" aria-hidden="true" />
              Loading photo…
            </div>
          )}
          {imageState === "error" && (
            <div className="image-preview-status image-preview-error" role="alert">
              <strong>Photo could not be loaded</strong>
              <span>The secure preview may have expired. Close this viewer and try again.</span>
            </div>
          )}
          {src && (
            <img
              className={imageState === "ready" ? "is-ready" : ""}
              src={src}
              alt={alt}
              onLoad={() => setImageState("ready")}
              onError={() => setImageState("error")}
            />
          )}
        </div>
        <footer className="image-preview-footer">
          <span>Use “Full size” to inspect the original detail.</span>
          <span>Esc or tap outside to close</span>
        </footer>
      </section>
    </dialog>,
    document.body,
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
        <PhaseBar phase="meeting" identity={room.self.nickname} avatarId={room.self.avatarId} />
        <div
          className="game-content avatar-dashboard"
          style={avatarAccentStyle(room.self.avatarId)}
        >
          <PlayerAvatar id={room.self.avatarId} size={96} className="dashboard-avatar-watermark" />
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
      playGameSound("vote-lock");
      gameToast("Vote locked. You can vote only once this meeting.");
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
      playGameSound("vote-lock");
      gameToast("Evidence review vote recorded.");
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
        phase={game.phase === "result" ? "results" : game.phase === "voting" ? "voting" : "meeting"}
        identity={room.self.nickname}
        avatarId={room.self.avatarId}
      >
        {!(
          game.meetingRules.votingMode === "all_voted" && ["review", "voting"].includes(game.phase)
        ) &&
        (game.phaseDeadlineAt || meeting.deadlineAt) ? (
          <Timer
            deadline={game.phaseDeadlineAt ?? meeting.deadlineAt}
            label={game.phase === "result" ? "Returning soon" : "Meeting time"}
          />
        ) : (
          <Badge tone="info">
            {game.meetingRules.votingMode === "all_voted"
              ? "Waiting for connected voters"
              : "Meeting in progress"}
          </Badge>
        )}
      </PhaseBar>
      <div
        className="game-content narrow meeting-view avatar-dashboard"
        style={avatarAccentStyle(room.self.avatarId)}
      >
        <PlayerAvatar id={room.self.avatarId} size={96} className="dashboard-avatar-watermark" />
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
                : meeting.triggerType === "user_called"
                  ? "A player called an anonymous meeting. Gather and talk face to face."
                  : "The task window closed. Gather and talk face to face."}
            </p>
            {meeting.triggerType === "kill" && reported && (
              <div
                className="reported-player-chip avatar-accent-card"
                style={avatarAccentStyle(reported.avatarId)}
              >
                <IdentityToken name={reported.nickname} avatarId={reported.avatarId} size={56} />
                <span>
                  <small>Reported player</small>
                  <strong>{reported.nickname}</strong>
                  <em>{avatarById(reported.avatarId).name}</em>
                </span>
              </div>
            )}
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
            {meeting.capabilities.includes("participate_in_meeting") && (
              <div className="choice-grid">
                <button
                  className={reviewVote === "valid" ? "selected" : ""}
                  onClick={() => {
                    setReviewVote("valid");
                    playGameSound("vote-select");
                  }}
                >
                  Valid proof
                </button>
                <button
                  className={reviewVote === "invalid" ? "selected danger-choice" : "danger-choice"}
                  onClick={() => {
                    setReviewVote("invalid");
                    playGameSound("vote-select");
                  }}
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
                This meeting resolves after every connected eligible player votes. Players who
                remain offline after the reconnect grace period no longer block the result.
              </Banner>
            )}
            <p className="lead">
              {canVote
                ? "Choose carefully. Your ballot locks as soon as you confirm it."
                : meeting.hasCastEjectionVote
                  ? "Your ballot is locked. Watch the remaining votes arrive."
                  : "You can observe this meeting, but dead and eliminated players cannot vote."}
            </p>
            <div className="voting-grid">
              {meeting.eligibleParticipants.map((player) => (
                <button
                  key={player.id}
                  className={
                    vote === player.id
                      ? "voting-option selected avatar-accent-card"
                      : "voting-option avatar-accent-card"
                  }
                  style={avatarAccentStyle(player.avatarId)}
                  disabled={!canVote}
                  onClick={() => {
                    setVote(player.id);
                    playGameSound("vote-select");
                  }}
                >
                  <span className="vote-avatar">
                    <IdentityToken name={player.nickname} avatarId={player.avatarId} size={56} />
                    {vote === player.id && <VoteCheckIcon />}
                  </span>
                  <strong>{player.nickname}</strong>
                  <small>
                    {avatarById(player.avatarId).name} ·{" "}
                    {vote === player.id ? "Selected" : "Tap to select"}
                  </small>
                </button>
              ))}
              <button
                className={vote === "skip" ? "voting-option selected" : "voting-option"}
                disabled={!canVote}
                onClick={() => {
                  setVote("skip");
                  playGameSound("vote-select");
                }}
              >
                <span className="skip-icon">
                  <Icon name="close" size={22} />
                </span>
                <strong>Skip</strong>
                <small>{vote === "skip" ? "Selected" : "No ejection"}</small>
              </button>
            </div>
            <div className="vote-progress-line">
              <span
                style={{
                  width: `${Math.round((meeting.votesCast / Math.max(1, meeting.requiredVotes)) * 100)}%`,
                }}
              />
            </div>
            <p className="vote-count">
              {meeting.votesCast} of {meeting.requiredVotes} required ballots locked
            </p>
            {game.meetingRules.voteVisibility === "public" && (
              <PublicVoteFeed votes={meeting.publicVotes} />
            )}
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

function VoteCheckIcon() {
  return (
    <svg className="vote-check-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m5 12.5 4.2 4.2L19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PublicVoteFeed({ votes }: { votes: NonNullable<GameSnapshot["meeting"]>["publicVotes"] }) {
  return (
    <section className="public-vote-feed" aria-live="polite">
      <div>
        <span aria-hidden="true">
          <Icon name="eye" size={18} />
        </span>
        <div>
          <strong>Public ballot feed</strong>
          <small>New ballots appear as they lock.</small>
        </div>
      </div>
      {votes.length ? (
        <ul>
          {votes.map((ballot) => (
            <li key={ballot.voterParticipantId}>
              <div
                className="ballot-party ballot-voter avatar-accent-card avatar-compact-card"
                style={avatarAccentStyle(ballot.voterAvatarId)}
              >
                <IdentityToken
                  name={ballot.voterNickname}
                  avatarId={ballot.voterAvatarId}
                  size={30}
                />
                <span className="ballot-copy">
                  <small>Voter</small>
                  <strong>{ballot.voterNickname}</strong>
                </span>
              </div>
              <span className="ballot-direction">
                <Icon name="arrow" size={17} />
                <span className="sr-only">voted for</span>
              </span>
              <div
                className={
                  ballot.targetAvatarId
                    ? "ballot-party ballot-target avatar-accent-card avatar-compact-card"
                    : "ballot-party ballot-target"
                }
                style={ballot.targetAvatarId ? avatarAccentStyle(ballot.targetAvatarId) : undefined}
              >
                {ballot.targetAvatarId && ballot.targetNickname ? (
                  <IdentityToken
                    name={ballot.targetNickname}
                    avatarId={ballot.targetAvatarId}
                    size={30}
                  />
                ) : null}
                <span className="ballot-copy">
                  <small>Voted for</small>
                  <strong>{ballot.targetNickname ?? "Skipped"}</strong>
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>No ballot has been locked yet.</p>
      )}
    </section>
  );
}

function ResultBlock({ game }: { game: GameSnapshot }) {
  const result = game.meeting?.result;
  const ejected = game.participants.find((p) => p.id === result?.ejectedParticipantId);
  return (
    <section className="result-card elimination-reveal" aria-live="assertive">
      <span className="stamp">DECISION</span>
      <h2>{ejected ? `${ejected.nickname} was ejected` : "No one was ejected"}</h2>
      {result?.totals?.length ? (
        <div className="meeting-tally">
          {result.totals.map((total) => {
            const player = game.participants.find((entry) => entry.id === total.participantId);
            return (
              <span
                className={player ? "avatar-accent-card avatar-compact-card" : undefined}
                key={total.participantId}
                style={player ? avatarAccentStyle(player.avatarId) : undefined}
              >
                {player ? (
                  <>
                    <IdentityToken name={player.nickname} avatarId={player.avatarId} size={30} />
                    {player.nickname}
                  </>
                ) : (
                  "Player"
                )}
                <strong>{total.votes}</strong>
              </span>
            );
          })}
          <span>
            Skipped<strong>{result.skipVotes ?? 0}</strong>
          </span>
        </div>
      ) : null}
      {game.meetingRules.voteVisibility === "public" && result?.ballots ? (
        <PublicVoteFeed votes={result.ballots} />
      ) : (
        <p>Individual ballots are private. The game will continue from the server state.</p>
      )}
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
  const [showResults, setShowResults] = useState(false);
  const [showVotes, setShowVotes] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [guestPlayer, setGuestPlayer] = useState<boolean | null>(null);
  useEffect(() => {
    if (game.phase !== "game_over") return;
    const storageKey = `imposter-game:guest-upgrade:${game.id}`;
    const upgradeDismissed = Boolean(window.sessionStorage.getItem(storageKey));
    let active = true;
    userApi
      .me()
      .then(() => {
        if (active) setGuestPlayer(false);
      })
      .catch((cause: unknown) => {
        if (active && cause instanceof ApiError && cause.status === 401) {
          setGuestPlayer(true);
          if (!upgradeDismissed) setUpgradeOpen(true);
        }
      });
    return () => {
      active = false;
    };
  }, [game.id, game.phase]);
  const keepPlayingAsGuest = () => {
    window.sessionStorage.setItem(`imposter-game:guest-upgrade:${game.id}`, "dismissed");
    setUpgradeOpen(false);
  };
  const summary = game.resultSummary;
  const won =
    game.winner === "crew"
      ? "Crew wins"
      : game.winner === "imposters"
        ? "Imposters win"
        : "Room ended";
  const outcomeCopy =
    game.endReason === "tasks_completed"
      ? "Every crew task was completed. The ship is secure."
      : game.endReason === "imposters_ejected"
        ? "Every imposter was identified and ejected."
        : game.endReason === "imposter_parity"
          ? "The imposters matched the remaining crew and took control."
          : game.endReason === "time_expired"
            ? "Time expired before the crew could secure the room."
            : game.winner === "crew"
              ? "The crew completed the case."
              : game.winner === "imposters"
                ? "The room never caught on."
                : "This game was abandoned before a winner was decided.";
  return (
    <>
      <PhaseBar phase="results" identity={room.self.nickname} avatarId={room.self.avatarId} />
      <div className="game-content avatar-dashboard" style={avatarAccentStyle(room.self.avatarId)}>
        <PlayerAvatar id={room.self.avatarId} size={96} className="dashboard-avatar-watermark" />
        <section className="terminal-card">
          <span className="stamp">CASE CLOSED</span>
          <p className="eyebrow">Final outcome</p>
          <h1>{won}</h1>
          <p>{outcomeCopy}</p>
          <div className="result-at-a-glance">
            <span>
              <strong>{summary?.players.length ?? game.participants.length}</strong>Players
            </span>
            <span>
              <strong>
                {summary?.completedTasks ?? 0}/{summary?.totalTasks ?? 0}
              </strong>
              Crew tasks
            </span>
            <span>
              <strong>{formatDuration(summary?.durationSeconds ?? 0)}</strong>Duration
            </span>
          </div>
          <Button
            variant="secondary"
            className="results-toggle"
            aria-expanded={showResults}
            onClick={() => setShowResults((current) => !current)}
          >
            <span className={showResults ? "is-open" : ""} aria-hidden="true">
              <Icon name="chevron" size={18} />
            </span>
            {showResults ? "Hide full results" : "See full results"}
          </Button>
          {showResults && summary && (
            <section className="full-results" aria-label="Full game results">
              <div className="full-results-heading">
                <div>
                  <p className="eyebrow">Identity reveal</p>
                  <h2>Roles & task records</h2>
                </div>
                <Badge tone={game.meetingRules.voteVisibility === "public" ? "info" : "neutral"}>
                  {game.meetingRules.voteVisibility === "public"
                    ? "Public ballots"
                    : "Private ballots"}
                </Badge>
              </div>
              <div className="result-roster">
                {summary.players.map((player) => (
                  <article
                    className={`result-player result-player-${player.role} avatar-accent-card`}
                    key={player.id}
                    style={avatarAccentStyle(player.avatarId)}
                  >
                    <IdentityToken name={player.nickname} avatarId={player.avatarId} />
                    <div>
                      <strong>{player.nickname}</strong>
                      <small className="avatar-codename">{avatarById(player.avatarId).name}</small>
                      <span className="result-role-label">
                        <Icon name={player.role === "imposter" ? "warning" : "tool"} size={16} />
                        {player.role === "imposter"
                          ? "Imposter"
                          : (player.crewRole?.name ?? "Crewmate")}
                      </span>
                      {player.crewRole && <small>{player.crewRole.specialization}</small>}
                    </div>
                    <div className="player-task-score">
                      <strong>
                        {player.completedTasks}/{player.totalTasks}
                      </strong>
                      <small>tasks</small>
                    </div>
                    <Badge tone={player.lifeStatus === "alive" ? "success" : "danger"}>
                      {player.lifeStatus}
                    </Badge>
                  </article>
                ))}
              </div>
              <button
                type="button"
                className="section-close-button"
                onClick={() => setShowResults(false)}
              >
                Close full results
                <Icon name="chevron" size={17} aria-hidden="true" />
              </button>
            </section>
          )}
          {showResults && summary && (
            <section className="terminal-votes" aria-labelledby="terminal-votes-title">
              <button
                type="button"
                className="terminal-votes-toggle"
                aria-expanded={showVotes}
                aria-controls="terminal-votes-content"
                onClick={() => setShowVotes((current) => !current)}
              >
                <span>
                  <strong id="terminal-votes-title">Vote details</strong>
                  <small>Review the final ballot separately</small>
                </span>
                <Icon name="chevron" size={20} />
              </button>
              <div
                id="terminal-votes-content"
                className="terminal-votes-content"
                hidden={!showVotes}
              >
                {game.meetingRules.voteVisibility === "public" &&
                game.meeting?.result?.ballots?.length ? (
                  <PublicVoteFeed votes={game.meeting.result.ballots} />
                ) : (
                  <p className="privacy-note">
                    {game.meetingRules.voteVisibility === "public"
                      ? "No public ballots were cast in the final round."
                      : "Ballot choices were kept private by the host setting."}
                  </p>
                )}
                <button
                  type="button"
                  className="section-close-button"
                  onClick={() => setShowVotes(false)}
                >
                  Close vote details
                  <Icon name="chevron" size={17} aria-hidden="true" />
                </button>
              </div>
            </section>
          )}
          {game.phase === "game_over" && <FinalEvidenceSection onError={onError} />}
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
            <Icon name={easterEgg >= 3 ? "spark" : "eye"} size={22} />
          </button>
          {easterEgg >= 3 && (
            <div className="easter-egg" role="status">
              <Icon name="spark" size={17} /> The smallest crewmate was suspicious all along.{" "}
              <Icon name="spark" size={17} />
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
                    gameToast("Room reset. Waiting in the lobby.");
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
                    gameToast("You left the room.", "info");
                    window.location.assign(guestPlayer === false ? "/dashboard" : "/");
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
          {guestPlayer === true && !upgradeOpen && (
            <section className="guest-result-signin" aria-label="Save this result">
              <div>
                <p className="eyebrow">Save this case</p>
                <h2>Keep this result in your dashboard</h2>
                <p>Sign in to attach this finished game and room to your private history.</p>
              </div>
              <GoogleSignInLink intent="post_game" />
            </section>
          )}
        </section>
      </div>
      <Dialog
        open={upgradeOpen}
        title="Keep this case in your history?"
        onClose={keepPlayingAsGuest}
      >
        <div className="play-choice-dialog guest-upgrade-dialog">
          <p>
            Continue with Google to attach this completed game, your stats, and this room to your
            private dashboard.
          </p>
          <div className="play-choice-actions">
            <GoogleSignInLink intent="post_game" />
            <Button variant="secondary" onClick={keepPlayingAsGuest}>
              Keep playing as guest
            </Button>
          </div>
          <small>You can still view results, replay, or leave without creating an account.</small>
        </div>
      </Dialog>
    </>
  );
}
