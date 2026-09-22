import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { contentSecurityPolicy } from "../../src/api/security-headers.js";
import { loadConfig } from "../../src/infrastructure/configuration/config.js";

const luminance = (hex: string) => {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((part) => Number.parseInt(part, 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrast = (a: string, b: string) => {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

describe("frontend design foundations", () => {
  it("keeps approved normal-text pairs above WCAG AA", () => {
    expect(contrast("#ede7d8", "#14130f")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ede7d8", "#4a6878")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#14130f", "#c9a227")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ede7d8", "#a63f2b")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#242119", "#f4f0e6")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#fffaf1", "#3d6578")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#fffaf1", "#a6530b")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#2b211c", "#fffaf1")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#6b5e54", "#fffdf7")).toBeGreaterThanOrEqual(4.5);
  });

  it("ships focus, reduced-motion, safe-area, and small-phone rules", async () => {
    const css = await readFile("app/globals.css", "utf8");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("safe-area-inset-bottom");
    expect(css).toContain("max-width: 360px");
  });

  it("keeps the game sound control fixed below the sticky phase bar", async () => {
    const css = await readFile("app/globals.css", "utf8");
    expect(css).toMatch(
      /\.sound-toggle\s*\{[^}]*position: fixed;[^}]*top: calc\(max\(12px, env\(safe-area-inset-top\)\) \+ 96px\);[^}]*left: max\(14px, env\(safe-area-inset-left\)\);/s,
    );
    expect(css).toMatch(
      /@media \(max-width: 760px\)[\s\S]*?\.sound-toggle\s*\{[^}]*top: calc\(max\(8px, env\(safe-area-inset-top\)\) \+ 82px\);/s,
    );
  });

  it("allows Next.js hydration through a per-request script nonce", () => {
    const development = contentSecurityPolicy(
      loadConfig({ APP_ENV: "development", DATABASE_URL: "postgresql://localhost/test" }),
      "test-nonce",
    );
    expect(development).toContain("script-src 'self' 'nonce-test-nonce' 'strict-dynamic'");
    expect(development).toContain("'unsafe-eval'");
  });

  it("ships a persisted, pre-paint light and dark theme system", async () => {
    const [layout, css, initializer, toggle] = await Promise.all([
      readFile("app/layout.tsx", "utf8"),
      readFile("app/globals.css", "utf8"),
      readFile("public/theme-init.js", "utf8"),
      readFile("src/client/components/theme-toggle.tsx", "utf8"),
    ]);
    expect(layout).toContain('src="/theme-init.js"');
    expect(layout).toContain("suppressHydrationWarning");
    expect(layout).toContain("<ThemeToggle />");
    expect(css).toContain('html[data-theme="light"]');
    expect(css).toContain('html[data-theme="dark"] .admin-page');
    expect(initializer).toContain('matchMedia("(prefers-color-scheme: light)")');
    expect(toggle).toContain("aria-label={label}");
    expect(toggle).toContain("localStorage.setItem(STORAGE_KEY, theme)");
  });

  it("keeps intentionally dark privacy surfaces legible when the light theme is active", async () => {
    const css = await readFile("app/globals.css", "utf8");
    expect(css).toMatch(/\.role-card\.revealed\s*\{[^}]*color: #ede7d8;/s);
    expect(css).toMatch(
      /html\[data-theme="light"\] \.game-toast-region \.toast-danger\s*\{[^}]*color: #852819;/s,
    );
  });

  it("themes both locked and open impostor console states", async () => {
    const css = await readFile("app/globals.css", "utf8");
    expect(css).toMatch(
      /html\[data-theme="light"\]\s*\{[^}]*--covert-surface: #fffaf1;[^}]*--covert-cover: linear-gradient\(120deg, #fffdf7, #eee5d4\);[^}]*--covert-ink: #2b211c;[^}]*--covert-open-surface: radial-gradient\(circle at top right, #f4dcd5, #fffaf1 52%\);/s,
    );
    expect(css).toMatch(
      /\.covert-console\s*\{[^}]*background: var\(--covert-surface\);[^}]*color: var\(--covert-ink\);/s,
    );
    expect(css).toMatch(/\.covert-cover\s*\{[^}]*background: var\(--covert-cover\);/s);
    expect(css).toMatch(
      /\.covert-console\.is-open\s*\{[^}]*background: var\(--covert-open-surface\);/s,
    );
  });

  it("themes the expanded results surfaces in both color schemes", async () => {
    const css = await readFile("app/globals.css", "utf8");
    expect(css).toMatch(
      /html\[data-theme="light"\]\s*\{[^}]*--results-panel: #f1eadc;[^}]*--vote-feed-panel: #f7f1e5;[^}]*--vote-feed-row: #fffdf7;/s,
    );
    expect(css).toMatch(/\.full-results\s*\{[^}]*background: var\(--results-panel\);/s);
    expect(css).toMatch(/\.public-vote-feed\s*\{[^}]*background: var\(--vote-feed-panel\);/s);
    expect(css).toMatch(/\.public-vote-feed li\s*\{[^}]*background: var\(--vote-feed-row\);/s);
  });

  it("labels and themes both sides of the public ballot mapping", async () => {
    const [css, roomClient] = await Promise.all([
      readFile("app/globals.css", "utf8"),
      readFile("src/client/components/room-client.tsx", "utf8"),
    ]);
    expect(roomClient).toContain("<small>Voter</small>");
    expect(roomClient).toContain("<small>Voted for</small>");
    expect(roomClient).toContain('className="ballot-direction"');
    expect(css).toMatch(
      /html\[data-theme="light"\]\s*\{[^}]*--vote-feed-line: #c5ae7d;[^}]*--vote-feed-direction: #8c480c;[^}]*--vote-feed-direction-surface: #efe3cb;/s,
    );
    expect(css).toMatch(/\.ballot-copy strong\s*\{[^}]*color: var\(--ink\);/s);
  });

  it("uses one deterministic toggle for revealing and hiding the private role", async () => {
    const roomClient = await readFile("src/client/components/room-client.tsx", "utf8");
    expect(roomClient).toContain("onClick={() => setRevealed(!revealed)}");
    expect(roomClient).not.toContain("onPointerUp={() => setRevealed(false)}");
  });

  it("refreshes an uploader's task preview while evidence is processing", async () => {
    const roomClient = await readFile("src/client/components/room-client.tsx", "utf8");
    expect(roomClient).toContain('item.processingStatus === "pending"');
    expect(roomClient).toContain("window.setTimeout(() => void refreshOwnProofs(), 1_250)");
    expect(roomClient).toContain("window.clearTimeout(refreshTimer)");
  });

  it("offers the saved participant seat instead of creating a duplicate identity", async () => {
    const [playForm, roomClient] = await Promise.all([
      readFile("src/client/components/play-form.tsx", "utf8"),
      readFile("src/client/components/room-client.tsx", "utf8"),
    ]);
    expect(playForm).toContain("Resume game");
    expect(playForm).toContain("View results");
    expect(playForm).toContain("Play new game");
    expect(playForm).toMatch(/participantApi\s*\.room\(\)/);
    expect(playForm).toContain('if (room.status !== "active") await participantApi.leave()');
    expect(playForm).toContain('setMode("create")');
    expect(playForm).toContain("setNickname(room.self.nickname)");
    expect(roomClient).toContain('window.addEventListener("beforeunload", warnBeforeExit)');
  });

  it("shows duration only for timed voting and explains connected-voter quorum", async () => {
    const roomClient = await readFile("src/client/components/room-client.tsx", "utf8");
    expect(roomClient).not.toContain('"Maximum wait"');
    expect(roomClient).toContain('mode === "timed" &&');
    expect(roomClient).toContain("every connected eligible player has voted");
    expect(roomClient).toContain("meeting.requiredVotes");
  });
});
