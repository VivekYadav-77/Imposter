"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { AVATARS, avatarById, type AvatarId } from "../../shared/avatars";

type AvatarStyle = CSSProperties & {
  "--avatar-dark": string;
  "--avatar-light": string;
  "--avatar-size": string;
};

function Face({ children }: { children: ReactNode }) {
  return (
    <>
      <circle className="avatar-backplate" cx="32" cy="32" r="27" />
      {children}
    </>
  );
}

function AvatarArt({ id }: { id: AvatarId }) {
  switch (id) {
    case "fox":
      return (
        <Face>
          <g className="avatar-motion avatar-part-a">
            <path d="M16 14l11 8-8 13zM48 14L37 22l8 13z" />
          </g>
          <path d="M19 27l13-9 13 9-4 19-9 7-9-7z" />
          <path className="avatar-detail" d="M24 33l5 2m11-2-5 2m-6 8h6" />
        </Face>
      );
    case "owl":
      return (
        <Face>
          <path d="M17 22l7-9 8 7 8-7 7 9-2 21-13 10-13-10z" />
          <g className="avatar-motion avatar-part-a avatar-detail">
            <circle cx="25" cy="32" r="6" />
            <circle cx="39" cy="32" r="6" />
          </g>
          <path className="avatar-detail" d="M29 42l3-5 3 5" />
        </Face>
      );
    case "wolf":
      return (
        <Face>
          <g className="avatar-motion">
            <path d="M16 17l12 7 4-9 4 9 12-7-5 28-11 8-11-8z" />
            <path className="avatar-detail" d="M24 33l5 2m11-2-5 2m-6 9h6" />
          </g>
        </Face>
      );
    case "raven":
      return (
        <Face>
          <g className="avatar-motion avatar-part-a">
            <path d="M14 35c9-17 22-20 36-9-8 1-12 4-15 9l15 5-15 4-7 10c-8-4-13-10-14-19z" />
          </g>
          <path className="avatar-detail" d="M28 31h2" />
        </Face>
      );
    case "moth":
      return (
        <Face>
          <g className="avatar-motion avatar-part-a">
            <path d="M30 27C22 14 10 15 13 31c2 9 10 13 17 8zm4 0c8-13 20-12 17 4-2 9-10 13-17 8z" />
          </g>
          <path d="M29 25h6l2 22-5 7-5-7z" />
          <path className="avatar-detail" d="M30 24l-5-8m9 8 5-8" />
        </Face>
      );
    case "cobra":
      return (
        <Face>
          <g className="avatar-motion">
            <path d="M19 30c0-12 7-18 13-18s13 6 13 18l-7 18-6 6-6-6z" />
            <path className="avatar-detail" d="M25 30h4m6 0h4m-10 10l3 3 3-3" />
          </g>
        </Face>
      );
    case "stag":
      return (
        <Face>
          <g className="avatar-motion avatar-part-a avatar-detail">
            <path d="M24 25L16 14m8 7-1-10m17 14 8-11m-8 7 1-10" />
          </g>
          <path d="M21 25l11-6 11 6-3 20-8 9-8-9z" />
          <path className="avatar-detail" d="M26 33h3m6 0h3m-9 10h6" />
        </Face>
      );
    case "hare":
      return (
        <Face>
          <g className="avatar-motion avatar-part-a">
            <path d="M21 27c-5-14-1-21 5-18l5 18m12 0c5-14 1-21-5-18l-5 18" />
          </g>
          <path d="M19 31c2-10 24-10 26 0l-5 17-8 6-8-6z" />
          <path className="avatar-detail" d="M25 36h3m8 0h3m-10 8h6" />
        </Face>
      );
    case "panther":
      return (
        <Face>
          <path d="M16 23l9-9 7 8 7-8 9 9-5 24-11 7-11-7z" />
          <g className="avatar-motion avatar-part-a avatar-detail">
            <path d="M23 33l7 2m11-2-7 2" />
          </g>
          <path className="avatar-detail" d="M29 44h6" />
        </Face>
      );
    case "shark":
      return (
        <Face>
          <path d="M11 37c8-15 23-19 39-9l5-7-1 17 1 11-7-6c-15 9-29 3-37-6z" />
          <g className="avatar-motion avatar-part-a">
            <path d="M29 25l7-13 4 16z" />
          </g>
          <path className="avatar-detail" d="M22 34h2m4 7c6 2 11 1 15-2" />
        </Face>
      );
    case "bull":
      return (
        <Face>
          <g className="avatar-motion">
            <path d="M20 24c-8 0-11-5-10-12 5 6 9 5 15 5m19 7c8 0 11-5 10-12-5 6-9 5-15 5" />
            <path d="M19 23l13-7 13 7-4 24-9 7-9-7z" />
            <path className="avatar-detail" d="M25 33h4m6 0h4m-10 10h6" />
          </g>
        </Face>
      );
    case "gecko":
      return (
        <Face>
          <path d="M15 31c5-15 29-19 36-4-3 17-13 26-28 25-8-5-11-12-8-21z" />
          <g className="avatar-motion avatar-part-a avatar-detail">
            <circle cx="25" cy="31" r="5" />
            <circle cx="40" cy="28" r="5" />
          </g>
          <path className="avatar-detail" d="M27 42c5 3 10 2 13-1" />
        </Face>
      );
    case "beetle":
      return (
        <Face>
          <path d="M24 21c1-8 15-8 16 0l7 9-3 18-12 7-12-7-3-18z" />
          <g className="avatar-motion avatar-part-a avatar-detail">
            <path d="M32 22v31M19 31h26" />
          </g>
          <path className="avatar-detail" d="M25 18l-5-7m19 7 5-7" />
        </Face>
      );
    case "spider":
      return (
        <Face>
          <path d="M25 26c0-9 14-9 14 0l5 13c2 9-22 9-20 0z" />
          <g className="avatar-motion avatar-part-a avatar-detail">
            <path d="M25 29L13 21m12 15-14-2m15 9-12 7m25-21 12-8M39 36l14-2m-15 9 12 7" />
          </g>
          <circle className="avatar-detail" cx="29" cy="27" r="1" />
          <circle className="avatar-detail" cx="35" cy="27" r="1" />
        </Face>
      );
    case "bat":
      return (
        <Face>
          <g className="avatar-motion avatar-part-a">
            <path d="M31 27L20 14l-2 9-9-2 9 24 13 9zm2 0 11-13 2 9 9-2-9 24-13 9z" />
          </g>
          <path className="avatar-detail" d="M27 35h3m7 0h-3" />
        </Face>
      );
    case "raccoon":
      return (
        <Face>
          <path d="M17 24l9-10 6 7 6-7 9 10-5 24-10 6-10-6z" />
          <g className="avatar-motion avatar-part-a">
            <path className="avatar-detail" d="M20 31l10-3-3 10zm24 0-10-3 3 10z" />
          </g>
          <path className="avatar-detail" d="M29 44h6" />
        </Face>
      );
    case "lynx":
      return (
        <Face>
          <g className="avatar-motion avatar-part-a">
            <path d="M18 25l1-15 9 11m18 4-1-15-9 11" />
          </g>
          <path d="M18 25l14-7 14 7-5 23-9 6-9-6z" />
          <path className="avatar-detail" d="M24 33l6 2m10-2-6 2m-5 9h6" />
        </Face>
      );
    case "falcon":
      return (
        <Face>
          <g className="avatar-motion">
            <path d="M16 34c7-18 22-23 37-13l-13 8 9 5-13 4-3 16c-10-3-16-10-17-20z" />
            <path className="avatar-detail" d="M29 28h3" />
          </g>
        </Face>
      );
  }
}

