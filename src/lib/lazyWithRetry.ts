import { lazy, type ComponentType } from "react";

// Route-level code splitting (see App.tsx) means every lazy page is its own
// JS chunk with a content hash in the filename. Two ways that bites a
// visitor who already has the app open in a tab:
//
// 1. A new deploy ships and renames every chunk. Their tab still holds the
//    OLD index.html, which references the OLD chunk URL — clicking a nav
//    link they haven't visited yet in this tab tries to fetch a file that
//    no longer exists on the server (404), and the dynamic import() rejects.
// 2. A one-off network blip fails the fetch for an otherwise-valid chunk.
//
// Either way, React.lazy() caches the rejected import() promise and will
// keep re-throwing that same rejection on every future render attempt —
// clicking the link again does nothing, and it looks exactly like "this
// page is just broken." The only thing that actually fixes it is a full
// reload, which re-fetches a fresh index.html pointing at the current
// chunk hashes. This wrapper does that reload automatically, once, instead
// of leaving the user to discover the trick themselves.
const RELOAD_KEY = "bloom:chunk-reload-attempted";

export function lazyWithRetry<T extends ComponentType<unknown>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await factory();
      // A later successful import means whatever failed before is over —
      // clear the flag so a genuinely new, unrelated failure later in the
      // same tab still gets its own single automatic reload rather than
      // being treated as "already tried that."
      window.sessionStorage.removeItem(RELOAD_KEY);
      return mod;
    } catch (error) {
      if (!window.sessionStorage.getItem(RELOAD_KEY)) {
        window.sessionStorage.setItem(RELOAD_KEY, "1");
        window.location.reload();
        // The reload is already in flight; never resolve so React doesn't
        // render anything from this failed attempt in the meantime.
        return new Promise<{ default: T }>(() => {});
      }
      // Already reloaded once for a chunk failure and it happened again —
      // a real error, not a stale chunk. Let it surface normally
      // (caught by the app-level ErrorBoundary in App.tsx).
      window.sessionStorage.removeItem(RELOAD_KEY);
      throw error;
    }
  });
}
