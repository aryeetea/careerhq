import { Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useAcceptFriendRequest,
  useCancelFriendRequest,
  useDeclineFriendRequest,
  useIncomingRequests,
  useOutgoingRequests,
} from "@/hooks/queries/useFriends";
import { useToast } from "@/components/shared/toast";
import { timeAgo } from "@/lib/utils";

export function FriendRequestsPanel() {
  const { data: incoming = [] } = useIncomingRequests();
  const { data: outgoing = [] } = useOutgoingRequests();
  const accept = useAcceptFriendRequest();
  const decline = useDeclineFriendRequest();
  const cancel = useCancelFriendRequest();
  const { push } = useToast();

  if (incoming.length === 0 && outgoing.length === 0) return null;

  return (
    <Card className="glass-subtle border-border/60">
      <CardContent className="p-4">
        {incoming.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Friend requests</p>
            <div className="grid gap-1.5">
              {incoming.map((req) => (
                <div key={req.id} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Someone wants to connect · {timeAgo(req.created_at)}</span>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await accept.mutateAsync(req.id);
                        push("You're now friends", "success");
                      }}
                    >
                      <Check className="h-3.5 w-3.5" /> Accept
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => decline.mutate(req.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {outgoing.length > 0 && (
          <div className={incoming.length > 0 ? "mt-4" : ""}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sent, waiting</p>
            <div className="grid gap-1.5">
              {outgoing.map((req) => (
                <div key={req.id} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Pending · {timeAgo(req.created_at)}</span>
                  <Button size="sm" variant="ghost" onClick={() => cancel.mutate(req.id)}>Cancel</Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
