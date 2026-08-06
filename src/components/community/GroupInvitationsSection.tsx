import * as React from "react";
import { Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useAcceptGroupInvite,
  useCancelGroupInvite,
  useDeclineGroupInvite,
  useGroupInvites,
  useGroupPreviews,
  useSentGroupInvites,
} from "@/hooks/queries/useGroups";
import { useVisibleBasicProfiles } from "@/hooks/queries/useProfile";
import { useToast } from "@/components/shared/toast";
import { timeAgo } from "@/lib/utils";

// The group-invite mirror of PendingInvitationsSection: incoming (someone
// invited you into their group) and outgoing (a group you've invited
// someone into, still waiting on them) side by side.
export function GroupInvitationsSection() {
  const { data: incoming = [] } = useGroupInvites();
  const { data: outgoing = [] } = useSentGroupInvites();
  const accept = useAcceptGroupInvite();
  const decline = useDeclineGroupInvite();
  const cancel = useCancelGroupInvite();
  const { push } = useToast();

  const groupIds = React.useMemo(
    () => [...incoming.map((i) => i.group_id), ...outgoing.map((i) => i.group_id)],
    [incoming, outgoing]
  );
  const peopleIds = React.useMemo(
    () => [...incoming.map((i) => i.inviter_id), ...outgoing.map((i) => i.invitee_id)],
    [incoming, outgoing]
  );
  const { data: groups } = useGroupPreviews(groupIds);
  const { data: people } = useVisibleBasicProfiles(peopleIds);

  const hasIncoming = incoming.length > 0;
  const hasOutgoing = outgoing.length > 0;
  if (!hasIncoming && !hasOutgoing) return null;

  return (
    <Card className="glass-subtle border-border/60">
      <CardContent className="grid gap-5 p-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Incoming</p>
          {!hasIncoming ? (
            <p className="py-4 text-sm text-muted-foreground">No group invitations waiting on you.</p>
          ) : (
            <div className="grid gap-1.5">
              {incoming.map((inv) => {
                const group = groups?.get(inv.group_id);
                const inviter = people?.get(inv.inviter_id);
                const groupName = group?.name ?? "a group";
                const inviterName = inviter?.display_name || inviter?.username;
                return (
                  <div key={inv.id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {inviterName ? `${inviterName} invited you to ` : "You're invited to "}
                      <span className="font-medium text-foreground">{groupName}</span> · {timeAgo(inv.created_at)}
                    </span>
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Join ${groupName}`}
                        onClick={async () => {
                          try {
                            await accept.mutateAsync(inv.id);
                            push(`You're in — welcome to ${groupName}.`, "success");
                          } catch (err) {
                            push(err instanceof Error ? err.message : "Couldn't join that group.", "error");
                          }
                        }}
                      >
                        <Check className="h-3.5 w-3.5" /> Join
                      </Button>
                      <Button size="sm" variant="ghost" aria-label={`Decline invitation to ${groupName}`} onClick={() => decline.mutate(inv.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outgoing</p>
          {!hasOutgoing ? (
            <p className="py-4 text-sm text-muted-foreground">Nothing waiting on someone else right now.</p>
          ) : (
            <div className="grid gap-1.5">
              {outgoing.map((inv) => {
                const group = groups?.get(inv.group_id);
                const invitee = people?.get(inv.invitee_id);
                const groupName = group?.name ?? "a group";
                const inviteeName = invitee?.display_name || invitee?.username || "Someone";
                return (
                  <div key={inv.id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {inviteeName} · <span className="font-medium text-foreground">{groupName}</span> · {timeAgo(inv.created_at)}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => cancel.mutate(inv.id)}>
                      Cancel
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
