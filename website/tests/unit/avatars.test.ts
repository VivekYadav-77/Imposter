import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  AVATARS,
  AVATAR_IDS,
  avatarById,
  firstAvailableAvatar,
  isAvatarId,
} from "../../src/shared/avatars";

function luminance(hex: string): number {
  const channels = hex.match(/[\da-f]{2}/gi)!.map((value) => Number.parseInt(value, 16) / 255);
  const [red, green, blue] = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string): number {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("avatar catalog", () => {
  it("contains 18 unique complete identities", () => {
    expect(AVATARS).toHaveLength(18);
    expect(new Set(AVATARS.map((avatar) => avatar.id)).size).toBe(18);
    expect(new Set(AVATARS.map((avatar) => avatar.name)).size).toBe(18);
    expect(new Set(AVATARS.map((avatar) => avatar.motion)).size).toBe(18);
    for (const id of AVATAR_IDS) {
      expect(isAvatarId(id)).toBe(true);
      expect(avatarById(id).name).toBeTruthy();
    }
    expect(isAvatarId("crewmate")).toBe(false);
  });

  it("keeps every accent legible on its intended theme surface", () => {
    for (const avatar of AVATARS) {
      expect(contrast(avatar.dark, "#14130F"), `${avatar.name} dark`).toBeGreaterThanOrEqual(3);
      expect(contrast(avatar.light, "#FFFAF1"), `${avatar.name} light`).toBeGreaterThanOrEqual(3);
    }
  });

  it("selects the first unoccupied identity and reports exhaustion", () => {
    expect(firstAvailableAvatar(["fox", "owl"])).toBe("wolf");
    expect(firstAvailableAvatar(AVATAR_IDS)).toBeNull();
  });

  it("registers every SVG and reduced-motion protection", async () => {
    const [component, css] = await Promise.all([
      readFile("src/client/components/player-avatar.tsx", "utf8"),
      readFile("app/globals.css", "utf8"),
    ]);
    for (const avatar of AVATARS) {
      expect(component).toContain(`case "${avatar.id}"`);
      expect(css).toContain(`avatar-${avatar.id}`);
      expect(css).toContain(`@keyframes avatar-${avatar.motion}`);
    }
    expect(component).toContain('viewBox="0 0 64 64"');
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).not.toMatch(/\.player-avatar[^}]*linear-gradient/s);
  });
});
