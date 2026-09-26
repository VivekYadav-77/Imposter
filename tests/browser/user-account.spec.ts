import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 120_000 });

type Theme = "light" | "dark";

const fixedTime = "2026-01-15T12:30:00.000Z";
const games = [
  {
    id: "game-1",
    roomId: "room-1",
    code: "Q7KM2",
    taskPackName: "Museum Heist",
    winner: "crew",
    endReason: null,
    phase: "game_over",
    role: "crew",
    lifeStatus: "alive",
    playerCount: 8,
    won: true,
    startedAt: fixedTime,
    endedAt: fixedTime,
  },
  {
    id: "game-2",
    roomId: "room-2",
    code: "AX9P4",
    taskPackName: "Office Night",
    winner: "imposters",
    endReason: null,
    phase: "game_over",
    role: "crew",
    lifeStatus: "ejected",
    playerCount: 7,
    won: false,
    startedAt: "2026-01-14T11:00:00.000Z",
    endedAt: "2026-01-14T12:00:00.000Z",
  },
] as const;

const profile = {
  id: "user-1",
  email: "nova@example.com",
  displayName: "Nova",
  avatarId: "fox",
  createdAt: fixedTime,
};

const sessions = [
  {
    id: "session-current",
    deviceLabel: "Chrome on Windows",
    issuedAt: fixedTime,
    lastUsedAt: fixedTime,
    expiresAt: "2026-02-15T12:30:00.000Z",
    current: true,
  },
  {
    id: "session-phone",
    deviceLabel: "Safari on iPhone",
    issuedAt: fixedTime,
    lastUsedAt: fixedTime,
    expiresAt: "2026-02-15T12:30:00.000Z",
    current: false,
  },
];

const dashboard = {
  rooms: [
    {
      participantId: "participant-1",
      nickname: "Nova",
      avatarId: "fox",
      roomId: "room-1",
      code: "Q7KM2",
      status: "lobby",
      isHost: true,
      expiresAt: fixedTime,
      rejoinable: true,
    },
    {
      participantId: "participant-2",
      nickname: "Nova",
      avatarId: "owl",
      roomId: "room-2",
      code: "AX9P4",
      status: "completed",
      isHost: false,
      expiresAt: fixedTime,
      rejoinable: false,
    },
  ],
  recentGames: games,
  stats: {
    games: 12,
    wins: 7,
    crewGames: 9,
    imposterGames: 3,
    tasksCompleted: 42,
    tasksTotal: 51,
    survived: 8,
    hosted: 4,
    winRate: 58,
    taskCompletionRate: 82,
    survivalRate: 67,
  },
};

const gameDetail = {
  ...games[0],
  voteVisibility: "public",
  players: [
    {
      id: "p1",
      nickname: "Nova",
      avatarId: "fox",
      role: "crew",
      lifeStatus: "alive",
      totalTasks: 5,
      completedTasks: 5,
    },
    {
      id: "p2",
      nickname: "Orion",
      avatarId: "owl",
      role: "crew",
      lifeStatus: "alive",
      totalTasks: 5,
      completedTasks: 4,
    },
    {
      id: "p3",
      nickname: "Mira",
      avatarId: "wolf",
      role: "imposter",
      lifeStatus: "alive",
      totalTasks: 5,
      completedTasks: 0,
    },
    {
      id: "p4",
      nickname: "Jules",
      avatarId: "raven",
      role: "crew",
      lifeStatus: "killed",
      totalTasks: 5,
      completedTasks: 3,
    },
  ],
  ballots: [{ meeting: 1, voter: "Nova", target: "Mira" }],
  eliminations: [{ type: "killed", target: "Jules", actor: "Mira", occurredAt: fixedTime }],
};

async function setTheme(page: Page, theme: Theme) {
  await page.addInitScript((value) => localStorage.setItem("imposter-game-theme", value), theme);
}

async function mockAccountApi(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;
    let data: unknown;

    if (pathname === "/api/v1/me/dashboard") data = dashboard;
    else if (pathname === "/api/v1/me/games/game-1") data = gameDetail;
    else if (pathname === "/api/v1/me/games") data = { items: games, nextCursor: null };
    else if (pathname === "/api/v1/me/sessions") data = sessions;
    else if (pathname === "/api/v1/me") data = profile;
    else if (pathname.includes("/rejoin")) data = { room: {}, sessionExpiresAt: fixedTime };
    else return route.fallback();

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data }),
    });
  });
}

