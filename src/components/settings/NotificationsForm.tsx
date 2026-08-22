import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { useSettings, useUpdateSettings } from "@/hooks/queries/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/shared/toast";
import { getPushSubscriptionState, isPushSupported, subscribeToPush, unsubscribeFromPush, type PushSubscriptionState } from "@/lib/push";

// Bloom's bell notifications (below) are in-app only — no email behind
// these. Push (further down) is a separate, opt-in channel: it only
// covers job/tailoring/cover-letter completion, pending hard-requirement
// confirmations, and the daily encouragement message — not these social
// events, at least for now.
const NOTIFICATION_TYPES: { type: string; label: string; help: string }[] = [
  { type: "friend_request_received", label: "Friend requests", help: "When someone sends you a friend request." },
  { type: "friend_request_accepted", label: "Accepted requests", help: "When someone accepts your friend request." },
  { type: "reaction_received", label: "Encouragement", help: "When a friend sends you a reaction like \"You got this.\"" },
  { type: "group_invite_received", label: "Group invites", help: "When someone invites you to a group." },
];

function PushToggle() {
  const { user } = useAuth();
  const { push } = useToast();
  const [state, setState] = React.useState<PushSubscriptionState | "loading">("loading");
  const [busy, setBusy] = React.useState(false);
  const supported = isPushSupported();

  React.useEffect(() => {
    if (!supported) {
      setState("unsupported");
      return;
    }
    getPushSubscriptionState().then(setState);
  }, [supported]);

  async function toggle(enabled: boolean) {
    if (!user) return;
    setBusy(true);
    try {
      if (enabled) {
        await subscribeToPush(user.id);
        setState("subscribed");
      } else {
        await unsubscribeFromPush();
        setState("unsubscribed");
      }
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't update push notifications.", "error");
      setState(await getPushSubscriptionState());
    } finally {
      setBusy(false);
    }
  }

  const help =
    state === "unsupported"
      ? "Not supported in this browser — try installing Bloom to your home screen, or use a browser with push support."
      : state === "denied"
        ? "Blocked at the browser level — allow notifications for Bloom in your browser/device settings to turn this on."
        : "Get a notification here when a job analysis, tailored résumé, or cover letter finishes, when a hard requirement needs your confirmation, or when today's encouragement is ready.";

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3.5 py-2.5">
      <div className="min-w-0 pr-2">
        <p className="text-sm">Push notifications</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{help}</p>
      </div>
      <Switch
        checked={state === "subscribed"}
        disabled={busy || state === "unsupported" || state === "denied" || state === "loading"}
        onCheckedChange={toggle}
        aria-label="Push notifications"
      />
    </div>
  );
}

export function NotificationsForm() {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const { push } = useToast();

  if (!settings) return null;
  const muted = new Set(settings.muted_notification_types);

  async function toggle(type: string, enabled: boolean) {
    const next = enabled ? [...muted].filter((t) => t !== type) : [...muted, type];
    try {
      await updateSettings.mutateAsync({ muted_notification_types: next });
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't save that.", "error");
    }
  }

  return (
    <div className="grid gap-3">
      <PushToggle />

      <p className="mt-1 text-xs text-muted-foreground">These control what shows up in your notification bell (in-app only — no email).</p>
      {NOTIFICATION_TYPES.map((n) => (
        <div key={n.type} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3.5 py-2.5">
          <div className="min-w-0 pr-2">
            <p className="text-sm">{n.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{n.help}</p>
          </div>
          <Switch checked={!muted.has(n.type)} onCheckedChange={(v) => toggle(n.type, v)} aria-label={n.label} />
        </div>
      ))}
    </div>
  );
}
