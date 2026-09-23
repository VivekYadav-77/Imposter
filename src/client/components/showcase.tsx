"use client";

import { useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { AVATAR_IDS, avatarById, type AvatarId } from "../../shared/avatars";
import { AvatarPicker, PlayerAvatar } from "./player-avatar";
import { SignalSceneArt } from "./signal-visuals";
import {
  Badge,
  Banner,
  Button,
  Dialog,
  Drawer,
  Field,
  GameShell,
  GameSelect,
  Icon,
  IdentityToken,
  PhaseBar,
  Progress,
  SkeletonList,
  Tabs,
  Timer,
  Toast,
} from "./ui";

type AvatarAccentStyle = CSSProperties & { "--avatar-dark": string; "--avatar-light": string };

function avatarAccentStyle(id: AvatarId): AvatarAccentStyle {
  const avatar = avatarById(id);
  return { "--avatar-dark": avatar.dark, "--avatar-light": avatar.light };
}

function FixtureTimer({ value, label }: { value: string; label: string }) {
  return (
    <div className="timer" aria-label={`${label}: ${value}`}>
      <span>{value}</span>
      <small>{label}</small>
    </div>
  );
}

export function Showcase() {
  const fixture = useSearchParams().get("fixture");
  const [tab, setTab] = useState("controls");
  const [drawer, setDrawer] = useState(false);
  if (fixture) return <GameFixture state={fixture} />;
  return (
    <main id="main-content" className="showcase">
      <p className="eyebrow">Development only</p>
      <h1>Component showcase</h1>
      <Tabs
        label="Component groups"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "controls", label: "Controls" },
          { id: "feedback", label: "Game states" },
        ]}
      />
      {tab === "controls" ? (
        <section className="showcase-grid">
          <article className="card">
            <h2>Actions</h2>
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="danger">Destructive</Button>
            <Button loading>Loading</Button>
          </article>
          <article className="card">
            <h2>Inputs</h2>
            <Field label="Nickname" hint="24 characters maximum" placeholder="Case name" />
            <Field label="Invalid field" error="Check this value." defaultValue="Wrong" />
            <Button variant="secondary" onClick={() => setDrawer(true)}>
              Open drawer
            </Button>
          </article>
          <article className="card">
            <h2>Status</h2>
            <div className="component-row">
              <Badge>Draft</Badge>
              <Badge tone="success">Accepted</Badge>
              <Badge tone="warning">Pending</Badge>
              <Badge tone="danger">Rejected</Badge>
            </div>
            <Progress value={3} max={5} label="Evidence processed" />
            <IdentityToken name="Ada Lovelace" avatarId="owl" status="connected" />
          </article>
          <article className="card">
            <h2>Feedback</h2>
            <Banner tone="info">Informational message</Banner>
            <Banner tone="danger">Action failed safely</Banner>
            <Toast>Room reconnected.</Toast>
          </article>
          <article className="card">
            <h2>Loading</h2>
            <SkeletonList count={2} />
          </article>
        </section>
      ) : (
        <section className="showcase-state-grid" aria-label="Deterministic game-state previews">
          <article className="showcase-state">
            <SignalSceneArt scene="lobby" compact />
            <Badge tone="info">Lobby</Badge>
            <h2>Waiting for the room</h2>
            <p>Seven players connected. The host is choosing the final rules.</p>
          </article>
          <article className="showcase-state">
            <SignalSceneArt scene="tasks" compact />
            <Badge tone="warning">Tasks</Badge>
            <h2>Evidence in progress</h2>
            <Progress value={3} max={5} label="Crew progress" />
          </article>
          <article className="showcase-state">
            <SignalSceneArt scene="meeting" compact />
            <Badge tone="danger">Meeting</Badge>
            <h2>Review the proof</h2>
            <p>Long-name fixture: Captain Extremely Suspicious Participant</p>
          </article>
          <article className="showcase-state">
            <SignalSceneArt scene="verdict" compact />
            <Badge tone="success">Results</Badge>
            <h2>No one was ejected</h2>
            <p>The ballot tied. Return to the room and watch the next move.</p>
          </article>
        </section>
      )}
      <section className="showcase-phase">
        <PhaseBar phase="meeting" identity="Ada" avatarId="owl">
          <Timer deadline={new Date(Date.now() + 90_000).toISOString()} />
        </PhaseBar>
      </section>
      <Drawer open={drawer} title="Roster drawer" onClose={() => setDrawer(false)}>
        <p>Drawer content remains keyboard-operable and uses a labeled close control.</p>
      </Drawer>
    </main>
  );
}

