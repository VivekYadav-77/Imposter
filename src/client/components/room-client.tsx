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
  const canSettings = room.self.capabilities.includes("change_settings");
  const canStart = room.self.capabilities.includes("start_game");
  useEffect(() => {
    if (canSettings)
      participantApi
        .packs()
        .then((r) => setPacks(r.data))
        .catch((e: unknown) => onError(errorMessage(e)));
  }, [canSettings, onError]);
  const update = async (body: Record<string, string | number | null>) => {
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
      <div className="game-content lobby-layout">
        <section>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Players present</p>
              <h1>Lobby roster</h1>
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
            <p className="eyebrow">Host setup</p>
            <h2>Game settings</h2>
            <label className="field">
              <span className="field-label">Task pack</span>
              <select
                value={room.settings.selectedTaskPack?.id ?? ""}
                onChange={(e) => void update({ selectedTaskPackId: e.target.value || null })}
                disabled={busy}
              >
                <option value="">Choose a published pack</option>
                {packs.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.name} · {pack.activeTaskCount} tasks
                  </option>
                ))}
              </select>
            </label>
            <TimerSelect
              label="Task phase"
              value={room.settings.taskPhaseSeconds}
              values={[300, 600, 900, 1200, 1800, 3600]}
              onChange={(value) => void update({ taskPhaseSeconds: value })}
            />
            <TimerSelect
              label="Discussion"
              value={room.settings.discussionSeconds}
              values={[30, 60, 90, 120, 180, 300]}
              onChange={(value) => void update({ discussionSeconds: value })}
            />
            <TimerSelect
              label="Evidence review"
              value={room.settings.reviewSeconds}
              values={[30, 60, 90, 120, 180]}
              onChange={(value) => void update({ reviewSeconds: value })}
            />
            <TimerSelect
              label="Voting"
              value={room.settings.votingSeconds}
              values={[30, 60, 90, 120, 180]}
              onChange={(value) => void update({ votingSeconds: value })}
            />
          </aside>
        )}
      </div>
      <div className="sticky-actions">
        {canStart ? (
          <>
            <span className="action-note">
              {room.settings.selectedTaskPack
                ? "The server will verify player count and readiness."
                : "Choose a task pack before starting."}
            </span>
            <Button
              loading={busy}
              disabled={!room.settings.selectedTaskPack}
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

function GameView({
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
  const [roleAcknowledged, setRoleAcknowledged] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const previousPhase = useRef(game.phase);
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
    if (previousPhase.current !== game.phase) {
      previousPhase.current = game.phase;
    }
  }, [game.phase]);
  if (!roleAcknowledged)
    return (
      <RoleReveal
        role={game.self.role}
        revealed={revealed}
        setRevealed={setRevealed}
        onContinue={() => {
          setRevealed(false);
          setRoleAcknowledged(true);
        }}
      />
    );
  if (game.phase === "game_over" || game.phase === "abandoned") return <TerminalView game={game} />;
  if (game.phase === "task")
    return <TaskView game={game} setGame={setGame} room={room} onError={onError} />;
  return <MeetingView game={game} setGame={setGame} room={room} onError={onError} />;
}

function RoleReveal({
  role,
  revealed,
  setRevealed,
  onContinue,
}: {
  role: "crew" | "imposter";
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
  const selected = game.assignments.find((task) => task.id === assignmentId);
  const canKill = game.self.capabilities.includes("kill");
  const kill = async () => {
    if (!killTarget) return;
    try {
      setGame((await participantApi.kill(killTarget, game.stateVersion)).data);
      setKillTarget(null);
    } catch (e) {
      onError(errorMessage(e));
      setKillTarget(null);
    }
  };
  return (
    <>
      <PhaseBar phase="tasks" identity={room.self.nickname}>
        <Timer deadline={game.phaseDeadlineAt} label="Task time" />
      </PhaseBar>
      <div className="game-content narrow">
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
          <Banner tone="info">
            You’re out of the social game, but crew ghosts can finish remaining tasks when the
            server allows it.
          </Banner>
        )}
        <Progress value={game.progress.completed} max={game.progress.total} label="Task progress" />
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
        {canKill && (
          <section className="danger-zone">
            <p className="eyebrow">Imposter action</p>
            <h2>Choose carefully</h2>
            <div className="target-grid">
              {game.participants
                .filter((p) => p.id !== game.self.participantId && p.lifeStatus === "alive")
                .map((p) => (
                  <Button key={p.id} variant="danger" onClick={() => setKillTarget(p.id)}>
                    Eliminate {p.nickname}
                  </Button>
                ))}
            </div>
          </section>
        )}
      </div>
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
        description="This immediately starts an anonymous meeting. The room will not be told who acted."
        confirmLabel="Eliminate player"
        dangerous
      />
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
      {file && (
        <img
          className="upload-preview"
          src={URL.createObjectURL(file)}
          alt="Selected evidence preview"
        />
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
                <img src={item.image.url} alt={`Evidence submitted by ${item.uploader.nickname}`} />
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
    </Dialog>
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
      setReviewVote(null);
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const reported = game.participants.find((p) => p.id === meeting.reportedParticipantId);
  return (
    <>
      <PhaseBar
        phase={game.phase === "result" ? "results" : "meeting"}
        identity={room.self.nickname}
      >
        <Timer
          deadline={game.phaseDeadlineAt ?? meeting.deadlineAt}
          label={game.phase === "result" ? "Returning soon" : "Meeting time"}
        />
      </PhaseBar>
      <div className="game-content narrow meeting-view">
        <p className="eyebrow">Meeting {meeting.sequenceNumber}</p>
        <h1>
          {game.phase === "discussion"
            ? meeting.triggerType === "kill"
              ? "A player was eliminated"
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
            <p className="lead">
              Vote to eject, or skip if you’re not sure. You can replace your vote until the phase
              locks.
            </p>
            <div className="voting-grid">
              {meeting.eligibleParticipants.map((player) => (
                <button
                  key={player.id}
                  className={vote === player.id ? "voting-option selected" : "voting-option"}
                  onClick={() => setVote(player.id)}
                >
                  <IdentityToken name={player.nickname} />
                  <strong>{player.nickname}</strong>
                </button>
              ))}
              <button
                className={vote === "skip" ? "voting-option selected" : "voting-option"}
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
      {game.phase === "voting" && vote && (
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
    <section className="result-card">
      <span className="stamp">DECISION</span>
      <h2>{ejected ? `${ejected.nickname} was ejected` : "No one was ejected"}</h2>
      <p>Roles remain private. The game will continue from the authoritative server state.</p>
    </section>
  );
}

function TerminalView({ game }: { game: GameSnapshot }) {
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
          <a className="button button-primary" href="/play">
            Start a new room
          </a>
        </section>
      </div>
    </>
  );
}
