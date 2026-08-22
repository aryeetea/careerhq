import { supabase } from "@/lib/supabase";

/** True when this browser could theoretically support web push — not
 * whether the user has actually granted permission or subscribed. */
export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY);
}

// PushManager.subscribe wants the VAPID public key as a raw Uint8Array,
// not the base64url string it's normally shared/stored as. Cast to
// BufferSource at the end only: Uint8Array.from's inferred generic
// (Uint8Array<ArrayBufferLike>) doesn't structurally satisfy the DOM
// lib's BufferSource (ArrayBuffer specifically) even though the buffer
// really is a plain ArrayBuffer here — a TS lib strictness gap, not a
// real runtime concern.
function urlBase64ToUint8Array(base64Url: string): BufferSource {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0)) as BufferSource;
}

export type PushSubscriptionState = "unsupported" | "denied" | "subscribed" | "unsubscribed";

/** Current state without prompting for anything — safe to call on mount. */
export async function getPushSubscriptionState(): Promise<PushSubscriptionState> {
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? "subscribed" : "unsubscribed";
}

/**
 * Requests notification permission (if not already decided) and
 * subscribes this browser/device, saving the subscription to
 * push_subscriptions (see migration 0045) under the current user.
 * Throws a plain Error with a message safe to show the user directly —
 * callers (e.g. the Settings toggle) can put it straight in a toast.
 */
export async function subscribeToPush(userId: string): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("Push notifications aren't supported in this browser.");
  }

  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission wasn't granted.");
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true, // required by the spec — every push must surface a visible notification
      applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY!),
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Couldn't read this browser's push subscription.");
  }

  // Upsert on endpoint (unique per migration 0045) — re-subscribing an
  // already-known device (e.g. toggling the Settings switch off and back
  // on) updates the same row instead of erroring on the unique
  // constraint or creating a duplicate.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth_key: json.keys.auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error("Saved the subscription locally, but couldn't sync it to your account.");
}

/** Unsubscribes this browser/device and removes its row from
 * push_subscriptions. Safe to call even if never subscribed. */
export async function unsubscribeFromPush(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