export function PlayerAvatar({
  id,
  size = 42,
  status,
  className = "",
  animate = true,
}: {
  id: AvatarId;
  size?: number;
  status?: "connected" | "away";
  className?: string;
  animate?: boolean;
}) {
  const avatar = avatarById(id);
  const avatarRef = useRef<HTMLSpanElement>(null);
  const style: AvatarStyle = {
    "--avatar-dark": avatar.dark,
    "--avatar-light": avatar.light,
    "--avatar-size": `${size}px`,
  };
  useEffect(() => {
    const element = avatarRef.current;
    if (!element || !animate) return;
    const surface = element.closest<HTMLElement>(
      ".avatar-choice, .avatar-accent-card, .avatar-dashboard, .phase-identity, .reported-player-chip, .ballot-party, .meeting-tally > span",
    );
    if (!surface) return;
    let firstFrame = 0;
    let secondFrame = 0;
    const replay = () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      element.classList.remove("avatar-animated");
      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => element.classList.add("avatar-animated"));
      });
    };
    surface.addEventListener("pointerenter", replay);
    surface.addEventListener("pointerdown", replay);
    surface.addEventListener("focusin", replay);
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      surface.removeEventListener("pointerenter", replay);
      surface.removeEventListener("pointerdown", replay);
      surface.removeEventListener("focusin", replay);
    };
  }, [animate, id]);
  return (
    <span
      ref={avatarRef}
      className={`player-avatar avatar-${id} ${animate ? "avatar-animated" : ""} ${className}`}
      data-avatar={id}
      data-status={status}
      style={style}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" focusable="false">
        <AvatarArt id={id} />
      </svg>
    </span>
  );
}

export function AvatarPicker({
  availableIds,
  value,
  onChange,
  disabled = false,
}: {
  availableIds: readonly AvatarId[];
  value: AvatarId | null;
  onChange: (id: AvatarId) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="avatar-picker" disabled={disabled}>
      <legend>Choose your operative</legend>
      <p>One operative per player in this room.</p>
      <div className="avatar-picker-grid" role="radiogroup" aria-label="Available avatars">
        {availableIds.map((id) => {
          const avatar = avatarById(id);
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              className={selected ? "avatar-choice selected" : "avatar-choice"}
              role="radio"
              aria-checked={selected}
              aria-label={`${avatar.name} avatar, available${selected ? ", selected" : ""}`}
              onClick={() => onChange(id)}
              style={
                {
                  "--avatar-dark": avatar.dark,
                  "--avatar-light": avatar.light,
                } as AvatarStyle
              }
            >
              <PlayerAvatar id={id} size={64} animate={selected} />
              <span>{avatar.name}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export { AVATARS };
