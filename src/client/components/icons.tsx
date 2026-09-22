import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "arrow"
  | "camera"
  | "cooldown"
  | "difficulty"
  | "ghost"
  | "check"
  | "chevron"
  | "close"
  | "evidence"
  | "eye"
  | "lobby"
  | "lock"
  | "meeting"
  | "moon"
  | "players"
  | "room"
  | "sound"
  | "soundOff"
  | "sun"
  | "tasks"
  | "tool"
  | "spark"
  | "timer"
  | "trophy"
  | "upload"
  | "uploading"
  | "voteLock"
  | "verdict"
  | "warning";

const paths: Record<IconName, ReactNode> = {
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  camera: (
    <>
      <path d="M4 8.5h3l1.4-2h7.2l1.4 2h3v10H4z" />
      <circle cx="12" cy="13.5" r="3.2" />
    </>
  ),
  cooldown: (
    <>
      <path d="M12 5a7 7 0 1 1-6.1 3.6M4 5v4h4" />
      <path d="M12 8v4l2.8 1.8" />
    </>
  ),
  difficulty: <path d="M4 18h3V13H4Zm6 0h3V9h-3Zm6 0h3V5h-3Z" />,
  ghost: (
    <>
      <path d="M6 20V10a6 6 0 0 1 12 0v10l-3-2-3 2-3-2Z" />
      <path d="M9.5 11h.01M14.5 11h.01" />
    </>
  ),
  check: <path d="m5 12 4.2 4.2L19 6.8" />,
  chevron: <path d="m8 10 4 4 4-4" />,
  close: <path d="m6.5 6.5 11 11m0-11-11 11" />,
  evidence: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  eye: (
    <>
      <path d="M2.8 12s3.3-5.2 9.2-5.2S21.2 12 21.2 12s-3.3 5.2-9.2 5.2S2.8 12 2.8 12Z" />
      <circle cx="12" cy="12" r="2.35" />
    </>
  ),
  lobby: (
    <>
      <circle cx="9" cy="9" r="3" />
      <circle cx="17" cy="10" r="2.4" />
      <path d="M3.8 19c.4-3.3 2.1-5 5.2-5s4.8 1.7 5.2 5M14 15c3.7-.8 5.8.6 6.2 3.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </>
  ),
  meeting: (
    <>
      <path d="M6.5 18.5 4 21l.7-4.2A7 7 0 0 1 3 12c0-4.4 4-8 9-8s9 3.6 9 8-4 8-9 8a10 10 0 0 1-5.5-1.5Z" />
      <path d="M8 12h.01M12 12h.01M16 12h.01" />
    </>
  ),
  moon: <path d="M20 15.5A8.2 8.2 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />,
  players: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M3.5 19c.5-4 2.3-6 5.5-6s5 2 5.5 6M14.5 14c3.5-.5 5.5 1.2 6 4.5" />
    </>
  ),
  room: (
    <>
      <path d="M4 10.5 12 4l8 6.5V20H4Z" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  sound: (
    <>
      <path d="M4 10h3l4-3.5v11L7 14H4zM15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  soundOff: <path d="M4 10h3l4-3.5v11L7 14H4zM15 9.5l5 5m0-5-5 5" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4m10.6 10.6 1.4 1.4m0-13.4-1.4 1.4M6.7 17.3l-1.4 1.4" />
    </>
  ),
  spark: (
    <path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8ZM19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7Z" />
  ),
  timer: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M9 3h6M12 9v4l3 2" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0Z" />
      <path d="M8 6H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 13v5m-4 2h8" />
    </>
  ),
  upload: <path d="M12 16V4m-4 4 4-4 4 4M5 14v5h14v-5" />,
  uploading: (
    <>
      <path d="M12 15V5m-4 4 4-4 4 4" />
      <path d="M5 17a7 7 0 0 0 14 0" />
    </>
  ),
  voteLock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3m-6 5 1.5 1.5L15 13" />
    </>
  ),
  tasks: (
    <>
      <rect x="5" y="4" width="14" height="16" rx="2.5" />
      <path d="m8 9 1.5 1.5L12 8m1.5 2H16m-8 5 1.5 1.5L12 14m1.5 2H16" />
    </>
  ),
  tool: (
    <path d="M14.5 5.2a4.5 4.5 0 0 0-5.7 5.7L3 16.7 7.3 21l5.8-5.8a4.5 4.5 0 0 0 5.7-5.7l-3 3-3.3-3.3Z" />
  ),
  verdict: (
    <>
      <path d="m8 5 8 8m-5-11 6 6M4 18l7-7m-4 10h12" />
      <path d="m14 10 3-3" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3 2.8 20h18.4Z" />
      <path d="M12 9v5m0 3h.01" />
    </>
  ),
};

export function Icon({
  name,
  size = 24,
  ...props
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden={props["aria-label"] ? undefined : true}
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 40 40"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        className="brand-mark-orbit"
        d="M3.5 20c0-9.1 7.4-16.5 16.5-16.5S36.5 10.9 36.5 20 29.1 36.5 20 36.5 3.5 29.1 3.5 20Z"
      />
      <path
        className="brand-mark-visor"
        d="M9.5 20s3.8-6 10.5-6 10.5 6 10.5 6-3.8 6-10.5 6S9.5 20 9.5 20Z"
      />
      <circle className="brand-mark-core" cx="20" cy="20" r="2.6" />
      <path className="brand-mark-signal" d="M28.5 8.5 32 5" />
    </svg>
  );
}
