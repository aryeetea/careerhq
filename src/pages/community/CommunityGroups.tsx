import * as React from "react";
import { Compass, Link2, Plus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { GroupCard } from "@/components/groups/GroupCard";
import { CreateGroupDialog } from "@/components/groups/CreateGroupDialog";
import { useGroups } from "@/hooks/queries/useGroups";
import { useToast } from "@/components/shared/toast";
import { ENCOURAGING_EMPTY_MESSAGES } from "@/lib/constants";

// Group invitations live in the Invites tab, not here — this tab is just
// the groups themselves: the ones you're in, starting a new one, and
// (soon) finding public ones. Managing a specific group — renaming it,
// inviting members, leaving, deleting — happens on that group's own page.
export default function CommunityGroups() {
  const { data: groups = [], isLoading, isError, refetch } = useGroups();
  const { push } = useToast();
  const [createOpen, setCreateOpen] = React.useState(false);

  async function shareBloomInvite() {
    const inviteUrl = `${window.location.origin}/signup`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Join me on Bloom",
          text: "Come join me on Bloom so we can keep each other encouraged.",
          url: inviteUrl,
        });
      } else {
        await navigator.clipboard.writeText(inviteUrl);
        push("Bloom invite link copied", "success");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      push("Couldn't share the invite link right now.", "error");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Your groups</h2>
          <p className="text-sm text-muted-foreground">Small, invite-only spaces to search alongside others.</p>
        </div>
        <div className="flex gap-1.5">
          <Button onClick={shareBloomInvite} size="sm" variant="outline" className="gap-1.5">
            <Link2 className="h-4 w-4" /> <span className="hidden sm:inline">Invite to Bloom</span>
          </Button>
          <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Create group</span>
          </Button>
        </div>
      </div>

      {isError ? (
        <ErrorState description="Your groups couldn't load. Try again." onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="h-5 w-5" />}
          title="You haven't started a group yet"
          description={ENCOURAGING_EMPTY_MESSAGES.noGroups}
          action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Create a group</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => <GroupCard key={g.id} group={g} />)}
        </div>
      )}

      <Card className="border-dashed border-border/70 bg-card/40">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Compass className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium">Discover groups</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Public group discovery is on the way. For now, groups stay invite-only — ask a friend to add you.
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            Coming soon
          </span>
        </CardContent>
      </Card>

      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
