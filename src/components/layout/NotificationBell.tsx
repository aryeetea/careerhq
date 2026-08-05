import { Bell, Check } from "lucide-react";
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, useUnreadCount } from "@/hooks/queries/useNotifications";
import { useVisibleBasicProfiles } from "@/hooks/queries/useProfile";
import { getPersonProfilePath } from "@/lib/people";
import { describeNotificationEvent } from "@/lib/notificationAlerts";
import { timeAgo } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import type { ActivityEvent } from "@/types/database";

function getNotificationTarget(event: ActivityEvent): string {
  if (
    event.actor_id &&
    (event.type === "friend_request_received" || event.type === "friend_request_accepted" || event.type === "reaction_received")
  ) {
    return getPersonProfilePath(event.actor_id);
  }

  switch (event.type) {
    case "group_invite_received":
      return "/app/groups";
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
                    {describeNotificationEvent(n, n.actor_id ? actorProfiles?.get(n.actor_id)?.display_name || actorProfiles?.get(n.actor_id)?.username : null)}
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
