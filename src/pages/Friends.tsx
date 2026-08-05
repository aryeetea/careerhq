import * as React from "react";
import { UserPlus, Users2 } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { FriendCard } from "@/components/friends/FriendCard";
import { PendingInvitationsSection } from "@/components/friends/PendingInvitationsSection";
import { SuggestedFriendsRow } from "@/components/friends/SuggestedFriendsRow";
import { AddFriendDialog } from "@/components/friends/AddFriendDialog";
import { useFriendCards, useFriendIds } from "@/hooks/queries/useFriends";
import { useProfile } from "@/hooks/queries/useProfile";
import { ENCOURAGING_EMPTY_MESSAGES } from "@/lib/constants";

// One entry point for every friendship action (search, code entry, invite)
// lives inside AddFriendDialog — see its header comment. The page itself
// only ever needs to open it.
export default function Friends() {
  const { data: profile } = useProfile();
  const { isLoading: idsLoading, isError: idsError } = useFriendIds();
  const { data: friends = [], isLoading: cardsLoading, isError: cardsError, refetch } = useFriendCards();
  const [addOpen, setAddOpen] = React.useState(false);

  const isLoading = idsLoading || cardsLoading;
  const isError = idsError || cardsError;

  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        title="Friends"
        subtitle="Cheer each other on."
        action={
          <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
            <UserPlus className="h-4 w-4" /> Add Friend
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto px-4 pb-10 sm:px-8">
        {!profile?.sharing_enabled && (
          <div className="mb-4 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold-foreground">
            Social sharing is off. Turn it on in Settings → Privacy whenever you want friends to see your progress — nothing is
            shared automatically.
          </div>
        )}

        <div className="mb-4">
          <SuggestedFriendsRow />
        </div>

        {isError ? (
          <ErrorState description="Your friends list couldn't load. Try again." onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
          </div>
        ) : friends.length === 0 ? (
          <EmptyState
            icon={<Users2 className="h-5 w-5" />}
            title="No friends yet"
            description={ENCOURAGING_EMPTY_MESSAGES.noFriends}
            action={
              <Button onClick={() => setAddOpen(true)}>
                <UserPlus className="h-4 w-4" /> Add Friend
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {friends.map((f) => <FriendCard key={f.user_id} friend={f} />)}
          </div>
        )}

        <div className="mt-4">
          <PendingInvitationsSection />
        </div>
      </div>
      <AddFriendDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
