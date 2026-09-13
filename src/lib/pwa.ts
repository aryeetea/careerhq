// Registers Bloom's service worker (src/sw.ts) — the one piece of
// scaffolding that makes the app installable and lets push notifications
// (see PUSH NOTIFICATIONS in sw.ts) reach the user even when no Bloom tab
// is open. Called once from main.tsx.
//
// `registerType: "autoUpdate"` (vite.config.ts) means registerSW() also
// polls for a new worker and activates it automatically — no "refresh to
// update" prompt to build, deliberately: Bloom already re-fetches its own
// data on load, so a background worker swap is invisible to the user and
// not worth interrupting them over.
export function registerServiceWorker() {
  // Only in production and only where the API exists — dev already skips
  // this (devOptions.enabled: false in vite.config.ts), and older
  // browsers without serviceWorker support should just get the regular
  // web app, not an error.
  if (import.meta.env.DEV || !("serviceWorker" in navigator)) return;

  // A worker can activate while this page is still running its old hashed
  // JS/CSS bundle. Reload once when control changes so a deployed visual
  // update is actually rendered, rather than waiting for a manual refresh.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const reloadedAt = Number(sessionStorage.getItem("bloom-sw-reloaded-at") ?? 0);
    if (Date.now() - reloadedAt < 10_000) return;
    sessionStorage.setItem("bloom-sw-reloaded-at", String(Date.now()));
    window.location.reload();
  });

  import("virtual:pwa-register")
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch((error) => console.error("Service worker registration failed", error));
}
