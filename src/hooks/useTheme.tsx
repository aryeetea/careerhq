import * as React from "react";
import type { ThemeName } from "@/types/database";

const STORAGE_KEY = "bloom-theme";
const THEME_MIGRATION_KEY = "bloom-theme-migrated";
const THEME_MIGRATION_VERSION = "3";

// These were the themes available before the playful theme refresh. They
// remain valid choices in the picker, but an old persisted value should not
// silently win over the new Arcade default on first load after the refresh.
const LEGACY_THEMES: readonly ThemeName[] = ["floral", "neutral", "sunrise", "meadow", "dark", "midnight"];
const THEMES: readonly ThemeName[] = [...LEGACY_THEMES, "comic-pop", "arcade", "candy"];

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function getInitialTheme(): ThemeName {
  const stored = localStorage.getItem(STORAGE_KEY) as ThemeName | null;
  const hasCurrentMigration = localStorage.getItem(THEME_MIGRATION_KEY) === THEME_MIGRATION_VERSION;

  if (!hasCurrentMigration && stored && LEGACY_THEMES.includes(stored)) {
    localStorage.setItem(STORAGE_KEY, "arcade");
    localStorage.setItem(THEME_MIGRATION_KEY, THEME_MIGRATION_VERSION);
    return "arcade";
  }

  if (stored && THEMES.includes(stored)) {
    localStorage.setItem(THEME_MIGRATION_KEY, THEME_MIGRATION_VERSION);
    return stored;
  }

  localStorage.setItem(STORAGE_KEY, "arcade");
  localStorage.setItem(THEME_MIGRATION_KEY, THEME_MIGRATION_VERSION);
  return "arcade";
}

function applyTheme(theme: ThemeName) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  if (theme === "dark" || theme === "floral") {
    root.removeAttribute("data-theme");
    return;
  }
  root.setAttribute("data-theme", theme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemeName>(getInitialTheme);

  React.useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = React.useCallback((next: ThemeName) => setThemeState(next), []);

  const value = React.useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/**
 * Pulls the account's saved theme (settings.theme) down into this session
 * whenever it loads or changes — including a change made from another
 * device/browser, which arrives here via useSettingsRealtime same as any
 * other settings field. ThemePicker is the only place that pushes a theme
 * change back up to settings (see its `choose`); this is the read-side
 * half of that round trip, so theme "just follows the account" instead of
 * resetting to this browser's local default on a new device.
 *
 * Deliberately its own hook rather than living inside ThemeProvider:
 * ThemeProvider is mounted above AuthProvider (so unauthenticated pages
 * still get a theme), so it has no user/settings to read. This is called
 * from RealtimeSync instead, once a session exists — the same place every
 * other cross-device settings sync (jobs, journal, profile, ...) lives.
 */
export function useThemeSync(settingsTheme: ThemeName | undefined) {
  const { theme, setTheme } = useTheme();
  React.useEffect(() => {
    // A deployment can reach the client before its accompanying database
    // migration has rewritten older settings rows. Never let one of those
    // rows immediately undo the Arcade migration in this browser. This also
    // corrects an already-open tab whose state was set before the migration.
    if (settingsTheme && LEGACY_THEMES.includes(settingsTheme)) {
      if (theme !== "arcade") setTheme("arcade");
      return;
    }

    if (settingsTheme && settingsTheme !== theme) {
      setTheme(settingsTheme);
    }
    // Only react to the account's theme changing, not to local `theme` —
    // including it would fire this right back at itself the moment
    // ThemePicker's mutation round-trips its own change back down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsTheme]);
}

/** True when the user's OS/browser requests reduced motion. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setReduced(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

/** True on narrow (phone-width) viewports — used by the product tour to swap
 * its floating card + connector line for a simpler anchored bottom sheet,
 * where a long diagonal connector would have nowhere good to go. */
export function useIsCompact(): boolean {
  const [compact, setCompact] = React.useState(
    () => window.matchMedia?.("(max-width: 640px)").matches ?? false
  );
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const handler = () => setCompact(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return compact;
}

/** True while the browser tab is visible — used to pause ambient animation off-screen. */
export function usePageVisible(): boolean {
  const [visible, setVisible] = React.useState(document.visibilityState === "visible");
  React.useEffect(() => {
    const handler = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);
  return visible;
}
