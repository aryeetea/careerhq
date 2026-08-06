import * as React from "react";
import { UserPlus, Users2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { FriendCard } from "@/components/friends/FriendCard";
import { SuggestedFriendsRow } from "@/components/friends/SuggestedFriendsRow";
import { AddFriendDialog } from "@/components/friends/AddFriendDialog";
import { useFriendCards, useFriendIds } from "@/hooks/queries/useFriends";
import { useProfile } from "@/hooks/queries/useProfile";
import { ENCOURAGING_EMPTY_MESSAGES } from "@/lib/constants";

// Friend requests (incoming and outgoing) live in the Invites tab, not
// here — this tab is just the people you're already connected with, plus
// the ways to find more of them (search, a Bloom Code, suggestions). One
// entry point for every friendship action lives inside AddFriendDialog —
// see its header comment.
export default function CommunityFriends() {
  const { data: profile } = useProfile();
  const { isLoading: idsLoading, isError: idsError } = useFriendIds();
  const { data: friends = [], isLoading: cardsLoading, isError: cardsError, refetch } = useFriendCards();
  const [addOpen, setAddOpen] = React.useState(false);

  const isLoading = idsLoading || cardsLoading;
  const isError = idsError || cardsError;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Your friends</h2>
          <p className="text-sm text-muted-foreground">The people cheering you on, and the ones you're cheering for.</p>
        </div>
        <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
          <UserPlus className="h-4 w-4" /> Add friend
        </Button>
      </div>

      {!profile?.sharing_enabled && (
        <div className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold-foreground">
          Social sharing is off. Turn it on in Settings → Privacy whenever you want friends to see your progress — nothing is
          shared automatically.
        </div>
      )}

      <SuggestedFriendsRow />

      {isError ? (
        <ErrorState description="Your friends list couldn't load. Try again." onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        </div>
      ) : friends.length === 0 ? (
        <EmptyState
          icon={<Users2 className="h-5 w-5" />}
          title="You haven't connected with anyone yet"
          description={ENCOURAGING_EMPTY_MESSAGES.noFriends}
          action={
            <Button onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4" /> Add friend
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {friends.map((f) => <FriendCard key={f.user_id} friend={f} />)}
        </div>
      )}

      <AddFriendDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
