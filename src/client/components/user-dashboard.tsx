"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AvatarId } from "../../shared/avatars";
import type {
  DashboardData,
  UserGameDetail,
  UserGameSummary,
  UserProfile,
  UserSession,
} from "../api/types";
import { ApiError, errorMessage, userApi } from "../api/client";
import { Brand, Button, ConfirmDialog, Field, Icon, type IconName, SkeletonList } from "./ui";
import { PlayerAvatar } from "./player-avatar";
import { ThemeToggle } from "./theme-toggle";
import { AvatarChooser } from "./user-auth-form";

const navigation: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/dashboard", label: "Overview", icon: "spark" },
  { href: "/dashboard/history", label: "History", icon: "evidence" },
  { href: "/dashboard/settings", label: "Settings", icon: "tool" },
];

function isCurrentPath(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

function DashboardNav({ className }: { className: string }) {
  const pathname = usePathname();
  return (
    <nav className={className} aria-label="Player dashboard">
      {navigation.map((item) => {
        const current = isCurrentPath(pathname, item.href);
        return (
          <Link href={item.href} key={item.href} aria-current={current ? "page" : undefined}>
            <Icon name={item.icon} size={20} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard-page">
      <aside className="dashboard-sidebar">
        <Link href="/" className="dashboard-brand" aria-label="Imposter Game home">
          <Brand />
        </Link>
        <DashboardNav className="dashboard-sidebar-nav" />
        <div className="dashboard-sidebar-footer">
          <span>Appearance</span>
          <ThemeToggle placement="compact" />
        </div>
      </aside>
      <header className="dashboard-mobile-header">
        <Link href="/" className="dashboard-brand" aria-label="Imposter Game home">
          <Brand compact />
        </Link>
        <ThemeToggle placement="compact" />
      </header>
      <main id="main-content" className="dashboard-main">
        {children}
      </main>
      <DashboardNav className="dashboard-bottom-nav" />
    </div>
  );
}

function SignedOutFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard-page dashboard-page-signed-out">
      <header className="dashboard-mobile-header">
        <Link href="/" className="dashboard-brand" aria-label="Imposter Game home">
          <Brand compact />
        </Link>
        <ThemeToggle placement="compact" />
      </header>
      <main id="main-content" className="dashboard-main">
        {children}
      </main>
    </div>
  );
}

function Loading({ label = "Loading your case files" }: { label?: string }) {
  return (
    <Frame>
      <div className="dashboard-loading" aria-label={label} aria-busy="true">
        <div className="dashboard-heading-skeleton" />
        <SkeletonList count={4} />
      </div>
    </Frame>
  );
}

function Failure({ error }: { error: unknown }) {
  const signedOut = error instanceof ApiError && error.status === 401;
  if (signedOut)
    return (
      <SignedOutFrame>
        <section className="dashboard-empty" role="alert">
          <span className="empty-seal" aria-hidden="true">
            <Icon name="lock" size={28} />
          </span>
          <h1>Sign in to continue</h1>
          <p>Your player session has ended.</p>
          <Link className="button button-primary" href="/login">
            Sign in
          </Link>
        </section>
      </SignedOutFrame>
    );
  return (
    <Frame>
      <section className="dashboard-empty" role="alert">
        <span className="empty-seal" aria-hidden="true">
          <Icon name="warning" size={28} />
        </span>
        <h1>Couldn’t open the dashboard</h1>
        <p>{errorMessage(error)}</p>
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </section>
    </Frame>
  );
}

const date = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );

function DashboardHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="dashboard-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="dashboard-heading-action">{action}</div>}
    </header>
  );
}

type DashboardRoom = DashboardData["rooms"][number];

function RoomCard({
  room,
  primary = false,
  busy,
  onRejoin,
}: {
  room: DashboardRoom;
  primary?: boolean;
  busy: boolean;
  onRejoin: () => void;
}) {
  return (
    <article className={`room-history-card${primary ? " primary" : ""}`}>
      <PlayerAvatar id={room.avatarId} size={primary ? 52 : 42} />
      <div>
        <strong>Room {room.code}</strong>
        <span>
          {room.nickname} · {room.isHost ? "Host" : "Player"} · {room.status}
        </span>
      </div>
      {room.rejoinable ? (
        <Button loading={busy} onClick={onRejoin}>
          {room.status === "completed" || room.status === "abandoned" ? "Rematch" : "Rejoin"}
        </Button>
      ) : (
        <span className="room-history-state">History only</span>
      )}
    </article>
  );
}

