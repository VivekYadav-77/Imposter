import { expect, test, type Page } from "@playwright/test";

type Theme = "light" | "dark";

const routes = ["/", "/play", "/how-to-play", "/privacy-and-photos", "/admin/login", "/room"];
const viewports = [
  { name: "phone-320", width: 320, height: 720 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

async function setTheme(page: Page, theme: Theme) {
  await page.addInitScript((value) => localStorage.setItem("imposter-game-theme", value), theme);
}

for (const viewport of viewports) {
  for (const theme of ["light", "dark"] as const) {
    test.describe(`${viewport.name} ${theme}`, () => {
      test.use({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: theme,
      });

      for (const route of routes) {
        test(`${route} has stable responsive geometry`, async ({ page }) => {
          const errors: string[] = [];
          page.on("console", (message) => {
            if (message.type() === "error" && !message.text().includes("Failed to load resource"))
              errors.push(message.text());
          });
          page.on("pageerror", (error) => errors.push(error.message));
          await setTheme(page, theme);
          await page.goto(route);
          await page.waitForLoadState("networkidle");

          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          const geometry = await page.evaluate(() => ({
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
          }));
          expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
          expect(errors).toEqual([]);
        });
      }
    });
  }
}

for (const theme of ["light", "dark"] as const) {
  test(`landing visual ${theme} phone`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setTheme(page, theme);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot(`landing-${theme}-phone.png`, {
      animations: "disabled",
      fullPage: true,
      maxDiffPixelRatio: 0.015,
    });
  });

  test(`landing visual ${theme} desktop`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setTheme(page, theme);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot(`landing-${theme}-desktop.png`, {
      animations: "disabled",
      fullPage: true,
      maxDiffPixelRatio: 0.015,
    });
  });
}

test("theme choice persists across public routes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /switch to light theme/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.goto("/play");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("room creation failures use a dismissible toast", async ({ page }) => {
  await page.route("**/api/v1/rooms/current", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "UNAUTHORIZED", message: "No active room session." },
      }),
    });
  });
  await page.route("**/api/v1/rooms", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "INTERNAL_ERROR", message: "Room creation is temporarily unavailable." },
      }),
    });
  });
  await page.goto("/play");
  await page.getByLabel("Your nickname").fill("Toast tester");
  await page.getByRole("radio", { name: /Fox avatar/ }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create room" }).click();

  const toast = page.getByLabel("Play notifications").getByRole("alert");
  await expect(toast).toContainText("Couldn’t continue");
  await expect(toast).toContainText("Room creation is temporarily unavailable.");
  await toast.getByRole("button", { name: "Dismiss notification" }).click();
  await expect(toast).toBeHidden();
});

test("mobile game confirmations are vertically centered", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/showcase?fixture=dialog");
  const dialog = page.locator("dialog");
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs(box!.y + box!.height / 2 - 844 / 2)).toBeLessThanOrEqual(2);
});

test("light game command bar keeps the player name visible", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setTheme(page, "light");
  await page.goto("/dev/showcase?fixture=tasks");
  const playerName = page.locator(".phase-identity > span:last-child");
  await expect(playerName).toBeVisible();
  await expect(playerName).toHaveCSS("color", "rgb(29, 33, 30)");
});

test("mobile game dropdown stays inside its field and viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/dev/showcase?fixture=select");
  await page.getByRole("combobox", { name: "Map Choose a published map" }).click();
  const trigger = await page.locator(".game-select-trigger").boundingBox();
  const menu = await page.locator(".game-select-menu").boundingBox();
  expect(trigger).not.toBeNull();
  expect(menu).not.toBeNull();
  expect(menu!.x).toBeGreaterThanOrEqual(0);
  expect(menu!.x + menu!.width).toBeLessThanOrEqual(320);
  expect(Math.abs(menu!.width - trigger!.width)).toBeLessThanOrEqual(1);
});

for (const theme of ["light", "dark"] as const) {
  for (const viewport of [
    { name: "phone", width: 320, height: 720 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 900 },
  ]) {
    test(`avatar catalog fits ${viewport.name} in ${theme}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await setTheme(page, theme);
      await page.goto("/dev/showcase?fixture=avatars");
      await expect(page.getByRole("radio")).toHaveCount(18);
      const geometry = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
      await expect(page.getByRole("radio", { name: /Fox avatar/ })).toHaveAttribute(
        "aria-checked",
        "true",
      );
    });
  }
}

test("avatar motion settles without moving its reserved box", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/dev/showcase?fixture=avatars");
  const choice = page.getByRole("radio", { name: /Owl avatar/ });
  const avatar = choice.locator(".player-avatar");
  const before = await avatar.boundingBox();
  await choice.click();
  await page.waitForTimeout(750);
  const after = await avatar.boundingBox();
  expect(after).toEqual(before);
});

test("reduced motion disables avatar keyframes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dev/showcase?fixture=avatars");
  const motion = page.locator(".avatar-fox .avatar-motion").first();
  await expect(motion).toHaveCSS("animation-name", "none");
});

test("game toast stays compact below the command bar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/showcase?fixture=toast");
  const toast = await page.locator(".game-toast-region .toast").boundingBox();
  expect(toast).not.toBeNull();
  expect(toast!.height).toBeLessThanOrEqual(120);
  expect(toast!.y).toBeGreaterThanOrEqual(70);
  expect(toast!.x + toast!.width).toBeLessThanOrEqual(390);
});

test("narrow task proof action stays aligned and elimination history remains visible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/dev/showcase?fixture=tasks");
  const proof = page.locator(".task-proof").last();
  const icon = proof.locator(":scope > span");
  const label = proof.locator("small");
  await expect(proof).toBeVisible();
  await expect(
    page.locator(".elimination-history-card", { hasText: "Your eliminations" }),
  ).toBeVisible();
  const [iconBox, labelBox] = await Promise.all([icon.boundingBox(), label.boundingBox()]);
  expect(iconBox).not.toBeNull();
  expect(labelBox).not.toBeNull();
  expect(
    Math.abs(iconBox!.y + iconBox!.height / 2 - (labelBox!.y + labelBox!.height / 2)),
  ).toBeLessThan(3);
});

const gameViewports = [
  { name: "phone-320", width: 320, height: 720 },
  { name: "phone-360", width: 360, height: 800 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "tablet-landscape", width: 1024, height: 768 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "wide", width: 1920, height: 1080 },
];

for (const viewport of gameViewports) {
  for (const theme of ["light", "dark"] as const) {
    test(`game fixtures fit ${viewport.name} in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setTheme(page, theme);
      for (const state of ["tasks", "role", "voting", "results"]) {
        await page.goto(`/dev/showcase?fixture=${state}`);
        await page.waitForLoadState("networkidle");
        const geometry = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        expect(geometry.scrollWidth, `${state} overflowed at ${viewport.name}`).toBeLessThanOrEqual(
          geometry.clientWidth + 1,
        );
        await expect(page.locator(".theme-toggle-game")).toBeVisible();
        await expect(page.locator(".game-sound-toggle")).toBeVisible();
      }
    });
  }
}

for (const theme of ["light", "dark"] as const) {
  for (const viewport of [
    { name: "phone", width: 390, height: 844 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 900 },
  ]) {
    test(`task command center visual ${theme} ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setTheme(page, theme);
      await page.goto("/dev/showcase?fixture=tasks");
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveScreenshot(`game-tasks-${theme}-${viewport.name}.png`, {
        animations: "disabled",
        fullPage: true,
        maxDiffPixelRatio: 0.015,
      });
    });
  }
}
