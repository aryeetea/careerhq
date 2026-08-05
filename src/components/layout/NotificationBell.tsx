import { Bell, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, useUnreadCount } from "@/hooks/queries/useNotifications";
import { useVisibleBasicProfiles } from "@/hooks/queries/useProfile";
import { REACTION_META } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import type { ActivityEvent } from "@/types/database";

function describeEvent(e: ActivityEvent, actorName?: string | null): string {
  switch (e.type) {
    case "friend_request_received":
      return actorName ? `${actorName} sent you a friend request` : "You have a new friend request";
    case "friend_request_accepted":
      return actorName ? `${actorName} accepted your friend request` : "Your friend request was accepted";
    case "reaction_received": {
      const reactionType = (e.payload?.reaction_type as string) ?? "cheering";
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

export function NotificationBell() {
  const { data: notifications = [] } = useNotifications();
  const { data: unread = 0 } = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const actorIds = Array.from(new Set(notifications.map((notification) => notification.actor_id).filter((id): id is string => Boolean(id))));
  const { data: actorProfiles } = useVisibleBasicProfiles(actorIds);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}>
          <Bell className="h-4.5 w-4.5" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-rose motion-safe:animate-ring-glow" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Check className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {notifications.length === 0 ? (
            <EmptyState title="All caught up" description="You're all caught up." className="py-8" />
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.read_at && markRead.mutate(n.id)}
                className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary/60"
              >
                <span className="flex w-full items-center gap-2 text-sm">
                  {!n.read_at && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                  <span className={n.read_at ? "text-muted-foreground" : "font-medium"}>
                    {describeEvent(n, n.actor_id ? actorProfiles?.get(n.actor_id)?.display_name || actorProfiles?.get(n.actor_id)?.username : null)}
                  </span>
                </span>
                <span className="pl-3.5 text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
