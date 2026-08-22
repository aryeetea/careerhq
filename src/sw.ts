/// <reference lib="webworker" />
// Bloom's service worker. Built via vite-plugin-pwa's `injectManifest`
// strategy (see vite.config.ts) — precacheAndRoute below is populated at
// build time with the app's actual asset list; nothing else here is
// generated, so the push-notification handling further down is regular,
// readable code rather than opaque Workbox config.
import { precacheAndRoute } from "workbox-precaching";

// __WB_MANIFEST is injected by vite-plugin-pwa's `injectManifest` build
// step (see vite.config.ts) — not a real global at typecheck time.
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

precacheAndRoute(self.__WB_MANIFEST);

// Installable-app requirement is just "a registered service worker" —
// Bloom doesn't need offline page caching (it's a live, account-backed
// app; a stale offline shell would be actively misleading), so this skips
// straight to activating instead of layering a runtime caching strategy
// on top of the precached build assets above.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// PUSH NOTIFICATIONS
//
// Fires when a push message arrives from Bloom's push-sending edge
// function (see supabase/functions/send-push) via the browser's push
// service — works even when no Bloom tab is open, which is the whole
// point of this being in the service worker rather than the Notification
// Web API used elsewhere (src/lib/notificationAlerts.ts) for in-app
// alerts while a tab is open.
//
// Payload shape is controlled entirely by Bloom's own edge function (see
// buildPushPayload there) — always `{ title, body, url, tag }`. Never
// trust it as more than that: it's just data, not something that can run
// code here.
interface BloomPushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

function isBloomPushPayload(value: unknown): value is BloomPushPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.title === "string" && typeof v.body === "string" && typeof v.url === "string" && typeof v.tag === "string";
}

self.addEventListener("push", (event) => {
  let payload: BloomPushPayload = {
    title: "Bloom",
    body: "You have a new update.",
    url: "/",
    tag: "bloom-generic",
  };
  try {
    const data = event.data?.json();
    if (isBloomPushPayload(data)) payload = data;
  } catch {
    // Malformed/non-JSON payload — fall back to the generic notification
    // above rather than dropping the push silently.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      // Reuses Bloom's own app icon (see public/pwa-*.png) so the
      // notification is recognizable at a glance, same as any other
      // native notification on the device.
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      // Same tag = same event TYPE (e.g. "bloom-daily-encouragement")
      // collapses into one notification instead of piling up duplicates
      // if several fire before the user looks at their device.
      tag: payload.tag,
      data: { url: payload.url },
    }),
  );
});

// Clicking the notification focuses an already-open Bloom tab on the
// right page if one exists, rather than always opening a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data as { url?: string } | undefined)?.url ?? "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = allClients.find((client) => "focus" in client);
      if (existing) {
        await (existing as WindowClient).focus();
        if ("navigate" in existing) await (existing as WindowClient).navigate(targetUrl).catch(() => void 0);
        return;
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
