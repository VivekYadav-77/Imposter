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

test("registration keeps the primary action close and uses an accessible avatar dialog", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/register");

  const submit = page.getByRole("button", { name: "Create account" });
  const submitBox = await submit.boundingBox();
  expect(submitBox).not.toBeNull();
  expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(844);

  await page.getByRole("button", { name: /Fox Selected operative/ }).click();
  const dialog = page.getByRole("dialog", { name: "Choose your operative" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("radio")).toHaveCount(18);
  await dialog.getByRole("radio", { name: /Owl/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: /Owl Selected operative/ })).toBeVisible();

  await page.getByRole("textbox", { name: "Password" }).fill("a secure password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByRole("textbox", { name: "Password" })).toHaveAttribute("type", "text");
});

test("auth forms prevent duplicate submission and preserve their API payloads", async ({
  page,
}) => {
  let requests = 0;
  let body: unknown;
  await page.route("**/api/v1/accounts", async (route) => {
    requests += 1;
    body = route.request().postDataJSON();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: {} }),
    });
  });
  await mockAccountApi(page);
  await page.goto("/register");
  await page.getByLabel("Display name").fill("Nova");
  await page.getByLabel("Email").fill("nova@example.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a secure password");
  await page.getByRole("button", { name: "Create account" }).dblclick();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(requests).toBe(1);
  expect(body).toEqual({
    email: "nova@example.com",
    password: "a secure password",
    displayName: "Nova",
    avatarId: "fox",
  });
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
  await expect(page.getByRole("tab", { name: "Security" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: "Account" }).click();
  await page.getByRole("textbox", { name: "Confirm password" }).fill("a secure password");
  await page.getByRole("button", { name: "Delete account" }).click();
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
        { name: "register", path: "/register" },
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
