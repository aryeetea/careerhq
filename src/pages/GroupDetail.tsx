import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, LogOut, Trash2, UserPlus, UserMinus } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ReactionPicker } from "@/components/friends/ReactionPicker";
import { InviteToGroupDialog } from "@/components/groups/InviteToGroupDialog";
import { useDeleteGroup, useGroup, useLeaveGroup, useRemoveGroupMember } from "@/hooks/queries/useGroups";
import { useSharedContextProfiles } from "@/hooks/queries/useProfile";
import { useSignedAvatarUrl } from "@/hooks/useSignedAvatarUrl";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/shared/toast";
import { getFriendCards } from "@/services/friends";
import { initials } from "@/lib/utils";

function MemberRow({ userId, name, avatarPath, weeklyGoalTarget, groupId, isOwnerView, onRemove }: {
  userId: string; name: string; avatarPath: string | null; weeklyGoalTarget: number | null; groupId: string; isOwnerView: boolean; onRemove: () => void;
}) {
  const { user } = useAuth();
  const avatarUrl = useSignedAvatarUrl(avatarPath);
  const { data: cardMap } = useQuery({
    queryKey: ["group-member-card", userId],
    queryFn: () => getFriendCards([userId]),
    select: (cards) => cards[0] ?? null,
  });

  const weekly = cardMap?.applications_this_week ?? null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/50 p-3">
      <Avatar className="h-9 w-9 border border-border">
        {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
        <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        {weekly !== null ? (
          <>
            <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Weekly applications</span>
              <span>{weekly}{weeklyGoalTarget ? ` / ${weeklyGoalTarget}` : ""}</span>
            </div>
            {weeklyGoalTarget ? <Progress value={Math.min(100, (weekly / weeklyGoalTarget) * 100)} className="mt-1 h-1.5" /> : null}
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground">Progress is private</p>
        )}
      </div>
      {userId !== user?.id && <ReactionPicker recipientId={userId} contextType="group" contextId={groupId} />}
      {isOwnerView && userId !== user?.id && (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onRemove}>
          <UserMinus className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export default function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: group, isLoading } = useGroup(groupId);
  const leaveGroup = useLeaveGroup();
  const removeMember = useRemoveGroupMember();
  const deleteGroupMutation = useDeleteGroup();
  const { push } = useToast();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [confirmLeave, setConfirmLeave] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [removeTarget, setRemoveTarget] = React.useState<string | null>(null);

  const memberIds = React.useMemo(() => group?.group_members.map((m) => m.user_id) ?? [], [group]);
  const { data: profileMap } = useSharedContextProfiles(memberIds);

  if (isLoading || !group) {
    return (
      <div className="flex flex-1 flex-col">
        <TopBar title="Group" />
        <div className="px-4 pb-10 sm:px-8"><Skeleton className="h-64 rounded-2xl" /></div>
      </div>
    );
  }

  const isOwner = group.owner_id === user?.id;

  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        title={group.name}
        subtitle={group.description ?? undefined}
        action={
          <>
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/app/groups")}>
              <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">All groups</span>
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">Invite</span>
            </Button>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto px-4 pb-10 sm:px-8">
        <Card className="glass-subtle mb-4 border-border/60">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="text-sm text-muted-foreground">
              {group.group_members.length} member{group.group_members.length === 1 ? "" : "s"}
              {group.weekly_goal_target ? ` · shared goal: ${group.weekly_goal_target} applications/week` : ""}
            </div>
            <div className="flex gap-2">
              {isOwner ? (
                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete group
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setConfirmLeave(true)}>
                  <LogOut className="h-3.5 w-3.5" /> Leave group
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-2.5">
          {group.group_members.map((m) => {
            const profile = profileMap?.get(m.user_id);
            return (
              <MemberRow
                key={m.id}
                userId={m.user_id}
                name={m.user_id === user?.id ? "You" : profile?.display_name || "Member"}
                avatarPath={profile?.avatar_url ?? null}
                weeklyGoalTarget={group.weekly_goal_target}
                groupId={group.id}
                isOwnerView={isOwner}
                onRemove={() => setRemoveTarget(m.user_id)}
              />
            );
          })}
        </div>
      </div>

      <InviteToGroupDialog open={inviteOpen} onOpenChange={setInviteOpen} groupId={group.id} existingMemberIds={memberIds} />

      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title={`Leave ${group.name}?`}
        description="You can rejoin later if you're invited again."
        confirmLabel="Leave"
        onConfirm={async () => {
          await leaveGroup.mutateAsync(group.id);
          push("You left the group", "info");
          navigate("/app/groups");
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${group.name}?`}
        description="This removes the group for everyone. This can't be undone."
        confirmLabel="Delete group"
        onConfirm={async () => {
          if (!groupId) return;
          await deleteGroupMutation.mutateAsync(groupId);
          push("Group deleted", "info");
          navigate("/app/groups");
        }}
      />
      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remove this member?"
        description="They can be invited again later."
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!removeTarget || !groupId) return;
          await removeMember.mutateAsync({ groupId, userId: removeTarget });
          push("Member removed", "info");
        }}
      />
    </div>
  );
}
