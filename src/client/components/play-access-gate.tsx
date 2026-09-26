"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ApiError, errorMessage, userApi } from "../api/client";
import { Button, Dialog, Icon } from "./ui";
import { GoogleSignInLink } from "./google-sign-in";

export function PlayAccessGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [error, setError] = useState("");
  const continuingAsGuest = useRef(false);

  useEffect(() => {
    const entry = new URLSearchParams(window.location.search).get("entry") === "1";
    if (!entry) {
      setChecking(false);
      return;
    }
    let active = true;
    userApi
      .me()
      .then(() => {
        if (!active) return;
        window.history.replaceState(window.history.state, "", "/play");
        setChecking(false);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 401) {
          setChoiceOpen(true);
          setChecking(false);
          return;
        }
        setError(errorMessage(cause));
        setChoiceOpen(true);
        setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const continueAsGuest = () => {
    continuingAsGuest.current = true;
    window.history.replaceState(window.history.state, "", "/play");
    setChoiceOpen(false);
  };

  const closeChoice = () => {
    if (continuingAsGuest.current) {
      continuingAsGuest.current = false;
      return;
    }
    router.push("/");
  };

  return (
    <>
      {checking ? (
        <div className="play-panel resume-panel" role="status" aria-live="polite">
          <p className="eyebrow">Checking your account</p>
          <h2>Preparing your seat…</h2>
        </div>
      ) : (
        children
      )}
      <Dialog open={choiceOpen} title="Choose how to play" onClose={closeChoice}>
        <div className="play-choice-dialog">
          <p>Jump in as a guest, or use Google to keep game results and rooms in your dashboard.</p>
          {error && (
            <p className="form-error" role="alert">
              <Icon name="warning" size={18} aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}
          <div className="play-choice-actions">
            <GoogleSignInLink intent="play" />
            <Button variant="secondary" onClick={continueAsGuest}>
              Play as a guest
            </Button>
          </div>
          <small>Google is only used for your player account. Guest play needs no account.</small>
        </div>
      </Dialog>
    </>
  );
}
