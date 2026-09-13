"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, createIdempotencyKey, errorMessage, participantApi } from "../api/client";
import { Banner, Button, Field } from "./ui";

type Mode = "create" | "join";
export function PlayForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("create");
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const key = useRef(createIdempotencyKey());
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
      if (mode === "create") await participantApi.createRoom(nickname.trim(), key.current);
      else await participantApi.joinRoom(code, nickname.trim(), key.current);
      router.replace("/room");
    } catch (cause) {
      if (!(cause instanceof ApiError && cause.retryable)) key.current = createIdempotencyKey();
      setError(errorMessage(cause));
      setBusy(false);
    }
  };
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
