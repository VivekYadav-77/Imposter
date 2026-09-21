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
  });

  it("ships focus, reduced-motion, safe-area, and small-phone rules", async () => {
    const css = await readFile("app/globals.css", "utf8");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("safe-area-inset-bottom");
    expect(css).toContain("max-width: 360px");
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
});
