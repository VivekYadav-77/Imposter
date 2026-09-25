"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AVATARS, avatarById, type AvatarId } from "../../shared/avatars";
import { userApi, errorMessage } from "../api/client";
import { Button, Dialog, Field, Icon, PasswordField } from "./ui";
import { PlayerAvatar } from "./player-avatar";

export function AvatarChooser({
  value,
  onChange,
  compact = false,
}: {
  value: AvatarId;
  onChange: (value: AvatarId) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = avatarById(value);
  return (
    <div className={compact ? "account-avatar-choice compact" : "account-avatar-choice"}>
      <span className="field-label">Default avatar</span>
      <button
        type="button"
        className="account-avatar-trigger"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <PlayerAvatar id={value} size={compact ? 38 : 46} />
        <span>
          <strong>{selected.name}</strong>
          <small>Selected operative</small>
        </span>
        <span className="account-avatar-change">
          Change <Icon name="chevron" size={17} />
        </span>
      </button>
      <Dialog open={open} title="Choose your operative" onClose={() => setOpen(false)}>
        <p className="account-dialog-intro">Pick the identity shown when you join a room.</p>
        <div className="account-avatar-grid" role="radiogroup" aria-label="Available avatars">
          {AVATARS.map((avatar) => (
            <button
              key={avatar.id}
              type="button"
              role="radio"
              aria-checked={value === avatar.id}
              className={value === avatar.id ? "selected" : ""}
              onClick={() => {
                onChange(avatar.id);
                setOpen(false);
              }}
            >
              <PlayerAvatar id={avatar.id} size={44} />
              <span>{avatar.name}</span>
            </button>
          ))}
        </div>
      </Dialog>
    </div>
  );
}

export function UserAuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarId, setAvatarId] = useState<AvatarId>("fox");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "register") await userApi.register({ email, password, displayName, avatarId });
      else await userApi.login(email, password);
      router.push("/dashboard");
      router.refresh();
    } catch (value) {
      setError(errorMessage(value));
      setBusy(false);
    }
  }

  return (
    <form className="account-card account-auth-card" onSubmit={submit}>
      {mode === "register" && (
        <Field
          label="Display name"
          value={displayName}
          maxLength={24}
          autoComplete="nickname"
          required
          disabled={busy}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      )}
      <Field
        label="Email"
        type="email"
        value={email}
        autoComplete="email"
        required
        disabled={busy}
        onChange={(event) => setEmail(event.target.value)}
      />
      <PasswordField
        label="Password"
        value={password}
        minLength={mode === "register" ? 12 : undefined}
        maxLength={128}
        autoComplete={mode === "register" ? "new-password" : "current-password"}
        hint={
          mode === "register"
            ? "Use at least 12 characters. Password recovery is not available."
            : undefined
        }
        required
        disabled={busy}
        onChange={(event) => setPassword(event.target.value)}
      />
      {mode === "register" && <AvatarChooser value={avatarId} onChange={setAvatarId} />}
      {error && (
        <p className="form-error" role="alert">
          <Icon name="warning" size={18} aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
      <Button className="account-submit" loading={busy} type="submit">
        {mode === "register" ? "Create account" : "Sign in"}
      </Button>
      <p className="account-switch">
        {mode === "register" ? (
          <>
            Already registered? <Link href="/login">Sign in</Link>
          </>
        ) : (
          <>
            New here? <Link href="/register">Create an account</Link>
          </>
        )}
      </p>
    </form>
  );
}
