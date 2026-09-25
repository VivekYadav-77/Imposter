"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";

export type Theme = "light" | "dark";

const STORAGE_KEY = "imposter-game-theme";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function applyTheme(theme: Theme, persist = true) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  if (persist) window.localStorage.setItem(STORAGE_KEY, theme);
}

export function ThemeToggle({
  placement = "public",
}: {
  placement?: "public" | "game" | "compact";
}) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(currentTheme());

    const media = window.matchMedia("(prefers-color-scheme: light)");
    const followSystem = (event: MediaQueryListEvent) => {
      if (window.localStorage.getItem(STORAGE_KEY)) return;
      const next = event.matches ? "light" : "dark";
      applyTheme(next, false);
      setTheme(next);
    };
    const syncTabs = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next = event.newValue === "light" ? "light" : "dark";
      applyTheme(next, false);
      setTheme(next);
    };

    media.addEventListener("change", followSystem);
    window.addEventListener("storage", syncTabs);
    return () => {
      media.removeEventListener("change", followSystem);
      window.removeEventListener("storage", syncTabs);
    };
  }, []);

  const nextTheme: Theme = theme === "light" ? "dark" : "light";
  const label = theme === "light" ? "Switch to dark theme" : "Switch to light theme";

  if (
    placement === "public" &&
    (pathname.startsWith("/room") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/dashboard") ||
      pathname === "/login" ||
      pathname === "/register")
  )
    return null;

  return (
    <button
      type="button"
      className={`theme-toggle theme-toggle-${placement}`}
      aria-label={label}
      title={label}
      disabled={!theme}
      onClick={() => {
        applyTheme(nextTheme);
        setTheme(nextTheme);
      }}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        <Icon name={theme === "light" ? "moon" : "sun"} size={20} />
      </span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
