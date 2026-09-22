export const AVATARS = [
  { id: "fox", name: "Fox", dark: "#F29A5B", light: "#9A4616", motion: "ear-flick" },
  { id: "owl", name: "Owl", dark: "#E5BE5A", light: "#755600", motion: "slow-blink" },
  { id: "wolf", name: "Wolf", dark: "#8FB2D9", light: "#365F8C", motion: "head-lift" },
  { id: "raven", name: "Raven", dark: "#B59BE6", light: "#62439A", motion: "feather-ruffle" },
  { id: "moth", name: "Moth", dark: "#78C8C4", light: "#196C69", motion: "wing-pulse" },
  { id: "cobra", name: "Cobra", dark: "#78C98D", light: "#236B38", motion: "head-sway" },
  { id: "stag", name: "Stag", dark: "#D6A06D", light: "#7C4820", motion: "antler-trace" },
  { id: "hare", name: "Hare", dark: "#E3A0B2", light: "#93485F", motion: "ear-rise" },
  { id: "panther", name: "Panther", dark: "#9EA8E8", light: "#4E589C", motion: "eye-sweep" },
  { id: "shark", name: "Shark", dark: "#72BED3", light: "#17677C", motion: "fin-pass" },
  { id: "bull", name: "Bull", dark: "#E98878", light: "#9B382B", motion: "head-dip" },
  { id: "gecko", name: "Gecko", dark: "#A3C965", light: "#526F16", motion: "alternating-blink" },
  { id: "beetle", name: "Beetle", dark: "#D49764", light: "#7C451D", motion: "shell-shift" },
  { id: "spider", name: "Spider", dark: "#D58AC4", light: "#843E74", motion: "foreleg-tap" },
  { id: "bat", name: "Bat", dark: "#C090CE", light: "#71417F", motion: "wing-fold" },
  { id: "raccoon", name: "Raccoon", dark: "#ADB6BF", light: "#4F5A64", motion: "tail-curl" },
  { id: "lynx", name: "Lynx", dark: "#E0A46F", light: "#7A4D24", motion: "ear-tuft-twitch" },
  { id: "falcon", name: "Falcon", dark: "#88B0AA", light: "#386762", motion: "head-turn" },
] as const;

export type AvatarId = (typeof AVATARS)[number]["id"];
export type AvatarDefinition = (typeof AVATARS)[number];

export const AVATAR_IDS = AVATARS.map((avatar) => avatar.id) as readonly AvatarId[];

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === "string" && (AVATAR_IDS as readonly string[]).includes(value);
}

export function avatarById(id: AvatarId): AvatarDefinition {
  return AVATARS.find((avatar) => avatar.id === id)!;
}

export function firstAvailableAvatar(occupied: Iterable<string>): AvatarId | null {
  const unavailable = new Set(occupied);
  return AVATAR_IDS.find((id) => !unavailable.has(id)) ?? null;
}
