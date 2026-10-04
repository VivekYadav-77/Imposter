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

  it("aligns theme and sound controls inside the game command bar", async () => {
    const [css, ui, theme] = await Promise.all([
      readFile("app/game-command-center.css", "utf8"),
      readFile("src/client/components/ui.tsx", "utf8"),
      readFile("src/client/components/theme-toggle.tsx", "utf8"),
    ]);
    expect(css).toContain(".game-page .phase-utilities");
    expect(css).toContain(".game-page .game-utility-button");
    expect(css).toContain(".game-page .theme-toggle-game");
    expect(ui).toContain("<GameSoundToggle />");
    expect(ui).toContain('<ThemeToggle placement="game" />');
    expect(theme).toContain('pathname.startsWith("/room")');
  });

  it("ships the responsive Vivid Tactical command center", async () => {
    const [css, room, sounds, icons] = await Promise.all([
      readFile("app/game-command-center.css", "utf8"),
      readFile("src/client/components/room-client.tsx", "utf8"),
      readFile("src/client/audio/game-sounds.ts", "utf8"),
      readFile("src/client/components/icons.tsx", "utf8"),
    ]);
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) minmax(300px, 330px)");
    expect(css).toContain("@media (max-width: 1099px)");
    expect(css).toContain("@media (max-width: 760px)");
    expect(css).toContain("env(safe-area-inset-bottom)");
    expect(room).toContain('className="task-command-shell avatar-dashboard"');
    expect(room).toContain('className="game-context-rail"');
    expect(room).toContain('playGameSound("vote-select")');
    expect(sounds).toContain('| "upload-failure"');
    expect(icons).toContain('| "voteLock"');
  });

  it("keeps lobby copy inside the invite card and centers mobile game dialogs", async () => {
    const [room, css] = await Promise.all([
      readFile("src/client/components/room-client.tsx", "utf8"),
      readFile("app/game-command-center.css", "utf8"),
    ]);
    expect(room).toContain(
      '<PhaseBar phase="lobby" identity={room.self.nickname} avatarId={room.self.avatarId} />',
    );
    expect(room).not.toContain("aria-label={`Copy room code ${room.code}`}");
    expect(room).toContain('copied ? "Code copied" : "Copy room code"');
    expect(css).toMatch(
      /\.game-page \.dialog:not\(\.image-preview-dialog\)\s*\{[^}]*inset: 50% auto auto 50%;[^}]*transform: translate\(-50%, -50%\);/s,
    );
  });

  it("uses a custom map dropdown and a scrollable elimination dialog", async () => {
    const [room, ui, css] = await Promise.all([
      readFile("src/client/components/room-client.tsx", "utf8"),
      readFile("src/client/components/ui.tsx", "utf8"),
      readFile("app/game-command-center.css", "utf8"),
    ]);
    expect(room.match(/<GameSelect/g)?.length).toBeGreaterThanOrEqual(1);
    expect(room).toContain('className="kill-target-list"');
    expect(room).toContain('role="radiogroup" aria-label="Living crew targets"');
    expect(room).not.toContain("<select");
    expect(ui).toContain("data-placement={placement}");
    expect(ui).toContain('event.key === "ArrowDown"');
    expect(ui).toContain("export function GameSelect");
    expect(ui).toContain('role="listbox"');
    expect(ui).toContain('role="option"');
    expect(css).toMatch(/\.game-page \.game-select-menu\s*\{[^}]*width: 100%;[^}]*min-width: 0;/s);
    expect(css).toMatch(
      /\.game-page \.game-select-menu > button > span\s*\{[^}]*text-overflow: ellipsis;/s,
    );
  });

  it("uses bounded whole-number controls for numeric game settings", async () => {
    const sources = await Promise.all([
      readFile("src/client/components/room-client.tsx", "utf8"),
      readFile("src/client/components/play-form.tsx", "utf8"),
      readFile("src/client/components/admin-client.tsx", "utf8"),
    ]);
    for (const source of sources) expect(source).not.toContain("<select");
    expect(sources.join("\n")).toContain('label="Game time"');
    expect(sources.join("\n")).toContain('label="Meetings per player"');
    expect(sources.join("\n")).toContain('label="Impostors"');
    expect(sources.join("\n")).toContain("<WholeNumberField");
    expect(sources.join("\n")).not.toContain('type="number"');
  });

  it("places the host start action after the final lobby setting", async () => {
    const [room, css] = await Promise.all([
      readFile("src/client/components/room-client.tsx", "utf8"),
      readFile("app/globals.css", "utf8"),
    ]);
    expect(room.match(/Start game/g)).toHaveLength(1);
    expect(room.indexOf("Start game")).toBeGreaterThan(room.indexOf("Crew roles"));
    expect(room).toContain('className="settings-completion"');
    expect(css).toContain(".settings-completion .settings-start-button");
    expect(css).toMatch(
      /@media \(max-width: 760px\)[\s\S]*?\.settings-completion \.settings-start-button\s*\{[^}]*width: 100%;/s,
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

  it("announces accepted evidence room-wide only when evidence is public", async () => {
    const roomClient = await readFile("src/client/components/room-client.tsx", "utf8");
    expect(roomClient).toContain("A shared upload sound can reveal private evidence activity");
    expect(roomClient).toContain('game.evidenceVisibility === "public"');
    expect(roomClient.indexOf("previousProgress.current = game.progress.percent")).toBeLessThan(
      roomClient.indexOf("if (!roleAcknowledged)"),
    );
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

  it("keeps previously played rooms visible and reopenable from the dashboard", async () => {
    const [dashboard, users, rooms] = await Promise.all([
      readFile("src/client/components/user-dashboard.tsx", "utf8"),
      readFile("src/modules/user-auth/service.ts", "utf8"),
      readFile("src/modules/rooms/service.ts", "utf8"),
    ]);
    expect(dashboard).toContain("const visibleAdditionalRooms = additionalRooms.slice(0, 2)");
    expect(dashboard).toContain('"Reopen room"');
    expect(users).toContain('.where("p.membership_status", "!=", "removed")');
    expect(rooms).toContain('.set({ membership_status: "joined", disconnected_at: null');
    expect(rooms).toContain('status: "lobby"');
  });

  it("shows duration only for timed voting and explains connected-voter quorum", async () => {
    const roomClient = await readFile("src/client/components/room-client.tsx", "utf8");
    expect(roomClient).not.toContain('"Maximum wait"');
    expect(roomClient).toContain('mode === "timed" &&');
    expect(roomClient).toContain("every connected eligible player has voted");
    expect(roomClient).toContain("meeting.requiredVotes");
  });

  it("exposes the host gameplay controls and keeps evidence identities anonymous", async () => {
    const roomClient = await readFile("src/client/components/room-client.tsx", "utf8");
    expect(roomClient).toContain("Enter a whole number from 5 to 240 minutes.");
    expect(roomClient).toContain("Evidence visibility");
    expect(roomClient).toContain("Impostor task needed to call a meeting");
    expect(roomClient).toContain("Crew members always need one completed task");
    expect(roomClient).toContain("Meeting cooldown");
    expect(roomClient).toContain("The caller’s identity is never shown.");
    expect(roomClient).not.toContain("Submitted by {meeting.reviewItem");
    expect(roomClient).toContain('{task.status === "completed" ? "Done" : "To do"}');
  });

  it("closes the photo picker immediately and uploads in the background", async () => {
    const roomClient = await readFile("src/client/components/room-client.tsx", "utf8");
    expect(roomClient).toContain("if (selectedFile) void upload(selectedFile)");
    expect(roomClient).toContain("<span>Take photo</span>");
    expect(roomClient).toContain("<span>Choose from gallery</span>");
    expect(roomClient.match(/capture="environment"/g)).toHaveLength(1);
    expect(roomClient).toContain("await normalizeEvidenceImage(file, controller.signal)");
    expect(roomClient).toContain(
      "await uploadEvidenceObject(intent, preparedFile, controller.signal)",
    );
    expect(roomClient).toContain('error.code !== "GAME_STATE_CONFLICT"');
    expect(roomClient).toContain("expectedStateVersion = await refreshStateVersion()");
    expect(roomClient).toContain("onClose();");
    expect(roomClient).toContain("Uploading in the background");
    expect(roomClient).toContain('playGameSound("upload")');
    expect(roomClient).not.toContain("window.setTimeout(onClose, 650)");
    expect(roomClient).not.toContain("This will close automatically when the upload is ready.");
  });

  it("shows a responsive shared evidence archive after the final result", async () => {
    const [roomClient, css] = await Promise.all([
      readFile("src/client/components/room-client.tsx", "utf8"),
      readFile("app/globals.css", "utf8"),
    ]);
    expect(roomClient).toContain("function FinalEvidenceSection");
    expect(roomClient).toContain("With the result declared, every player can review");
    expect(roomClient).toContain("participantApi.submissions(cursor)");
    expect(roomClient).toContain(
      'game.phase === "game_over" && <FinalEvidenceSection onError={onError} />',
    );
    expect(roomClient).toContain("Open final evidence photo");
    expect(roomClient).toContain('className="final-evidence-toggle"');
    expect(roomClient).toContain("aria-expanded={open}");
    expect(roomClient).toContain("if (nextOpen && !hasLoaded && !loading) void load()");
    expect(css).toContain(".final-evidence-grid");
    expect(css).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
  });

  it("keeps game feedback compact and exposes private elimination history", async () => {
    const [roomClient, ui, css] = await Promise.all([
      readFile("src/client/components/room-client.tsx", "utf8"),
      readFile("src/client/components/ui.tsx", "utf8"),
      readFile("app/game-command-center.css", "utf8"),
    ]);
    expect(ui).toContain('className="toast-icon"');
    expect(css).toMatch(/\.game-page \.game-toast-region\s*\{[^}]*bottom: auto;/s);
    expect(roomClient).toContain('className="elimination-history-card"');
    expect(roomClient).toContain("game.self.knownEliminatedParticipantIds.map");
    expect(roomClient).toContain("Eliminated by you");
  });

  it("ships the Signal Room semantic palette and locally bundled typography", async () => {
    const [layout, css, manifest] = await Promise.all([
      readFile("app/layout.tsx", "utf8"),
      readFile("app/signal-room.css", "utf8"),
      readFile("package.json", "utf8"),
    ]);
    expect(layout).toContain('import "./signal-room.css"');
    expect(layout).toContain("@fontsource-variable/public-sans");
    expect(layout).toContain("@fontsource/barlow-condensed");
    expect(manifest).toContain('"@fontsource-variable/public-sans"');
    expect(css).toContain('html[data-theme="dark"]');
    expect(css).toContain('html[data-theme="light"]');
    expect(css).toContain("--surface-1:");
    expect(css).toContain("--text-1:");
    expect(css).toContain("--motion-fast:");
  });

  it("uses original vector identity and scene assets instead of emoji UI", async () => {
    const [icons, logo, layout, scenes, home, room] = await Promise.all([
      readFile("src/client/components/icons.tsx", "utf8"),
      readFile("public/imposter-game-logo.svg", "utf8"),
      readFile("app/layout.tsx", "utf8"),
      readFile("src/client/components/signal-visuals.tsx", "utf8"),
      readFile("app/page.tsx", "utf8"),
      readFile("src/client/components/room-client.tsx", "utf8"),
    ]);
    expect(icons).toContain("export function BrandMark");
    expect(icons).toContain("export type IconName");
    expect(logo).toContain('viewBox="0 0 40 40"');
    expect(logo).toContain("M9.5 20s3.8-6 10.5-6");
    expect(layout).toContain("/imposter-game-logo.svg");
    expect(scenes).toContain("SignalSceneArt");
    expect(home).toContain('<SignalSceneArt scene="meeting"');
    expect(room).not.toContain("🤷");
    expect(room).not.toContain("👁");
  });

  it("gives shared navigation and controls accessible touch targets", async () => {
    const css = await readFile("app/signal-room.css", "utf8");
    expect(css).toMatch(/\.site-header nav > a:not\(\.button\)[\s\S]*?min-height: 44px;/);
    expect(css).toMatch(/\.site-footer a[\s\S]*?min-height: 44px;/);
    expect(css).toMatch(/\.room-code,[\s\S]*?min-height: 44px;/);
  });
});
