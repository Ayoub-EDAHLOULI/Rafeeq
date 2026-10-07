import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type ThemePreference = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "rafeeq-theme";

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getInitialPreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

function resolve(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? getSystemTheme() : preference;
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(
    getInitialPreference,
  );
  const [theme, setThemeState] = useState<ResolvedTheme>(() =>
    resolve(getInitialPreference()),
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    invoke("set_window_theme", { theme }).catch(() => {});
  }, [theme]);

  useEffect(() => {
    setThemeState(resolve(preference));
    localStorage.setItem(STORAGE_KEY, preference);

    if (preference !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setThemeState(getSystemTheme());
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [preference]);

  const toggleTheme = useCallback(() => {
    setPreference((current) => (resolve(current) === "dark" ? "light" : "dark"));
  }, []);

  return { theme, preference, setPreference, toggleTheme };
}
