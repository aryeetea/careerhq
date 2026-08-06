import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { PendingInvitationsSection } from "@/components/friends/PendingInvitationsSection";
import { GroupInvitationsSection } from "@/components/community/GroupInvitationsSection";
import { useIncomingRequests, useOutgoingRequests } from "@/hooks/queries/useFriends";
import { useGroupInvites, useSentGroupInvites } from "@/hooks/queries/useGroups";
import { ENCOURAGING_EMPTY_MESSAGES } from "@/lib/constants";

// One place for every invitation, in either direction, for either kind —
// so nobody has to remember whether a pending request lives under Friends
// or Groups. It never duplicates what Friends or Groups show; those tabs
// are only ever about people and groups you're already connected to.
export default function CommunityInvites() {
  const { data: incomingFriends = [] } = useIncomingRequests();
  const { data: outgoingFriends = [] } = useOutgoingRequests();
  const { data: incomingGroups = [] } = useGroupInvites();
  const { data: outgoingGroups = [] } = useSentGroupInvites();

  const hasFriendActivity = incomingFriends.length > 0 || outgoingFriends.length > 0;
  const hasGroupActivity = incomingGroups.length > 0 || outgoingGroups.length > 0;
  const nothingWaiting = !hasFriendActivity && !hasGroupActivity;

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Invitations</h2>
        <p className="text-sm text-muted-foreground">Every friend request and group invite, coming or going, lives here.</p>
      </div>

      {nothingWaiting ? (
        <EmptyState icon={<Inbox className="h-5 w-5" />} title="All caught up" description={ENCOURAGING_EMPTY_MESSAGES.noPendingInvites} />
      ) : (
        <>
          {hasFriendActivity && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Friend requests</p>
              <PendingInvitationsSection />
            </div>
          )}
          {hasGroupActivity && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Group invitations</p>
              <GroupInvitationsSection />
            </div>
          )}
        </>
      )}
    </div>
  );
}