test("Google is the only player sign-in method", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  const google = page.getByRole("link", { name: "Continue with Google" });
  await expect(google).toHaveAttribute("href", "/api/v1/auth/google/start?intent=login");
  await expect(page.getByLabel("Password")).toHaveCount(0);
  await page.goto("/register");
  await expect(page).toHaveURL(/\/login$/);
});

test("play choice stays contained and usable on the narrowest supported phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.route("**/api/v1/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "USER_SESSION_INVALID", message: "Sign in." } }),
    });
  });
  await page.goto("/play?entry=1");

  const dialog = page.getByRole("dialog", { name: "Choose how to play" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(8);
  expect(box!.y).toBeGreaterThanOrEqual(8);
  expect(box!.x + box!.width).toBeLessThanOrEqual(312);
  expect(box!.y + box!.height).toBeLessThanOrEqual(712);

  const options = await dialog.locator(".play-choice-actions .button").evaluateAll((buttons) =>
    buttons.map((button) => {
      const bounds = button.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height };
    }),
  );
  expect(options).toHaveLength(2);
  expect(options.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).include(".dialog").analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    ),
  ).toEqual([]);
  await dialog.getByRole("button", { name: "Play as a guest" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Create room" })).toBeVisible();
});

test("play choice remains within phone, tablet, laptop, and desktop viewports", async ({
  page,
}) => {
  await page.route("**/api/v1/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "USER_SESSION_INVALID", message: "Sign in." } }),
    }),
  );
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/play?entry=1");
    const dialog = page.getByRole("dialog", { name: "Choose how to play" });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    const overflow = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
    await page.mouse.click(1, 1);
    await expect(dialog).toBeHidden();
  }
});

test("desktop dashboard uses the available content canvas", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await mockAccountApi(page);
  await page.goto("/dashboard");

  const widths = await page.locator(".dashboard-page").evaluate((dashboard) => {
    const main = dashboard.querySelector<HTMLElement>(".dashboard-main");
    const sidebar = dashboard.querySelector<HTMLElement>(".dashboard-sidebar");
    return {
      main: main?.getBoundingClientRect().width ?? 0,
      available:
        dashboard.getBoundingClientRect().width - (sidebar?.getBoundingClientRect().width ?? 0),
    };
  });
  expect(widths.main).toBeGreaterThanOrEqual(widths.available * 0.9);
});

test("signed-in players enter through the dashboard and can start there", async ({ page }) => {
  await mockAccountApi(page);
  await page.route("**/api/v1/rooms/current", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "SESSION_INVALID", message: "No active room." } }),
    });
  });
  await page.goto("/play?entry=1");
  await expect(page.getByRole("dialog", { name: "Choose how to play" })).toBeHidden();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("link", { name: /Start or join/ })).toHaveAttribute("href", "/play");
});

test("signed-out dashboard hides account navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/v1/me/dashboard", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "USER_SESSION_INVALID", message: "Sign in." } }),
    }),
  );
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
  await expect(page.locator(".dashboard-bottom-nav")).toHaveCount(0);
  await expect(page.locator(".dashboard-sidebar")).toHaveCount(0);
});

test("completed guests can save the game with Google or keep playing as a guest", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const room = {
    id: "room-1",
    code: "Q7KM2",
    status: "completed",
    participants: [],
    self: {
      participantId: "participant-1",
      nickname: "Nova",
      avatarId: "fox",
      isHost: true,
      capabilities: [],
    },
    gameId: "game-1",
  };
  const game = {
    id: "game-1",
    roomId: "room-1",
    phase: "game_over",
    stateVersion: 9,
    winner: "crew",
    endReason: "tasks_completed",
    participants: [
      {
        id: "participant-1",
        nickname: "Nova",
        avatarId: "fox",
        isHost: true,
        lifeStatus: "alive",
      },
    ],
    self: {
      participantId: "participant-1",
      avatarId: "fox",
      role: "crew",
      lifeStatus: "alive",
      capabilities: [],
      killableParticipantIds: [],
      knownEliminatedParticipantIds: [],
      crewRole: null,
    },
    assignments: [],
    progress: { percent: 100 },
    meetingRules: {
      durationSeconds: 60,
      votingMode: "timed",
      voteVisibility: "private",
      requiresCompletedTask: false,
      maxPerPlayer: 1,
      calledBySelf: 0,
      remainingForSelf: 1,
      hasCompletedTask: true,
    },
    meeting: null,
    resultSummary: {
      durationSeconds: 420,
      completedTasks: 3,
      totalTasks: 3,
      players: [
        {
          id: "participant-1",
          nickname: "Nova",
          avatarId: "fox",
          role: "crew",
          crewRole: null,
          lifeStatus: "alive",
          completedTasks: 3,
          totalTasks: 3,
        },
      ],
    },
  };
  await page.route("**/api/v1/rooms/current", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: room }) }),
  );
  await page.route("**/api/v1/games/current/snapshot", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: game }) }),
  );
  await page.route("**/api/v1/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "USER_SESSION_INVALID", message: "Sign in." } }),
    }),
  );

  await page.goto("/room");
  const dialog = page.getByRole("dialog", { name: "Keep this case in your history?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Continue with Google" })).toHaveAttribute(
    "href",
    "/api/v1/auth/google/start?intent=post_game",
  );
  await dialog.getByRole("button", { name: "Keep playing as guest" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("region", { name: "Save this result" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Save this result" }).getByRole("link", {
      name: "Continue with Google",
    }),
  ).toHaveAttribute("href", "/api/v1/auth/google/start?intent=post_game");
  await page.reload();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Crew wins" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Save this result" })).toBeVisible();
});

