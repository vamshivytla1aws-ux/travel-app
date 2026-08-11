"use client";

import { useCallback, useEffect, useState } from "react";

type ThemeMode = "dark";
const themeStorageKey = "etms-theme";

function applyThemeToDom(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
}

export function useThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    applyThemeToDom("dark");
    localStorage.setItem(themeStorageKey, "dark");
    setTheme("dark");
  }, []);

  const toggleTheme = useCallback(() => {
    applyThemeToDom("dark");
    localStorage.setItem(themeStorageKey, "dark");
    setTheme("dark");
  }, []);

  return {
    theme,
    isDark: true,
    toggleTheme,
  };
}
