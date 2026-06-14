import { createContext, useContext, useLayoutEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type Theme = "light" | "dark";

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "light",
  setTheme: () => null
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

function getInitialTheme(defaultTheme: Theme, storageKey: string) {
  if (typeof window === "undefined") {
    return defaultTheme;
  }

  try {
    const storedTheme = window.localStorage.getItem(storageKey);
    return storedTheme === "light" || storedTheme === "dark" ? storedTheme : defaultTheme;
  } catch {
    return defaultTheme;
  }
}

function applyTheme(theme: Theme) {
  const root = window.document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "appstore-price-theme"
}: {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme(defaultTheme, storageKey));

  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme: (nextTheme: Theme) => {
        try {
          window.localStorage.setItem(storageKey, nextTheme);
        } catch {
          // Keep the in-memory theme even when browser storage is unavailable.
        }
        setThemeState(nextTheme);
      }
    }),
    [storageKey, theme]
  );

  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeProviderContext);
}
