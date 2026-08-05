import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ThoughtBubble } from "@/components/shared/ThoughtBubble";
import { useMutualConnections } from "@/hooks/queries/useFriendConnections";
import { useSignedAvatarUrl } from "@/hooks/useSignedAvatarUrl";
import { initials } from "@/lib/utils";
import type { FriendCard as FriendCardData } from "@/types/database";
import { Flame, Users2 } from "lucide-react";

export function FriendProfileDialog({
  friend,
  open,
  onOpenChange,
}: {
  friend: FriendCardData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const avatarUrl = useSignedAvatarUrl(friend?.avatar_url ?? null);
  const { data: mutual } = useMutualConnections(open ? friend?.user_id : undefined);

  if (!friend) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="sr-only">{friend.display_name || friend.username}&apos;s profile</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14 border border-border">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
            <AvatarFallback className="text-lg">{initials(friend.display_name || friend.username)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold">{friend.display_name || friend.username}</p>
            <p className="truncate text-sm text-muted-foreground">@{friend.username}</p>
          </div>
        </div>

        {friend.status_message && (
          <ThoughtBubble className="mt-2">
            <p className="text-sm leading-6 text-foreground/80">{friend.status_message}</p>
          </ThoughtBubble>
        )}

        {friend.applications_this_week !== null && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Weekly applications</span>
              <span className="font-medium">
                {friend.applications_this_week}
                {friend.weekly_goal ? ` of ${friend.weekly_goal}` : ""}
              </span>
            </div>
            {Boolean(friend.weekly_goal) && (
              <Progress value={Math.min(100, (friend.applications_this_week / (friend.weekly_goal || 1)) * 100)} className="mt-1 h-1.5" />
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {friend.interviews_count !== null && <span>{friend.interviews_count} interviews</span>}
          {friend.offers_count !== null && <span>{friend.offers_count} offers</span>}
          {friend.current_streak !== null && friend.current_streak > 0 && (
            <span className="flex items-center gap-1 text-gold">
              <Flame className="h-3 w-3" /> {friend.current_streak}-day streak
            </span>
          )}
        </div>

        {(mutual?.mutual_groups.length || mutual?.mutual_goals.length) ? (
          <div className="mt-3 rounded-xl border border-border/70 bg-card/60 p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Users2 className="h-3.5 w-3.5" /> In common
            </p>
            <div className="flex flex-wrap gap-1.5">
              {mutual?.mutual_groups.map((name) => (
                <span key={`g-${name}`} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                  {name}
                </span>
              ))}
              {mutual?.mutual_goals.map((name) => (
                <span key={`goal-${name}`} className="rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground">
                  {name}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
