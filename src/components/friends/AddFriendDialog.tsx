import * as React from "react";
import { Search, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserSearch } from "@/hooks/queries/useFriends";
import { useSendFriendRequest, useOutgoingRequests, useFriendIds } from "@/hooks/queries/useFriends";
import { useSignedAvatarUrl } from "@/hooks/useSignedAvatarUrl";
import { useToast } from "@/components/shared/toast";
import { initials } from "@/lib/utils";

function SearchResultRow({ id, username, displayName, avatarUrl: avatarPath, alreadySent, alreadyFriend }: { id: string; username: string; displayName: string; avatarUrl: string | null; alreadySent: boolean; alreadyFriend: boolean }) {
  const sendRequest = useSendFriendRequest();
  const { push } = useToast();
  const signedUrl = useSignedAvatarUrl(avatarPath);
  const [sent, setSent] = React.useState(false);

  async function handleSend() {
    try {
      await sendRequest.mutateAsync(id);
      setSent(true);
      push("Friend request sent", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't send that request.", "error");
    }
  }

  const disabled = alreadySent || alreadyFriend || sent;

  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2">
      <Avatar className="h-9 w-9 border border-border">
        {signedUrl && <AvatarImage src={signedUrl} alt="" />}
        <AvatarFallback>{initials(displayName || username)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{displayName || username}</p>
        <p className="truncate text-xs text-muted-foreground">@{username}</p>
      </div>
      <Button size="sm" variant={disabled ? "outline" : "default"} disabled={disabled} onClick={handleSend}>
        {alreadyFriend ? "Friends" : disabled ? "Sent" : <><UserPlus className="h-3.5 w-3.5" /> Add</>}
      </Button>
    </div>
  );
}

export function AddFriendDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = React.useState("");
  const { data: results = [], isFetching } = useUserSearch(query);
  const { data: outgoing = [] } = useOutgoingRequests();
  const { data: friendIds = [] } = useFriendIds();
  const outgoingIds = new Set(outgoing.map((r) => r.recipient_id));
  const friendIdSet = new Set(friendIds);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Find a friend</DialogTitle>
          <DialogDescription>Search by the username they shared with you.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus placeholder="username" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
        </div>
        <div className="max-h-72 overflow-y-auto">
          {query.trim().length < 2 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Type at least 2 characters to search.</p>
          ) : isFetching ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No one found with that username.</p>
          ) : (
            <div className="grid gap-0.5">
              {results.map((r) => (
                <SearchResultRow
                  key={r.id}
                  id={r.id}
                  username={r.username}
                  displayName={r.display_name}
                  avatarUrl={r.avatar_url}
                  alreadySent={outgoingIds.has(r.id)}
                  alreadyFriend={friendIdSet.has(r.id)}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
