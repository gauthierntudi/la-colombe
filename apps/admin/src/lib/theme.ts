export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "ges-theme";

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "dark" || stored === "light" ? stored : null;
}

export function resolveTheme(): Theme {
  return getStoredTheme() ?? "light";
}