test("mobile dashboard navigation is active, reachable, and does not cover the page end", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAccountApi(page);
  await page.goto("/dashboard");
  const navigation = page.locator(".dashboard-bottom-nav");
  await expect(navigation.getByRole("link", { name: "Overview" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const touchTargets = await navigation.locator("a").evaluateAll((links) =>
    links.map((link) => {
      const box = link.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }),
  );
  expect(touchTargets).toHaveLength(3);
  expect(touchTargets.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);
  const pageHeight = await page.locator("html").evaluate((element) => element.scrollHeight);
  expect(pageHeight).toBeLessThanOrEqual(844 * 2);
  await page.keyboard.press("End");
  const lastSection = page.locator(".dashboard-section").last();
  await expect(lastSection).toBeInViewport();
});

test("additional rooms are progressively disclosed", async ({ page }) => {
  await mockAccountApi(page);
  await page.goto("/dashboard");
  await expect(page.locator(".room-history-card", { hasText: "Room AX9P4" })).toBeHidden();
  const disclosure = page.locator(".dashboard-disclosure");
  await expect(disclosure).toHaveAccessibleName("Show 1 other room");
  await disclosure.click();
  await expect(page.locator(".room-history-card", { hasText: "Room AX9P4" })).toBeVisible();
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
});

test("settings tabs support arrow keys and destructive confirmation", async ({ page }) => {
  await mockAccountApi(page);
  await page.goto("/dashboard/settings");
  const profileTab = page.getByRole("tab", { name: "Profile" });
  await profileTab.focus();
  await profileTab.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Devices" })).toHaveAttribute("aria-selected", "true");
  await page.goto("/dashboard/settings?reauthenticated=1");
  const dialog = page.getByRole("dialog", { name: "Delete your account?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
});

const geometryViewports = [
  { name: "phone-320", width: 320, height: 720 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop", width: 1920, height: 1080 },
];

for (const viewport of geometryViewports) {
  test(`account routes have stable geometry at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await mockAccountApi(page);
    for (const route of [
      "/login",
      "/register",
      "/dashboard",
      "/dashboard/history",
      "/dashboard/history/game-1",
      "/dashboard/settings",
    ]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const geometry = await page.locator("html").evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(geometry.scrollWidth, `${route} overflows at ${viewport.name}`).toBeLessThanOrEqual(
        geometry.clientWidth + 1,
      );
    }
  });
}

for (const theme of ["light", "dark"] as const) {
  for (const viewport of [
    { name: "phone", width: 390, height: 844 },
    { name: "laptop", width: 1366, height: 768 },
    { name: "desktop", width: 1920, height: 1080 },
  ]) {
    test(`account visual regression ${theme} ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setTheme(page, theme);
      await mockAccountApi(page);
      for (const visual of [
        { name: "login", path: "/login" },
        { name: "overview", path: "/dashboard" },
        { name: "history", path: "/dashboard/history" },
        { name: "result", path: "/dashboard/history/game-1" },
        { name: "settings", path: "/dashboard/settings" },
      ]) {
        await page.goto(visual.path);
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveScreenshot(`${visual.name}-${theme}-${viewport.name}.png`, {
          animations: "disabled",
          fullPage: true,
          maxDiffPixelRatio: 0.015,
        });
      }
    });
  }

  test(`account surfaces have no serious accessibility violations in ${theme} theme`, async ({
    page,
  }) => {
    await setTheme(page, theme);
    await mockAccountApi(page);
    for (const route of ["/login", "/register", "/dashboard", "/dashboard/settings"]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations.filter(
          (violation) => violation.impact === "critical" || violation.impact === "serious",
        ),
        `${route} has serious accessibility violations in ${theme} theme`,
      ).toEqual([]);
    }
  });
}
