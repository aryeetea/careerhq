import { Switch } from "@/components/ui/switch";
import { useSettings, useUpdateSettings } from "@/hooks/queries/useProfile";
import { useToast } from "@/components/shared/toast";

// Bloom's notifications are in-app only today — there's no email or push
// delivery behind these, so this only controls what shows up in the bell,
// not a channel that doesn't exist yet.
const NOTIFICATION_TYPES: { type: string; label: string; help: string }[] = [
  { type: "friend_request_received", label: "Friend requests", help: "When someone sends you a friend request." },
  { type: "friend_request_accepted", label: "Accepted requests", help: "When someone accepts your friend request." },
  { type: "reaction_received", label: "Encouragement", help: "When a friend sends you a reaction like \"You got this.\"" },
  { type: "group_invite_received", label: "Group invites", help: "When someone invites you to a group." },
];

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
      <p className="text-xs text-muted-foreground">
        These control what shows up in your notification bell. Bloom doesn't send email or push notifications today.
      </p>
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
