import { Bell, Check } from "lucide-react";
import * as React from "react";
import { useNavigate } from "react-router-dom";
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

function getNotificationTarget(event: ActivityEvent): string {
  switch (event.type) {
    case "friend_request_received":
    case "friend_request_accepted":
      return "/app/friends";
    case "group_invite_received":
      return "/app/groups";
    case "reaction_received": {
      const contextType = typeof event.payload?.context_type === "string" ? event.payload.context_type : null;
      if (contextType === "goal") return "/app/goals";
      if (contextType === "group") return "/app/groups";
      return "/app/friends";
    }
    default:
      return "/app";
  }
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { data: notifications = [] } = useNotifications();
  const { data: unread = 0 } = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [open, setOpen] = React.useState(false);
  const actorIds = Array.from(new Set(notifications.map((notification) => notification.actor_id).filter((id): id is string => Boolean(id))));
  const { data: actorProfiles } = useVisibleBasicProfiles(actorIds);

  async function handleNotificationClick(notification: ActivityEvent) {
    if (!notification.read_at) {
      await markRead.mutateAsync(notification.id);
    }
    setOpen(false);
    navigate(getNotificationTarget(notification));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
                onClick={() => void handleNotificationClick(n)}
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
