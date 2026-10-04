(() => {
  try {
    const saved = globalThis.localStorage.getItem("imposter-game-theme");
    const theme =
      saved === "light" || saved === "dark"
        ? saved
        : globalThis.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";
    globalThis.document.documentElement.dataset.theme = theme;
    globalThis.document.documentElement.style.colorScheme = theme;
  } catch {
    globalThis.document.documentElement.dataset.theme = "dark";
  }
})();
