import * as React from "react";
import { Check, Plus, UsersRound, X } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { GroupCard } from "@/components/groups/GroupCard";
import { CreateGroupDialog } from "@/components/groups/CreateGroupDialog";
import { useAcceptGroupInvite, useDeclineGroupInvite, useGroupInvites, useGroups } from "@/hooks/queries/useGroups";
import { useToast } from "@/components/shared/toast";
import { ENCOURAGING_EMPTY_MESSAGES } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";

export default function Groups() {
  const { data: groups = [], isLoading, isError, refetch } = useGroups();
  const { data: invites = [] } = useGroupInvites();
  const acceptInvite = useAcceptGroupInvite();
  const declineInvite = useDeclineGroupInvite();
  const { push } = useToast();
  const [createOpen, setCreateOpen] = React.useState(false);

  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        title="Groups"
        subtitle="Small, invite-only spaces to search alongside others"
        action={
          <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New group</span>
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto px-4 pb-10 sm:px-8">
        {invites.length > 0 && (
          <Card className="glass-subtle mb-4 border-border/60">
            <CardContent className="p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Group invitations</p>
              <div className="grid gap-1.5">
                {invites.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">You've been invited · {timeAgo(inv.created_at)}</span>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" onClick={async () => { await acceptInvite.mutateAsync(inv.id); push("Joined group", "success"); }}>
                        <Check className="h-3.5 w-3.5" /> Join
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => declineInvite.mutate(inv.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {isError ? (
          <ErrorState description="Your groups couldn't load. Try again." onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<UsersRound className="h-5 w-5" />}
            title="No groups yet"
            description={ENCOURAGING_EMPTY_MESSAGES.noGroups}
            action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Start a group</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => <GroupCard key={g.id} group={g} />)}
          </div>
        )}
      </div>
      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
