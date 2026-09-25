"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, createIdempotencyKey, errorMessage, participantApi } from "../api/client";
import type { RoomSnapshot } from "../api/types";
import { Button, Drawer, Field, Toast, WholeNumberField } from "./ui";
import { AvatarPicker, PlayerAvatar } from "./player-avatar";
import { AVATAR_IDS, avatarById, isAvatarId, type AvatarId } from "../../shared/avatars";

type Mode = "create" | "join";
export function PlayForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("create");
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [minPlayers, setMinPlayers] = useState(3);
  const [maxPlayers, setMaxPlayers] = useState(15);
  const [accepted, setAccepted] = useState(false);
  const [avatarId, setAvatarId] = useState<AvatarId | null>(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [availableAvatarIds, setAvailableAvatarIds] = useState<AvatarId[]>([]);
  const [joinOptionsLoaded, setJoinOptionsLoaded] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [resumeRoom, setResumeRoom] = useState<RoomSnapshot | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const key = useRef(createIdempotencyKey());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = null;
    setToast(null);
  }, []);
  const showErrorToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message });
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 6_000);
  }, []);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  useEffect(() => {
    let active = true;
    participantApi
      .room()
      .then((response) => {
        if (active) setResumeRoom(response.data);
      })
      .catch((cause: unknown) => {
        if (
          active &&
          !(cause instanceof ApiError && (cause.status === 401 || cause.status === 404))
        )
          showErrorToast(errorMessage(cause));
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, [showErrorToast]);
  const nicknameError =
    nickname.length > 24
      ? "Use 24 characters or fewer."
      : nickname.trim()
        ? ""
        : "Enter a nickname.";
  const codeError =
    mode === "join" && !/^[A-Z0-9]{6}$/.test(code) ? "Enter the 6-character room code." : "";
  const select = (next: Mode) => {
    setMode(next);
    dismissToast();
    setAvatarId(null);
    setAvatarPickerOpen(false);
    setAvailableAvatarIds([]);
    setJoinOptionsLoaded(false);
    key.current = createIdempotencyKey();
  };
  const findRoom = async () => {
    if (codeError || busy) return;
    setBusy(true);
    dismissToast();
    try {
      const response = await participantApi.joinOptions(code);
      setAvailableAvatarIds(response.data.availableAvatarIds);
      setJoinOptionsLoaded(true);
      setAvatarId(null);
      if (response.data.spotsRemaining === 0) showErrorToast("That room is full.");
    } catch (cause) {
      setJoinOptionsLoaded(false);
      setAvailableAvatarIds([]);
      showErrorToast(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  const startNewGame = async (room: RoomSnapshot) => {
    setBusy(true);
    dismissToast();
    try {
      if (room.status !== "active") await participantApi.leave();
      setMode("create");
      setNickname(room.self.nickname);
      setCode("");
      setAccepted(false);
      setResumeRoom(null);
      key.current = createIdempotencyKey();
    } catch (cause) {
      showErrorToast(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (nicknameError || codeError || !accepted || busy) return;
    setBusy(true);
    dismissToast();
    try {
      if (mode === "create")
        await participantApi.createRoom(
          nickname.trim(),
          minPlayers,
          maxPlayers,
          key.current,
          avatarId!,
        );
      else await participantApi.joinRoom(code, nickname.trim(), key.current, avatarId!);
      router.replace("/room");
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "AVATAR_TAKEN") {
        const available = Array.isArray(cause.details?.availableAvatarIds)
          ? cause.details.availableAvatarIds.filter(isAvatarId)
          : [];
        setAvailableAvatarIds(available);
        setAvatarId(null);
        showErrorToast("That operative was just selected. Choose another available avatar.");
        window.requestAnimationFrame(() =>
          document.querySelector<HTMLButtonElement>(".avatar-choice")?.focus(),
        );
        setBusy(false);
        return;
      }
      if (!(cause instanceof ApiError && cause.retryable)) key.current = createIdempotencyKey();
      showErrorToast(errorMessage(cause));
      setBusy(false);
    }
  };
  const toastRegion = toast && (
    <div className="game-toast-region" aria-label="Play notifications">
      <Toast key={toast.id} tone="danger" title="Couldn’t continue" onDismiss={dismissToast}>
        {toast.message}
      </Toast>
    </div>
  );
  if (checkingSession)
    return (
      <div className="play-panel resume-panel" role="status">
        <p className="eyebrow">Checking your seat</p>
        <h2>Looking for an active room…</h2>
      </div>
    );
  if (resumeRoom) {
    const activeGame = resumeRoom.status === "active";
    const completedGame = resumeRoom.status === "completed" || resumeRoom.status === "abandoned";
    return (
      <div className="play-panel resume-panel">
        <p className="eyebrow">
          {activeGame ? "Game in progress" : completedGame ? "Results are ready" : "Seat saved"}
        </p>
        <h2>Welcome back, {resumeRoom.self.nickname}</h2>
        <p>
          Your place in room <strong>{resumeRoom.code}</strong> is still yours. We’ll restore the
          latest server state{completedGame ? " and show what happened while you were away" : ""}.
        </p>
        <div className="dialog-actions">
          <Button disabled={busy} onClick={() => router.replace("/room")}>
            {activeGame ? "Resume game" : completedGame ? "View results" : "Return to room"}
          </Button>
          <Button variant="secondary" loading={busy} onClick={() => void startNewGame(resumeRoom)}>
            Play new game
          </Button>
          {!activeGame && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                dismissToast();
                try {
                  await participantApi.leave();
                  setResumeRoom(null);
                } catch (cause) {
                  showErrorToast(errorMessage(cause));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Leave this room
            </Button>
          )}
        </div>
        {activeGame && (
          <p className="field-hint">
            Resume keeps your saved seat. Starting a new game opens a separate room while this match
            continues without this browser.
          </p>
        )}
        {toastRegion}
      </div>
    );
  }
  return (
    <div className="play-panel">
      <div className="mode-picker" role="group" aria-label="Choose how to play">
        <button
          className={mode === "create" ? "active" : ""}
          onClick={() => select("create")}
          type="button"
        >
          <strong>Start a room</strong>
          <span>Host a new game</span>
        </button>
        <button
          className={mode === "join" ? "active" : ""}
          onClick={() => select("join")}
          type="button"
        >
          <strong>Join a room</strong>
          <span>Use a 6-letter code</span>
        </button>
      </div>
      <form onSubmit={(event) => void submit(event)} noValidate>
        {mode === "join" && (
          <Field
            label="Room code"
            value={code}
            onChange={(e) => {
              setCode(
                e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
                  .slice(0, 6),
              );
              setJoinOptionsLoaded(false);
              setAvailableAvatarIds([]);
              setAvatarId(null);
              key.current = createIdempotencyKey();
            }}
            className="code-field"
            inputMode="text"
            autoComplete="off"
            maxLength={6}
            error={(code && codeError) || undefined}
            placeholder="ABC123"
          />
        )}
        {mode === "join" && !joinOptionsLoaded && (
          <Button
            type="button"
            variant="secondary"
            loading={busy}
            disabled={Boolean(codeError)}
            onClick={() => void findRoom()}
          >
            Find room
          </Button>
        )}
        {(mode === "create" || joinOptionsLoaded) && (
          <Field
            label="Your nickname"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              key.current = createIdempotencyKey();
            }}
            maxLength={24}
            autoComplete="nickname"
            error={nickname.length > 24 ? nicknameError : undefined}
            hint={`${nickname.length}/24 characters`}
            placeholder="What should the room call you?"
          />
        )}
        {mode === "create" && (
          <details className="play-options-disclosure">
            <summary>
              <span>
                <strong>Room options</strong>
                <small>
                  {minPlayers} minimum · {maxPlayers} maximum
                </small>
              </span>
              <span aria-hidden="true">⌄</span>
            </summary>
            <div className="form-grid two-column">
              <WholeNumberField
                label="Minimum players"
                value={minPlayers}
                min={3}
                max={maxPlayers}
                hint="At least 3 players are required."
                onChange={(value) => {
                  setMinPlayers(value);
                  key.current = createIdempotencyKey();
                }}
              />
              <WholeNumberField
                label="Maximum players"
                value={maxPlayers}
                min={minPlayers}
                max={15}
                hint="Limited to 15 for reliable realtime play."
                onChange={(value) => {
                  setMaxPlayers(value);
                  key.current = createIdempotencyKey();
                }}
              />
            </div>
          </details>
        )}
        {(mode === "create" || joinOptionsLoaded) && (
          <div className="operative-select">
            <span className="field-label">Your operative</span>
            <button
              type="button"
              className="operative-select-button"
              aria-haspopup="dialog"
              onClick={() => setAvatarPickerOpen(true)}
            >
              {avatarId ? (
                <>
                  <PlayerAvatar id={avatarId} size={50} />
                  <span>
                    <strong>{avatarById(avatarId).name}</strong>
                    <small>Selected operative</small>
                  </span>
                  <b>Change</b>
                </>
              ) : (
                <>
                  <span className="operative-placeholder" aria-hidden="true">
                    ?
                  </span>
                  <span>
                    <strong>Choose an operative</strong>
                    <small>One unique identity per player</small>
                  </span>
                  <b>Choose</b>
                </>
              )}
            </button>
            <Drawer
              open={avatarPickerOpen}
              title="Choose your operative"
              onClose={() => setAvatarPickerOpen(false)}
            >
              <AvatarPicker
                availableIds={mode === "create" ? AVATAR_IDS : availableAvatarIds}
                value={avatarId}
                onChange={(id) => {
                  setAvatarId(id);
                  setAvatarPickerOpen(false);
                  dismissToast();
                  key.current = createIdempotencyKey();
                }}
                disabled={busy}
              />
            </Drawer>
          </div>
        )}
        {(mode === "create" || joinOptionsLoaded) && (
          <label className="check-row">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span>
              I’m 18 or older and agree to the{" "}
              <a href="/privacy-and-photos" target="_blank">
                photo and privacy notice
              </a>
              .
            </span>
          </label>
        )}
        {(mode === "create" || joinOptionsLoaded) && (
          <Button
            type="submit"
            loading={busy}
            disabled={Boolean(nicknameError || codeError || !accepted || !avatarId)}
          >
            {mode === "create" ? "Create room" : "Join room"}
          </Button>
        )}
      </form>
      {toastRegion}
    </div>
  );
}
