import * as React from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ReactionPicker } from "@/components/friends/ReactionPicker";
import { useSignedAvatarUrl } from "@/hooks/useSignedAvatarUrl";
import { useSharedContextProfiles } from "@/hooks/queries/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useDeleteGoal, useJoinGoal, useUpdateGoalProgress } from "@/hooks/queries/useGoals";
import { useToast } from "@/components/shared/toast";
import { formatDate, initials } from "@/lib/utils";
import type { GoalWithMembers } from "@/services/goals";

function MemberRow({ userId, displayName, avatarPath, progress, target, unit, isSelf, goalId, ownerId }: {
  userId: string; displayName: string; avatarPath: string | null; progress: number; target: number; unit: string; isSelf: boolean; goalId: string; ownerId: string;
}) {
  const avatarUrl = useSignedAvatarUrl(avatarPath);
  const updateProgress = useUpdateGoalProgress();
  const pct = target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0;

  return (
    <div className="flex items-center gap-2.5">
      <Avatar className="h-7 w-7 border border-border">
        {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
        <AvatarFallback className="text-[10px]">{initials(displayName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between text-xs">
          <span className="truncate font-medium">{displayName}</span>
          <span className="text-muted-foreground">{progress}/{target} {unit}</span>
        </div>
        <Progress value={pct} className="mt-1 h-1.5" />
      </div>
      {isSelf ? (
        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => updateProgress.mutate({ goalId, progressCount: progress + 1 })}>
          <Plus className="h-3 w-3" />
        </Button>
      ) : (
        userId !== ownerId && <ReactionPicker recipientId={userId} contextType="goal" contextId={goalId} />
      )}
    </div>
  );
}

export function GoalCard({ goal }: { goal: GoalWithMembers }) {
  const { user } = useAuth();
  const joinGoal = useJoinGoal();
  const deleteGoal = useDeleteGoal();
  const { push } = useToast();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const memberIds = goal.goal_members.map((m) => m.user_id);
  const { data: profileMap } = useSharedContextProfiles(memberIds);
  const isMember = goal.goal_members.some((m) => m.user_id === user?.id);
  const isOwner = goal.owner_id === user?.id;

  return (
    <Card className="hover-lift">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{goal.name}</p>
            {goal.description && <p className="mt-0.5 text-xs text-muted-foreground">{goal.description}</p>}
          </div>
          {isOwner && (
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {goal.deadline && <span>Due {formatDate(goal.deadline)}</span>}
          {goal.is_shared && (
            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Shared</span>
          )}
        </div>

        <div className="mt-3 grid gap-2.5">
          {goal.goal_members.map((m) => {
            const profile = profileMap?.get(m.user_id);
            return (
              <MemberRow
                key={m.id}
                userId={m.user_id}
                displayName={profile?.display_name || (m.user_id === user?.id ? "You" : "Friend")}
                avatarPath={profile?.avatar_url ?? null}
                progress={m.progress_count}
                target={goal.target_count}
                unit={goal.unit}
                isSelf={m.user_id === user?.id}
                goalId={goal.id}
                ownerId={goal.owner_id}
              />
            );
          })}
        </div>

        {!isMember && goal.is_shared && (
          <Button
            size="sm"
            className="mt-3 w-full"
            onClick={async () => {
              await joinGoal.mutateAsync(goal.id);
              push("Joined goal", "success");
            }}
          >
            Join this goal
          </Button>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete "${goal.name}"?`}
        description="This removes it for everyone who joined. This can't be undone."
        confirmLabel="Delete goal"
        onConfirm={async () => {
          await deleteGoal.mutateAsync(goal.id);
          push("Goal deleted", "info");
        }}
      />
    </Card>
  );
}
