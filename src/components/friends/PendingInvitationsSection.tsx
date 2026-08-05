import * as React from "react";
import { Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  useAcceptFriendRequest,
  useCancelFriendRequest,
  useDeclineFriendRequest,
  useIncomingRequests,
  useOutgoingRequests,
} from "@/hooks/queries/useFriends";
import { useVisibleBasicProfiles } from "@/hooks/queries/useProfile";
import { useSignedAvatarUrl } from "@/hooks/useSignedAvatarUrl";
import { useToast } from "@/components/shared/toast";
import { useCelebration } from "@/components/ambient/Celebration";
import { initials, timeAgo } from "@/lib/utils";

// Outgoing/Incoming both reflect friend_requests regardless of how the
// request originated (direct username search or a friend code) — nothing
// distinguishes their origin in the schema, which is correct: once a
// request exists, it doesn't matter how it was created.
export function PendingInvitationsSection() {
  const { data: incoming = [] } = useIncomingRequests();
  const { data: outgoing = [] } = useOutgoingRequests();
  const accept = useAcceptFriendRequest();
  const decline = useDeclineFriendRequest();
  const cancel = useCancelFriendRequest();
  const { push } = useToast();
  const { celebrate } = useCelebration();

  const profileIds = React.useMemo(
    () => [...incoming.map((r) => r.requester_id), ...outgoing.map((r) => r.recipient_id)],
    [incoming, outgoing]
  );
  const { data: profiles } = useVisibleBasicProfiles(profileIds);

  const hasOutgoing = outgoing.length > 0;
  const hasIncoming = incoming.length > 0;
  if (!hasOutgoing && !hasIncoming) return null;

  return (
    <Card className="glass-subtle border-border/60">
      <CardContent className="grid gap-5 p-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outgoing</p>
          {!hasOutgoing ? (
            <p className="py-4 text-sm text-muted-foreground">Nothing waiting on someone else right now.</p>
          ) : (
            <div className="grid gap-1.5">
              {outgoing.map((req) => {
                const p = profiles?.get(req.recipient_id);
                return (
                  <div key={req.id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {p?.display_name || p?.username || "Pending request"} · {timeAgo(req.created_at)}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => cancel.mutate(req.id)}>
                      Cancel
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Incoming</p>
          {!hasIncoming ? (
            <p className="py-4 text-sm text-muted-foreground">No invitations waiting on you.</p>
          ) : (
            <div className="grid gap-1.5">
              {incoming.map((req) => {
                const p = profiles?.get(req.requester_id);
                const avatarUrl = p?.avatar_url ?? null;
                return (
                  <IncomingRow
                    key={req.id}
                    requestId={req.id}
                    name={p?.display_name || p?.username || "Someone"}
                    avatarPath={avatarUrl}
                    onAccept={accept}
                    onDecline={decline}
                    push={push}
                    celebrate={celebrate}
                  />
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function IncomingRow({
  requestId,
  name,
  avatarPath,
  onAccept,
  onDecline,
  push,
  celebrate,
}: {
  requestId: string;
  name: string;
  avatarPath: string | null;
  onAccept: ReturnType<typeof useAcceptFriendRequest>;
  onDecline: ReturnType<typeof useDeclineFriendRequest>;
  push: ReturnType<typeof useToast>["push"];
  celebrate: (message?: string) => void;
}) {
  const avatarUrl = useSignedAvatarUrl(avatarPath);
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-secondary/50 px-3 py-2 text-sm">
      <Avatar className="h-7 w-7 shrink-0 border border-border">
        {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
        <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate">{name} wants to connect</span>
      <div className="flex shrink-0 gap-1">
        <Button
          size="sm"
          variant="outline"
          aria-label={`Accept ${name}'s friend request`}
          disabled={onAccept.isPending}
          onClick={async () => {
            try {
              await onAccept.mutateAsync(requestId);
              // A toast alone was easy to miss and left the accept feeling
              // like a dead end — this is a genuinely exciting moment, so
              // it gets the same visible celebration as an offer or a
              // completed weekly goal, not just a line of text that fades.
              celebrate(`You and ${name} are now friends 🌸`);
            } catch (err) {
              push(err instanceof Error ? err.message : "Couldn't accept that request.", "error");
            }
          }}
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" aria-label={`Decline ${name}'s friend request`} onClick={() => onDecline.mutate(requestId)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
