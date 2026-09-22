import { expect, test, type Page, type Route } from "@playwright/test";

const pack = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "signal-station",
  name: "Signal Station",
  description: "A compact map for quick games.",
  status: "draft",
  revision: 3,
  publishedAt: null,
  createdAt: "2026-09-20T10:00:00.000Z",
  updatedAt: "2026-09-22T10:00:00.000Z",
  itemCount: 3,
  activeItemCount: 3,
  roles: [],
};

const packDetail = {
  ...pack,
  items: [
    {
      id: "21111111-1111-4111-8111-111111111111",
      description: "Photograph the signal console",
      difficulty: "medium",
      isActive: true,
      position: 0,
    },
    {
      id: "31111111-1111-4111-8111-111111111111",
      description: "Find the emergency beacon",
      difficulty: "easy",
      isActive: true,
      position: 1,
    },
    {
      id: "41111111-1111-4111-8111-111111111111",
      description: "Recreate the crew warning pose",
      difficulty: "hard",
      isActive: true,
      position: 2,
    },
  ],
};

function envelope(data: unknown) {
  return {
    data,
    meta: { requestId: "browser-test", serverTime: "2026-09-22T10:00:00.000Z" },
  };
}

async function json(route: Route, data: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
}

async function mockAdminList(page: Page) {
  await page.route("**/api/v1/admin/task-packs?**", (route) => json(route, envelope([pack])));
}

test("admin login keeps dashboard navigation private and reveals the password accessibly", async ({
  page,
}) => {
  await page.goto("/admin/login");

  await expect(page.getByRole("heading", { name: "Map administration" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "New map" })).toHaveCount(0);
  await expect(page.locator(".admin-login-art svg")).toBeVisible();

  const password = page.getByLabel("Password", { exact: true });
  await password.fill("test-password");
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(page.getByRole("button", { name: "Hide password" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  for (const viewport of [
    { width: 320, height: 720 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    const geometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  }
});

test("admin dashboard is responsive and themed across primary viewports", async ({ page }) => {
  await mockAdminList(page);
  for (const theme of ["light", "dark"] as const) {
    await page.addInitScript((value) => localStorage.setItem("imposter-game-theme", value), theme);
    for (const viewport of [
      { width: 320, height: 720 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/admin/task-packs");
      await expect(page.getByRole("heading", { name: "Game maps" })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const geometry = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    }
  }
});

test("mobile admin navigation aligns its controls and dismisses predictably", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAdminList(page);
  await page.goto("/admin/task-packs");

  const menu = page.getByRole("button", { name: "Menu" });
  const navigation = page.getByRole("navigation", { name: "Admin navigation" });
  const themeToggle = page.getByRole("button", { name: /Switch to .* theme/ });
  const brand = page.getByRole("link", { name: "Imposter Game home" });

  const controls = await Promise.all([menu.boundingBox(), themeToggle.boundingBox()]);
  expect(controls[0]?.height).toBe(controls[1]?.height);
  expect(controls[0]?.y).toBe(controls[1]?.y);
  await expect(brand).toHaveCSS("color", "rgb(255, 250, 240)");

  await menu.click();
  await expect(navigation).toBeVisible();
  await page.mouse.click(380, 820);
  await expect(navigation).toBeHidden();

  await menu.click();
  await page.keyboard.press("Escape");
  await expect(navigation).toBeHidden();

  await menu.click();
  await navigation.getByRole("link", { name: "Dashboard" }).click();
  await expect(navigation).toBeHidden();
});

test("newer search results cannot be replaced by a stale list response", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/v1/admin/task-packs?**", async (route) => {
    requests += 1;
    const searched = new URL(route.request().url()).searchParams.has("search");
    if (!searched) await new Promise((resolve) => setTimeout(resolve, 700));
    await json(
      route,
      envelope([
        {
          ...pack,
          id: searched ? "51111111-1111-4111-8111-111111111111" : pack.id,
          name: searched ? "Search Match" : "Stale Result",
        },
      ]),
    );
  });
  await page.goto("/admin/task-packs");
  await expect.poll(() => requests).toBe(1);
  await page.getByLabel("Search").fill("match");
  await expect(page.getByText("Search Match")).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.getByText("Stale Result")).toHaveCount(0);
  expect(requests).toBeGreaterThanOrEqual(2);
});

test("mobile editor uses task cards, protects dirty navigation, and supports undo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(`**/api/v1/admin/task-packs/${pack.id}`, (route) =>
    json(route, envelope(packDetail)),
  );
  await page.goto(`/admin/task-packs/${pack.id}`);
  await expect(page.getByRole("heading", { name: "Signal Station" })).toBeVisible();

  const taskRow = page.locator(".task-entry-table tbody tr").first();
  await expect(taskRow).toHaveCSS("display", "block");
  await taskRow.getByRole("button", { name: "Remove task 1" }).click();
  await expect(page.getByText("Task removed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("textbox", { name: "Task 1" })).toHaveValue(
    "Photograph the signal console",
  );

  await page.getByLabel("Map name").fill("Changed station");
  await page.getByRole("link", { name: "All maps" }).click();
  await expect(page.getByRole("heading", { name: "Discard unsaved changes?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(new RegExp(`${pack.id}$`));

  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
});

test("editor exposes validation instead of silently disabling save", async ({ page }) => {
  await page.goto("/admin/task-packs/new");
  await page.getByRole("textbox", { name: "Task 1" }).fill("A valid task without a map name");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Pack name is required.")).toBeVisible();
  await expect(page.getByLabel("Map name")).toBeFocused();
  await expect(page.getByText("Enter a map name.")).toBeVisible();
});