function GameFixture({ state }: { state: string }) {
  if (state === "select") return <SelectFixture />;
  if (state === "avatars") return <AvatarFixture />;

  if (state === "toast") {
    return (
      <main id="main-content" className="game-page game-dashboard-fixture">
        <GameShell phase="lobby" identity="Host player" avatarId="fox">
          <div className="game-content" />
        </GameShell>
        <div className="game-toast-region" aria-label="Game notifications">
          <Toast>
            <span>Game setting saved.</span>
            <button className="icon-button toast-dismiss" aria-label="Dismiss notification">
              <Icon name="close" size={18} />
            </button>
          </Toast>
        </div>
      </main>
    );
  }

  if (state === "dialog") {
    return (
      <main id="main-content" className="game-page game-dashboard-fixture">
        <GameShell phase="tasks" identity="Visible Player Name" avatarId="raven">
          <div className="game-content">
            <Dialog open title="Call a meeting?" onClose={() => undefined}>
              <p className="muted">Voting will open after everyone gathers.</p>
              <div className="dialog-actions">
                <Button variant="secondary">Cancel</Button>
                <Button>Open meeting</Button>
              </div>
            </Dialog>
          </div>
        </GameShell>
      </main>
    );
  }

  if (state === "role") {
    return (
      <main id="main-content" className="game-page game-dashboard-fixture">
        <GameShell phase="role" identity="Captain Extremely Suspicious" avatarId="panther">
          <section
            className="role-screen role-screen-crew avatar-dashboard"
            style={avatarAccentStyle("panther")}
          >
            <PlayerAvatar id="panther" size={96} className="dashboard-avatar-watermark" />
            <p className="eyebrow">Private briefing</p>
            <div className="role-card revealed">
              <span className="seal-mark" aria-hidden="true">
                <Icon name="eye" size={32} />
              </span>
              <div>
                <p>Your role</p>
                <h1>CREW</h1>
                <p>Complete your tasks. Watch everyone.</p>
              </div>
            </div>
            <Button>I understand</Button>
            <p className="privacy-note">
              Your role will hide if you switch apps or lock your phone.
            </p>
          </section>
        </GameShell>
      </main>
    );
  }

  if (state === "voting" || state === "results") {
    const results = state === "results";
    return (
      <main id="main-content" className="game-page game-dashboard-fixture">
        <GameShell
          phase={results ? "results" : "voting"}
          identity="Captain Extremely Suspicious"
          avatarId="panther"
          status={<FixtureTimer value="01:16" label="Meeting time" />}
        >
          <div
            className="game-content narrow meeting-view avatar-dashboard"
            style={avatarAccentStyle("panther")}
          >
            <PlayerAvatar id="panther" size={96} className="dashboard-avatar-watermark" />
            <p className="eyebrow">Meeting 2</p>
            <h1>{results ? "Room decision" : "Who do you trust least?"}</h1>
            {results ? (
              <section className="result-card elimination-reveal" aria-live="polite">
                <span className="stamp">DECISION</span>
                <h2>No one was ejected</h2>
                <div className="meeting-tally">
                  <span>
                    Ada<strong>2</strong>
                  </span>
                  <span>
                    Skipped<strong>2</strong>
                  </span>
                </div>
                <p>Individual ballots are private. The game will continue from the server state.</p>
              </section>
            ) : (
              <>
                <p className="lead">
                  Choose carefully. Your ballot locks as soon as you confirm it.
                </p>
                <div className="voting-grid">
                  {["Ada", "Max", "Captain Extremely Suspicious", "Skip"].map((name, index) => (
                    <button
                      className={`voting-option avatar-accent-card ${index === 1 ? "selected" : ""}`}
                      key={name}
                      style={avatarAccentStyle(AVATAR_IDS[index] ?? "fox")}
                    >
                      <IdentityToken name={name} avatarId={AVATAR_IDS[index] ?? "fox"} />
                      <strong>{name}</strong>
                      <small>{index === 1 ? "Selected" : "Tap to select"}</small>
                    </button>
                  ))}
                </div>
                <div className="vote-progress-line">
                  <span style={{ width: "50%" }} />
                </div>
                <p className="vote-count">2 of 4 required ballots locked</p>
              </>
            )}
          </div>
        </GameShell>
      </main>
    );
  }

  const tasks = [
    ["Photograph something unexpectedly blue", "Easy task", "ready"],
    ["Recreate the last pose you saw", "Medium task", "processing"],
    ["Find an object that does not belong", "Hard task", "empty"],
    ["Make the room vote on the best disguise", "Medium task", "empty"],
    ["Capture a reflection without showing your face", "Hard task", "empty"],
  ] as const;
  return (
    <main id="main-content" className="game-page game-dashboard-fixture">
      <GameShell
        phase="tasks"
        identity="Captain Extremely Suspicious"
        avatarId="panther"
        status={
          <div className="header-game-status">
            <Progress value={42} max={100} label="Crew progress" />
            <FixtureTimer value="11:42" label="Task time" />
          </div>
        }
      >
        <div className="task-command-shell avatar-dashboard" style={avatarAccentStyle("panther")}>
          <PlayerAvatar id="panther" size={96} className="dashboard-avatar-watermark" />
          <div className="game-content task-command-main">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Avengers</p>
                <h1>Your assignments</h1>
              </div>
            </div>
            <div className="task-list">
              {tasks.map(([description, difficulty, proof], index) => (
                <article
                  className={`task-card ${index === 0 ? "task-complete" : ""}`}
                  key={description}
                >
                  <button className="task-card-main">
                    <span className="task-number">{String(index + 1).padStart(2, "0")}</span>
                    <span>
                      <strong>{description}</strong>
                      <small className="task-difficulty">
                        <Icon name="difficulty" size={14} />
                        {difficulty}
                      </small>
                      <small>
                        {index === 0 ? "Done · proof accepted" : "Open to add photo proof"}
                      </small>
                    </span>
                    <Badge tone={index === 0 ? "success" : "warning"}>
                      {index === 0 ? "Done" : "To do"}
                    </Badge>
                  </button>
                  <button className="task-proof" aria-label={`Evidence for ${description}`}>
                    <span aria-hidden="true">
                      <Icon
                        name={
                          proof === "processing"
                            ? "uploading"
                            : proof === "ready"
                              ? "check"
                              : "camera"
                        }
                        size={23}
                      />
                    </span>
                    <small>
                      {proof === "processing"
                        ? "Processing"
                        : proof === "ready"
                          ? "Preview"
                          : "Add photo"}
                    </small>
                  </button>
                </article>
              ))}
            </div>
          </div>
          <aside className="game-context-rail" aria-label="Game controls and status">
            <section
              className="live-identity-card avatar-accent-card"
              style={avatarAccentStyle("panther")}
            >
              <IdentityToken
                name="Captain Extremely Suspicious"
                avatarId="panther"
                status="connected"
              />
              <div>
                <span>Playing as</span>
                <strong>Captain Extremely Suspicious</strong>
                <small>Imposter</small>
              </div>
              <button className="icon-button" aria-label="View role details">
                <Icon name="eye" size={20} />
              </button>
            </section>
            <section className="elimination-history-card" aria-labelledby="fixture-history-title">
              <div className="context-card-heading">
                <span className="elimination-history-icon" aria-hidden="true">
                  <Icon name="ghost" size={20} />
                </span>
                <div>
                  <span className="eyebrow">Private record</span>
                  <strong id="fixture-history-title">Your eliminations</strong>
                </div>
                <Badge tone="danger">2</Badge>
              </div>
              <ul className="elimination-history-list">
                {["Ada", "Max with a very long callsign"].map((name) => (
                  <li
                    className="avatar-accent-card"
                    key={name}
                    style={avatarAccentStyle(name === "Ada" ? "owl" : "wolf")}
                  >
                    <IdentityToken name={name} avatarId={name === "Ada" ? "owl" : "wolf"} />
                    <span>
                      <strong>{name}</strong>
                      <small>Eliminated by you</small>
                    </span>
                    <Icon name="check" size={17} />
                  </li>
                ))}
              </ul>
            </section>
            <section className="context-progress-card">
              <div className="context-card-heading">
                <Icon name="tasks" size={20} />
                <strong>Mission status</strong>
              </div>
              <Progress value={42} max={100} label="Crew progress" />
              <Button variant="ghost">
                <Icon name="evidence" size={18} /> View evidence
              </Button>
            </section>
            <section className="meeting-action-rail is-ready">
              <div className="context-card-heading">
                <Icon name="meeting" size={20} />
                <strong>Emergency meeting</strong>
              </div>
              <div className="meeting-call-copy">
                <span>1</span>
                <small>calls remaining</small>
              </div>
              <Button className="meeting-call-button" variant="secondary">
                <Icon name="meeting" size={18} /> Call meeting
              </Button>
            </section>
          </aside>
        </div>
        <nav className="mobile-game-actions" aria-label="Game actions">
          <button type="button">
            <Icon name="tasks" size={20} />
            <span>Status</span>
            <small>42%</small>
          </button>
          <button type="button">
            <Icon name="evidence" size={20} />
            <span>Evidence</span>
            <small>2</small>
          </button>
          <button type="button" className="meeting-ready">
            <Icon name="meeting" size={20} />
            <span>Meeting</span>
            <small>1</small>
          </button>
        </nav>
      </GameShell>
    </main>
  );
}

