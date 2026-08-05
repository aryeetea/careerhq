import * as React from "react";
import { Flame, MoreVertical, UserMinus, Ban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ReactionPicker } from "@/components/friends/ReactionPicker";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useSignedAvatarUrl } from "@/hooks/useSignedAvatarUrl";
import { useRemoveFriend, useBlockUser } from "@/hooks/queries/useFriends";
import { useToast } from "@/components/shared/toast";
import { initials } from "@/lib/utils";
import type { FriendCard as FriendCardData } from "@/types/database";

export function FriendCard({ friend }: { friend: FriendCardData }) {
  const avatarUrl = useSignedAvatarUrl(friend.avatar_url);
  const removeFriend = useRemoveFriend();
  const blockUser = useBlockUser();
  const { push } = useToast();
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const [confirmBlock, setConfirmBlock] = React.useState(false);

  const hasAnyShared =
    friend.applications_this_week !== null ||
    friend.interviews_count !== null ||
    friend.offers_count !== null ||
    friend.current_streak !== null ||
    friend.certification_percentage !== null;

  return (
    <Card className="hover-lift">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-11 w-11 border border-border">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
            <AvatarFallback>{initials(friend.display_name || friend.username)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{friend.display_name || friend.username}</p>
            <p className="truncate text-xs text-muted-foreground">@{friend.username}</p>
            {friend.status_message && <p className="mt-1 text-xs italic text-muted-foreground">"{friend.status_message}"</p>}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full p-1 text-muted-foreground outline-none hover:bg-secondary">
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setConfirmRemove(true)}>
                <UserMinus className="mr-2 h-4 w-4" /> Remove friend
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setConfirmBlock(true)} className="text-destructive focus:text-destructive">
                <Ban className="mr-2 h-4 w-4" /> Block
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {!hasAnyShared ? (
          <p className="mt-3 rounded-lg bg-secondary/50 px-3 py-2.5 text-xs text-muted-foreground">
            {friend.display_name || friend.username} hasn't chosen to share progress yet.
          </p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {friend.applications_this_week !== null && (
              <div>
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

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {friend.interviews_count !== null && <span>{friend.interviews_count} interviews</span>}
              {friend.offers_count !== null && <span>{friend.offers_count} offers</span>}
              {friend.current_streak !== null && friend.current_streak > 0 && (
                <span className="flex items-center gap-1 text-gold"><Flame className="h-3 w-3" /> {friend.current_streak}-day streak</span>
              )}
            </div>

            {friend.certification_name && friend.certification_percentage !== null && (
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate text-muted-foreground">{friend.certification_name}</span>
                  <span className="font-medium">{friend.certification_percentage}%</span>
                </div>
                <Progress value={friend.certification_percentage} className="mt-1 h-1.5" />
              </div>
            )}
          </div>
        )}

        <div className="mt-3">
          <ReactionPicker recipientId={friend.user_id} contextType="weekly_progress" />
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove ${friend.display_name || friend.username}?`}
        description="You can send a new friend request later if you change your mind."
        confirmLabel="Remove"
        onConfirm={async () => {
          await removeFriend.mutateAsync(friend.user_id);
          push("Friend removed", "info");
        }}
      />
      <ConfirmDialog
        open={confirmBlock}
        onOpenChange={setConfirmBlock}
        title={`Block ${friend.display_name || friend.username}?`}
        description="They won't be able to send you friend requests, and this removes them as a friend."
        confirmLabel="Block"
        onConfirm={async () => {
          await blockUser.mutateAsync(friend.user_id);
          push("User blocked", "info");
        }}
      />
    </Card>
  );
}
