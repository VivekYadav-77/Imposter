(() => {
  try {
    const saved = localStorage.getItem("imposter-game-theme");
    const theme =
      saved === "light" || saved === "dark"
        ? saved
        : matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
})();