function SelectFixture() {
  const [value, setValue] = useState("");
  return (
    <main id="main-content" className="game-page game-dashboard-fixture">
      <GameShell phase="lobby" identity="Host player" avatarId="fox">
        <div className="game-content" style={{ paddingTop: 32 }}>
          <section className="settings-section">
            <GameSelect
              label="Map"
              value={value}
              placeholder="Choose a published map"
              onChange={setValue}
              options={[
                { value: "avengers", label: "Avengers · 9 tasks" },
                { value: "campus", label: "Campus Chaos · 10 tasks" },
                { value: "downtown", label: "Downtown Dash · 12 tasks" },
                { value: "office", label: "Office Outbreak · 10 tasks" },
              ]}
            />
          </section>
        </div>
      </GameShell>
    </main>
  );
}

function AvatarFixture() {
  const [avatarId, setAvatarId] = useState<AvatarId | null>("fox");
  return (
    <main id="main-content" className="game-page game-dashboard-fixture">
      <GameShell phase="lobby" identity="Host player" avatarId={avatarId ?? "fox"}>
        <div className="game-content" style={{ paddingTop: 32 }}>
          <AvatarPicker availableIds={AVATAR_IDS} value={avatarId} onChange={setAvatarId} />
        </div>
      </GameShell>
    </main>
  );
}
