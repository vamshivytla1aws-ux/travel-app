"use client";

import { useCallback, useEffect, useState } from "react";

type ThemeMode = "light" | "dark";
const themeStorageKey = "etms-theme";

function getSystemTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getCurrentThemeFromDom(): ThemeMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyThemeToDom(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
}

export function useThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const fromStorage = localStorage.getItem(themeStorageKey);
    const resolvedTheme: ThemeMode =
      fromStorage === "light" || fromStorage === "dark" ? fromStorage : getSystemTheme();
    applyThemeToDom(resolvedTheme);
    setTheme(getCurrentThemeFromDom());
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyThemeToDom(next);
      localStorage.setItem(themeStorageKey, next);
      return next;
    });
  }, []);

  return {
    theme,
    isDark: theme === "dark",
    toggleTheme,
  };
}
