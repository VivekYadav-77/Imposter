import { Icon, type IconName } from "./icons";

export type SignalScene = "lobby" | "tasks" | "meeting" | "verdict";

const sceneIcon: Record<SignalScene, IconName> = {
  lobby: "lobby",
  tasks: "tasks",
  meeting: "meeting",
  verdict: "verdict",
};

export function SignalSceneArt({
  scene,
  compact = false,
}: {
  scene: SignalScene;
  compact?: boolean;
}) {
  const titles: Record<SignalScene, string> = {
    lobby: "Players gathering around a private room signal",
    tasks: "Task evidence moving through a private case file",
    meeting: "Players discussing evidence face to face",
    verdict: "A private ballot resolving into the final verdict",
  };
  return (
    <svg
      className={`signal-scene signal-scene-${scene}${compact ? " signal-scene-compact" : ""}`}
      viewBox="0 0 640 460"
      role="img"
      aria-label={titles[scene]}
    >
      <defs>
        <linearGradient id={`${scene}-wash`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--scene-start)" />
          <stop offset="1" stopColor="var(--scene-end)" />
        </linearGradient>
        <filter id={`${scene}-grain`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            baseFrequency=".65"
            numOctaves="2"
            seed="8"
            type="fractalNoise"
            result="noise"
          />
          <feComposite in="noise" in2="SourceGraphic" operator="in" result="texture" />
          <feBlend in="SourceGraphic" in2="texture" mode="soft-light" />
        </filter>
      </defs>
      <rect width="640" height="460" rx="44" fill={`url(#${scene}-wash)`} />
      <circle className="scene-orbit scene-orbit-one" cx="514" cy="92" r="144" />
      <circle className="scene-orbit scene-orbit-two" cx="118" cy="402" r="120" />
      <path className="scene-route" d="M82 330c110-184 241 58 470-160" />
      <g className="scene-card scene-card-main" filter={`url(#${scene}-grain)`}>
        <rect x="130" y="88" width="380" height="284" rx="30" />
        <rect className="scene-card-line" x="168" y="140" width="178" height="16" rx="8" />
        <rect
          className="scene-card-line scene-card-line-short"
          x="168"
          y="174"
          width="118"
          height="12"
          rx="6"
        />
        <rect className="scene-card-window" x="168" y="222" width="304" height="104" rx="20" />
      </g>
      <g className="scene-chip">
        <circle cx="492" cy="336" r="54" />
        <foreignObject x="468" y="312" width="48" height="48">
          <span className="scene-icon">
            <Icon name={sceneIcon[scene]} size={32} />
          </span>
        </foreignObject>
      </g>
      <g className="scene-person scene-person-left">
        <circle cx="104" cy="176" r="34" />
        <path d="M55 274c5-50 21-76 49-76s44 26 49 76" />
      </g>
      <g className="scene-person scene-person-right">
        <circle cx="548" cy="208" r="28" />
        <path d="M507 288c4-40 18-60 41-60s37 20 41 60" />
      </g>
    </svg>
  );
}

export function PhaseGlyph({ scene }: { scene: SignalScene }) {
  return (
    <span className={`phase-glyph phase-glyph-${scene}`} aria-hidden="true">
      <Icon name={sceneIcon[scene]} size={26} />
    </span>
  );
}
