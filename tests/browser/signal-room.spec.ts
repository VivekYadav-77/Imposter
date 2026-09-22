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
