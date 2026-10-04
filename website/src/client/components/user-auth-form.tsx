"use client";

import { useState } from "react";
import { AVATARS, avatarById, type AvatarId } from "../../shared/avatars";
import { Dialog, Icon } from "./ui";
import { PlayerAvatar } from "./player-avatar";
import { GoogleMark, GoogleSignInLink } from "./google-sign-in";

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

const authErrorMessages: Record<string, string> = {
  cancelled: "Google sign-in was cancelled. You can try again whenever you’re ready.",
  invalid_response: "Google returned an incomplete response. Please try again.",
  oauth_state_invalid: "That sign-in attempt is no longer valid. Please start again.",
  oauth_transaction_expired: "That sign-in attempt expired. Please start again.",
  google_identity_conflict: "That Google account is already connected elsewhere.",
  reauth_account_mismatch: "Use the same Google account currently connected to this dashboard.",
  google_auth_failed: "Google sign-in could not be completed. Please try again.",
};

export function GoogleSignInCard({ authError }: { authError?: string }) {
  const message = authError
    ? (authErrorMessages[authError] ?? "Google sign-in could not be completed. Please try again.")
    : "";
  return (
    <section className="account-card account-auth-card google-sign-in-card">
      <span className="google-sign-in-seal" aria-hidden="true">
        <GoogleMark />
      </span>
      <div>
        <p className="eyebrow">One secure sign-in</p>
        <h2>Continue with Google</h2>
        <p className="account-dialog-intro">
          Your verified Google email connects your game history across devices. We never receive
          your Google password.
        </p>
      </div>
      {message && (
        <p className="form-error" role="alert">
          <Icon name="warning" size={18} aria-hidden="true" />
          <span>{message}</span>
        </p>
      )}
      <GoogleSignInLink intent="login" />
      <p className="account-switch">
        New players get an account automatically after Google verifies their email.
      </p>
    </section>
  );
}
