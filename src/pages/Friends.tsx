import * as React from "react";
import { Link2, UserPlus, Users2 } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { FriendCard } from "@/components/friends/FriendCard";
import { PendingInvitationsSection } from "@/components/friends/PendingInvitationsSection";
import { SuggestedFriendsRow } from "@/components/friends/SuggestedFriendsRow";
import { AddFriendDialog } from "@/components/friends/AddFriendDialog";
import { InviteByLinkDialog } from "@/components/friends/InviteByLinkDialog";
import { useFriendCards, useFriendIds } from "@/hooks/queries/useFriends";
import { useProfile } from "@/hooks/queries/useProfile";
import { ENCOURAGING_EMPTY_MESSAGES } from "@/lib/constants";

export default function Friends() {
  const { data: profile } = useProfile();
  const { isLoading: idsLoading, isError: idsError } = useFriendIds();
  const { data: friends = [], isLoading: cardsLoading, isError: cardsError, refetch } = useFriendCards();
  const [addOpen, setAddOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);

  const isLoading = idsLoading || cardsLoading;
  const isError = idsError || cardsError;

  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        title="Friends"
        subtitle="Encouragement, not competition."
        action={
          <div className="flex gap-2">
            <Button onClick={() => setInviteOpen(true)} variant="outline" size="sm" className="gap-1.5">
              <Link2 className="h-4 w-4" /> <span className="hidden sm:inline">Invite by Link</span>
            </Button>
            <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
              <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">Add Friend</span>
            </Button>
          </div>
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
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={() => setInviteOpen(true)}>
                  <Link2 className="h-4 w-4" /> Invite by Link
                </Button>
                <Button variant="outline" onClick={() => setAddOpen(true)}>
                  <UserPlus className="h-4 w-4" /> Search Bloom Users
                </Button>
              </div>
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
      <InviteByLinkDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