export function DashboardOverview() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData>();
  const [error, setError] = useState<unknown>();
  const [roomsExpanded, setRoomsExpanded] = useState(false);
  const [rejoining, setRejoining] = useState<string>();

  useEffect(() => {
    userApi
      .dashboard()
      .then((response) => setData(response.data))
      .catch(setError);
  }, []);
  if (error) return <Failure error={error} />;
  if (!data) return <Loading />;

  const rooms = [...data.rooms].sort(
    (left, right) => Number(right.rejoinable) - Number(left.rejoinable),
  );
  const primaryRoom = rooms[0];
  const additionalRooms = rooms.slice(1);
  const stats = [
    { label: "Games", value: data.stats.games, icon: "trophy" as const },
    { label: "Win rate", value: `${data.stats.winRate}%`, icon: "verdict" as const },
    {
      label: "Tasks complete",
      value: `${data.stats.taskCompletionRate}%`,
      detail: `${data.stats.tasksCompleted}/${data.stats.tasksTotal}`,
      icon: "tasks" as const,
    },
    { label: "Survival", value: `${data.stats.survivalRate}%`, icon: "players" as const },
  ];

  async function rejoin(room: DashboardRoom) {
    setError(undefined);
    setRejoining(room.participantId);
    try {
      await userApi.rejoin(room.participantId);
      router.push("/room");
    } catch (value) {
      setError(value);
      setRejoining(undefined);
    }
  }

  return (
    <Frame>
      <DashboardHeading
        eyebrow="Your command center"
        title="Welcome back."
        description="Resume a live room or review your latest cases."
        action={
          <Link className="button button-primary" href="/play">
            Start or join <Icon name="arrow" size={18} aria-hidden="true" />
          </Link>
        }
      />
      <section className="stats-grid" aria-label="Player statistics">
        {stats.map((stat) => (
          <article key={stat.label}>
            <span className="stat-icon" aria-hidden="true">
              <Icon name={stat.icon} size={19} />
            </span>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
            {stat.detail && <small>{stat.detail} completed</small>}
          </article>
        ))}
      </section>
      <div className="dashboard-overview-grid">
        <section className="dashboard-section dashboard-rooms-section">
          <div className="section-title">
            <div>
              <p className="eyebrow">Rooms</p>
              <h2>Rejoin a room</h2>
            </div>
          </div>
          {primaryRoom ? (
            <div className="dashboard-list">
              <RoomCard
                room={primaryRoom}
                primary
                busy={rejoining === primaryRoom.participantId}
                onRejoin={() => void rejoin(primaryRoom)}
              />
              {roomsExpanded &&
                additionalRooms.map((room) => (
                  <RoomCard
                    room={room}
                    key={room.participantId}
                    busy={rejoining === room.participantId}
                    onRejoin={() => void rejoin(room)}
                  />
                ))}
              {additionalRooms.length > 0 && (
                <button
                  className="dashboard-disclosure"
                  type="button"
                  aria-expanded={roomsExpanded}
                  onClick={() => setRoomsExpanded((value) => !value)}
                >
                  {roomsExpanded
                    ? "Hide other rooms"
                    : `Show ${additionalRooms.length} other room${additionalRooms.length === 1 ? "" : "s"}`}
                  <Icon name="chevron" size={17} aria-hidden="true" />
                </button>
              )}
            </div>
          ) : (
            <div className="dashboard-empty-inline">
              <Icon name="room" size={24} aria-hidden="true" />
              <p>No linked rooms yet. Live and previously played rooms will appear here.</p>
            </div>
          )}
        </section>
        <section className="dashboard-section dashboard-results-section">
          <div className="section-title">
            <div>
              <p className="eyebrow">Recent results</p>
              <h2>Case history</h2>
            </div>
            <Link href="/dashboard/history">View all</Link>
          </div>
          <GameList games={data.recentGames.slice(0, 3)} />
        </section>
      </div>
    </Frame>
  );
}

