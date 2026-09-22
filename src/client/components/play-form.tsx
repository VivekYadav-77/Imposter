"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, createIdempotencyKey, errorMessage, participantApi } from "../api/client";
import type { RoomSnapshot } from "../api/types";
import { Banner, Button, Field } from "./ui";

type Mode = "create" | "join";
export function PlayForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("create");
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [minPlayers, setMinPlayers] = useState(3);
  const [maxPlayers, setMaxPlayers] = useState(12);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resumeRoom, setResumeRoom] = useState<RoomSnapshot | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const key = useRef(createIdempotencyKey());
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
          setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);
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
    setError("");
    key.current = createIdempotencyKey();
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (nicknameError || codeError || !accepted || busy) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "create")
        await participantApi.createRoom(nickname.trim(), minPlayers, maxPlayers, key.current);
      else await participantApi.joinRoom(code, nickname.trim(), key.current);
      router.replace("/room");
    } catch (cause) {
      if (!(cause instanceof ApiError && cause.retryable)) key.current = createIdempotencyKey();
      setError(errorMessage(cause));
      setBusy(false);
    }
  };
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
          <Button onClick={() => router.replace("/room")}>
            {activeGame ? "Resume game" : completedGame ? "View results" : "Return to room"}
          </Button>
          {!activeGame && (
            <Button
              variant="secondary"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await participantApi.leave();
                  setResumeRoom(null);
                } catch (cause) {
                  setError(errorMessage(cause));
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
            To protect the match, an active seat can’t be replaced by joining again with a new
            identity.
          </p>
        )}
        {error && <Banner tone="danger">{error}</Banner>}
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
        {error && <Banner tone="danger">{error}</Banner>}
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
        {mode === "create" && (
          <div className="form-grid two-column">
            <label className="field">
              <span className="field-label">Minimum players</span>
              <select
                value={minPlayers}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setMinPlayers(value);
                  if (maxPlayers < value) setMaxPlayers(value);
                  key.current = createIdempotencyKey();
                }}
              >
                {Array.from({ length: 13 }, (_, index) => index + 3).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <span className="field-hint">At least 3 players are required.</span>
            </label>
            <label className="field">
              <span className="field-label">Maximum players</span>
              <select
                value={maxPlayers}
                onChange={(event) => {
                  setMaxPlayers(Number(event.target.value));
                  key.current = createIdempotencyKey();
                }}
              >
                {Array.from({ length: 16 - minPlayers }, (_, index) => index + minPlayers).map(
                  (value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ),
                )}
              </select>
              <span className="field-hint">Limited to 15 for reliable realtime play.</span>
            </label>
          </div>
        )}
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
        <Button
          type="submit"
          loading={busy}
          disabled={Boolean(nicknameError || codeError || !accepted)}
        >
          {mode === "create" ? "Create room" : "Join room"}
        </Button>
      </form>
    </div>
  );
}
