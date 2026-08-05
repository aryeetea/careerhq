import { REACTION_META } from "@/lib/constants";
import type { ActivityEvent } from "@/types/database";

let audioContext: AudioContext | null = null;
let audioUnlocked = false;
let notificationPrompted = false;

function ensureAudioUnlockListeners() {
  if (typeof window === "undefined" || audioUnlocked) return;

  const unlock = async () => {
    try {
      audioContext ??= new window.AudioContext();
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "default" &&
        !notificationPrompted
      ) {
        notificationPrompted = true;
        void Notification.requestPermission().catch(() => "default");
      }
      audioUnlocked = true;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    } catch {
      // Ignore browser audio-policy failures; toasts still make activity visible.
    }
  };

  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
}

ensureAudioUnlockListeners();

export function describeNotificationEvent(event: ActivityEvent, actorName?: string | null): string {
  switch (event.type) {
    case "friend_request_received":
      return actorName ? `${actorName} sent you a friend request` : "You have a new friend request";
    case "friend_request_accepted":
      return actorName ? `${actorName} accepted your friend request` : "Your friend request was accepted";
    case "reaction_received": {
      const reactionType = (event.payload?.reaction_type as string) ?? "cheering";
      const meta = REACTION_META[reactionType as keyof typeof REACTION_META];
      return meta
        ? `${actorName ?? "Someone"} sent you "${meta.label}" ${meta.emoji}`
        : `${actorName ?? "Someone"} sent you encouragement`;
    }
    case "group_invite_received":
      return actorName ? `${actorName} invited you to a group` : "You've been invited to a group";
    default:
      return "New activity";
  }
}

export function maybeShowBrowserNotification(message: string) {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (document.visibilityState === "visible") return;
  if (Notification.permission !== "granted") return;

  try {
    const notification = new Notification("Bloom", { body: message, silent: true });
    window.setTimeout(() => notification.close(), 5000);
  } catch {
    // Ignore browser notification failures; in-app alerts still appear.
  }
}

export function maybePlayNotificationSound() {
  if (typeof window === "undefined") return;

  try {
    audioContext ??= new window.AudioContext();
    if (audioContext.state !== "running") return;

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(784, now);
    oscillator.frequency.exponentialRampToValueAtTime(1046, now + 0.16);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.36);
  } catch {
    // Ignore browser audio failures.
  }
}
