import * as React from "react";
import { format } from "date-fns";
import { LoaderCircle, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSettings, useUpdateSettings } from "@/hooks/queries/useProfile";
import { usePushSubscriptions, useDeletePushSubscription } from "@/hooks/queries/usePushSubscriptions";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/shared/toast";
import {
  describeUserAgent,
  getCurrentPushEndpoint,
  getPushSubscriptionState,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  type PushSubscriptionState,
} from "@/lib/push";

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

/** Toggle + "manage devices" list, sharing one refresh cycle so removing
 * this device from the list below immediately flips the toggle off too,
 * and toggling off immediately drops this device's row from the list —
 * two views of the same underlying browser subscription state, kept in
 * sync explicitly rather than left to drift on their own. */
function PushSettings() {
  const { user } = useAuth();
  const { push } = useToast();
  const { data: subscriptions } = usePushSubscriptions();
  const deleteSubscription = useDeletePushSubscription();

  const [state, setState] = React.useState<PushSubscriptionState | "loading">("loading");
  const [currentEndpoint, setCurrentEndpoint] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const supported = isPushSupported();

  const refresh = React.useCallback(async () => {
    if (!supported) {
      setState("unsupported");
      setCurrentEndpoint(null);
      return;
    }
    const [nextState, endpoint] = await Promise.all([getPushSubscriptionState(), getCurrentPushEndpoint()]);
    setState(nextState);
    setCurrentEndpoint(endpoint);
  }, [supported]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function toggle(enabled: boolean) {
    if (!user) return;
    setBusy(true);
    try {
      if (enabled) {
        await subscribeToPush(user.id);
      } else {
        await unsubscribeFromPush();
      }
      await refresh();
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't update push notifications.", "error");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeDevice(id: string, endpoint: string) {
    setPendingId(id);
    try {
      if (endpoint === currentEndpoint) {
        // This device's own row — unsubscribe for real (browser +
        // account), not just delete the row, so the toggle above and
        // this list stay honest about what's actually still subscribed.
        await unsubscribeFromPush();
        await refresh();
      } else {
        await deleteSubscription.mutateAsync(id);
      }
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't remove that device.", "error");
    } finally {
      setPendingId(null);
    }
  }

  const help =
    state === "unsupported"
      ? "Not supported in this browser — try installing Bloom to your home screen, or use a browser with push support."
      : state === "denied"
        ? "Blocked at the browser level — allow notifications for Bloom in your browser/device settings to turn this on."
        : "Get a notification here when a job analysis, tailored résumé, or cover letter finishes, when a hard requirement needs your confirmation, or when today's encouragement is ready.";

  return (
    <div className="grid gap-2">
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

      {subscriptions && subscriptions.length > 0 && (
        <div className="grid gap-1.5 pl-1">
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            Devices ({subscriptions.length})
          </p>
          {subscriptions.map((sub) => (
            <div key={sub.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/40 px-3 py-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm">
                  {describeUserAgent(sub.user_agent)}
                  {sub.endpoint === currentEndpoint && <Badge variant="secondary">This device</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">Added {format(new Date(sub.created_at), "MMM d, yyyy")}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground hover:text-destructive"
                disabled={pendingId === sub.id}
                onClick={() => removeDevice(sub.id, sub.endpoint)}
              >
                {pendingId === sub.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ))}
        </div>
      )}
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
      <PushSettings />

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