function GameList({ games }: { games: UserGameSummary[] }) {
  return games.length ? (
    <div className="dashboard-list game-history-list">
      {games.map((game) => (
        <Link className="game-history-card" key={game.id} href={`/dashboard/history/${game.id}`}>
          <span
            className={`result-pill ${game.phase === "abandoned" ? "abandoned" : game.won ? "won" : "lost"}`}
          >
            {game.phase === "abandoned" ? "Abandoned" : game.won ? "Won" : "Lost"}
          </span>
          <div>
            <strong>{game.taskPackName}</strong>
            <span>
              Room {game.code} · {date(game.startedAt)}
            </span>
          </div>
          <span className="game-history-role">{game.role}</span>
          <Icon name="arrow" size={18} aria-hidden="true" />
        </Link>
      ))}
    </div>
  ) : (
    <div className="dashboard-empty-inline">
      <Icon name="evidence" size={24} aria-hidden="true" />
      <p>Completed games will appear here.</p>
    </div>
  );
}

export function DashboardHistory() {
  const [games, setGames] = useState<UserGameSummary[]>();
  const [cursor, setCursor] = useState<string | null>();
  const [error, setError] = useState<unknown>();
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (next?: string) => {
    if (next) setLoadingMore(true);
    setError(undefined);
    try {
      const response = await userApi.history(next);
      setGames((current) =>
        next ? [...(current ?? []), ...response.data.items] : response.data.items,
      );
      setCursor(response.data.nextCursor);
    } catch (value) {
      setError(value);
    } finally {
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  if (error && !games) return <Failure error={error} />;

  return (
    <Frame>
      <DashboardHeading
        eyebrow="Archive"
        title="Game history"
        description="Roles and results are saved here. Evidence photos are never included."
      />
      {Boolean(error) && (
        <div className="form-error" role="alert">
          <span>{errorMessage(error)}</span>
          <Button variant="ghost" onClick={() => void load(cursor ?? undefined)}>
            Try again
          </Button>
        </div>
      )}
      <section className="dashboard-section dashboard-history-section">
        {games ? <GameList games={games} /> : <SkeletonList count={5} />}
        {cursor && (
          <Button
            className="history-load-more"
            variant="secondary"
            loading={loadingMore}
            onClick={() => void load(cursor)}
          >
            Load older games
          </Button>
        )}
      </section>
    </Frame>
  );
}

export function DashboardGame({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<UserGameDetail>();
  const [error, setError] = useState<unknown>();
  useEffect(() => {
    userApi
      .game(gameId)
      .then((response) => setGame(response.data))
      .catch(setError);
  }, [gameId]);
  if (error) return <Failure error={error} />;
  if (!game) return <Loading label="Loading game result" />;

  return (
    <Frame>
      <Link className="back-link dashboard-back-link" href="/dashboard/history">
        <Icon name="arrow" size={17} aria-hidden="true" /> Back to history
      </Link>
      <DashboardHeading
        eyebrow={`Room ${game.code}`}
        title={
          game.winner ? `${game.winner === "crew" ? "Crew" : "Imposters"} won` : "Game abandoned"
        }
        description={
          <>
            {game.taskPackName} · You played <strong>{game.role}</strong> · {date(game.startedAt)}
          </>
        }
        action={
          <span
            className={`result-pill ${game.winner === game.role || (game.winner === "imposters" && game.role === "imposter") ? "won" : "lost"}`}
          >
            {game.lifeStatus}
          </span>
        }
      />
      <section className="dashboard-section result-roster-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">Players</p>
            <h2>Final roster</h2>
          </div>
          <span className="muted">{game.players.length} players</span>
        </div>
        <div className="result-roster">
          {game.players.map((player) => (
            <article className="result-player" key={player.id}>
              <PlayerAvatar id={player.avatarId} size={46} />
              <div>
                <strong>{player.nickname}</strong>
                <span>
                  {player.role} · {player.lifeStatus}
                </span>
              </div>
              <strong className="result-task-count">
                {player.completedTasks}/{player.totalTasks} <small>tasks</small>
              </strong>
            </article>
          ))}
        </div>
      </section>
      <div className="result-detail-grid">
        <section className="dashboard-section">
          <div className="section-title">
            <h2>Eliminations</h2>
          </div>
          {game.eliminations.length ? (
            <div className="dashboard-list">
              {game.eliminations.map((item, index) => (
                <div className="session-card" key={`${item.occurredAt}-${index}`}>
                  <span className="event-icon" aria-hidden="true">
                    <Icon name="warning" size={18} />
                  </span>
                  <div>
                    <strong>{item.target}</strong>
                    <span>
                      {item.type === "ejected"
                        ? "Ejected by vote"
                        : `Killed${item.actor ? ` by ${item.actor}` : ""}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="privacy-note">No eliminations were recorded.</p>
          )}
        </section>
        <section className="dashboard-section">
          <div className="section-title">
            <h2>Vote record</h2>
          </div>
          {game.voteVisibility === "public" ? (
            game.ballots.length ? (
              <div className="dashboard-list">
                {game.ballots.map((vote, index) => (
                  <div className="session-card" key={`${vote.meeting}-${index}`}>
                    <span className="event-icon" aria-hidden="true">
                      <Icon name="verdict" size={18} />
                    </span>
                    <div>
                      <strong>Meeting {vote.meeting}</strong>
                      <span>
                        {vote.voter} voted for {vote.target ?? "Skip"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="privacy-note">No ballots were cast.</p>
            )
          ) : (
            <p className="privacy-note">
              Individual ballots were private and are not present in history.
            </p>
          )}
        </section>
      </div>
    </Frame>
  );
}

type SettingsTab = "profile" | "devices" | "account";
const settingsTabs: Array<{ id: SettingsTab; label: string; icon: IconName }> = [
  { id: "profile", label: "Profile", icon: "players" },
  { id: "devices", label: "Devices", icon: "room" },
  { id: "account", label: "Account", icon: "trash" },
];

function SettingsTabs({
  value,
  onChange,
}: {
  value: SettingsTab;
  onChange: (tab: SettingsTab) => void;
}) {
  return (
    <div
      className="settings-tabs"
      role="tablist"
      aria-label="Account settings"
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const current = settingsTabs.findIndex((tab) => tab.id === value);
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? settingsTabs.length - 1
              : (current + (event.key === "ArrowRight" ? 1 : -1) + settingsTabs.length) %
                settingsTabs.length;
        onChange(settingsTabs[next].id);
        event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='tab']")[next]?.focus();
      }}
    >
      {settingsTabs.map((tab) => (
        <button
          key={tab.id}
          id={`settings-tab-${tab.id}`}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          aria-controls={`settings-panel-${tab.id}`}
          tabIndex={value === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
        >
          <Icon name={tab.icon} size={18} aria-hidden="true" />
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

export function DashboardSettings() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loadError, setLoadError] = useState<unknown>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<AvatarId>("fox");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [busy, setBusy] = useState<string>();

  useEffect(() => {
    Promise.all([userApi.me(), userApi.sessions()])
      .then(([profileResponse, sessionsResponse]) => {
        setProfile(profileResponse.data);
        setName(profileResponse.data.displayName);
        setAvatar(profileResponse.data.avatarId);
        setSessions(sessionsResponse.data);
      })
      .catch(setLoadError);
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("reauthenticated") !== "1") return;
    setActiveTab("account");
    setDeleteOpen(true);
    window.history.replaceState(window.history.state, "", "/dashboard/settings");
  }, []);

  const currentSession = useMemo(() => sessions.find((session) => session.current), [sessions]);
  if (!profile && !loadError) return <Loading label="Loading account settings" />;
  if (!profile) return <Failure error={loadError} />;

  function startAction(id: string) {
    setBusy(id);
    setMessage("");
    setError("");
  }

  function failAction(value: unknown) {
    setError(errorMessage(value));
    setBusy(undefined);
  }

  const panelProps = (tab: SettingsTab) => ({
    id: `settings-panel-${tab}`,
    role: "tabpanel" as const,
    "aria-labelledby": `settings-tab-${tab}`,
    hidden: activeTab !== tab,
  });

  return (
    <Frame>
      <DashboardHeading
        eyebrow="Account"
        title="Settings"
        description={
          <>
            Signed in as <strong>{profile.email}</strong>
          </>
        }
      />
      <div className="settings-shell">
        <SettingsTabs value={activeTab} onChange={setActiveTab} />
        <div className="settings-feedback" aria-live="polite">
          {message && <p className="success-note">{message}</p>}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <section {...panelProps("profile")} className="settings-panel account-card">
          <div className="settings-panel-heading">
            <div>
              <p className="eyebrow">Identity</p>
              <h2>Player profile</h2>
            </div>
            <PlayerAvatar id={avatar} size={54} />
          </div>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              startAction("profile");
              try {
                const response = await userApi.updateProfile({
                  displayName: name,
                  avatarId: avatar,
                });
                setProfile(response.data);
                setMessage("Profile updated.");
                setBusy(undefined);
              } catch (value) {
                failAction(value);
              }
            }}
          >
            <Field
              label="Display name"
              value={name}
              maxLength={24}
              required
              disabled={busy === "profile"}
              onChange={(event) => setName(event.target.value)}
            />
            <AvatarChooser value={avatar} onChange={setAvatar} compact />
            <Button type="submit" loading={busy === "profile"}>
              Save profile
            </Button>
          </form>
        </section>

        <section {...panelProps("devices")} className="settings-panel account-card">
          <div className="settings-panel-heading">
            <div>
              <p className="eyebrow">Sessions</p>
              <h2>Signed-in devices</h2>
            </div>
            <Button
              variant="secondary"
              loading={busy === "others"}
              disabled={sessions.every((session) => session.current)}
              onClick={async () => {
                startAction("others");
                try {
                  await userApi.revokeOthers();
                  setSessions((all) => all.filter((session) => session.current));
                  setMessage("Other devices signed out.");
                  setBusy(undefined);
                } catch (value) {
                  failAction(value);
                }
              }}
            >
              Sign out others
            </Button>
          </div>
          <div className="dashboard-list session-list">
            {sessions.map((session) => (
              <article className="session-card" key={session.id}>
                <span
                  className="session-status"
                  data-current={session.current}
                  aria-hidden="true"
                />
                <div>
                  <strong>{session.current ? "This device" : session.deviceLabel}</strong>
                  <span>
                    Last used {session.lastUsedAt ? date(session.lastUsedAt) : "recently"}
                  </span>
                </div>
                {!session.current && (
                  <Button
                    variant="ghost"
                    loading={busy === session.id}
                    onClick={async () => {
                      startAction(session.id);
                      try {
                        await userApi.revokeSession(session.id);
                        setSessions((all) => all.filter((item) => item.id !== session.id));
                        setMessage(`${session.deviceLabel} signed out.`);
                        setBusy(undefined);
                      } catch (value) {
                        failAction(value);
                      }
                    }}
                  >
                    Revoke
                  </Button>
                )}
              </article>
            ))}
          </div>
          {currentSession && (
            <p className="privacy-note">
              Current session expires {date(currentSession.expiresAt)}.
            </p>
          )}
        </section>

        <section {...panelProps("account")} className="settings-panel account-card danger-zone">
          <div className="settings-panel-heading">
            <div>
              <p className="eyebrow">Account</p>
              <h2>Sign out or delete</h2>
            </div>
            <span className="settings-panel-icon danger">
              <Icon name="trash" size={24} />
            </span>
          </div>
          <div className="account-action-row">
            <div>
              <strong>Sign out</strong>
              <p>End the player session on this device.</p>
            </div>
            <Button
              variant="secondary"
              loading={busy === "logout"}
              onClick={async () => {
                startAction("logout");
                try {
                  await userApi.logout();
                  router.push("/");
                  router.refresh();
                } catch (value) {
                  failAction(value);
                }
              }}
            >
              Sign out
            </Button>
          </div>
          <div className="delete-account-form">
            <div>
              <strong>Delete account</strong>
              <p>
                This removes your login and unlinks your history. Shared anonymized game records
                remain. Google will ask you to confirm your identity first.
              </p>
            </div>
            <a className="button button-danger" href="/api/v1/auth/google/start?intent=delete">
              Verify with Google to delete
            </a>
          </div>
        </section>
      </div>
      <ConfirmDialog
        open={deleteOpen}
        title="Delete your account?"
        description="This cannot be undone. Your login will be removed and your game history will be unlinked."
        confirmLabel="Delete account"
        dangerous
        loading={busy === "delete"}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          startAction("delete");
          try {
            await userApi.deleteAccount();
            router.push("/");
            router.refresh();
          } catch (value) {
            setDeleteOpen(false);
            failAction(value);
          }
        }}
      />
    </Frame>
  );
}
