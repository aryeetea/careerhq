import * as React from "react";
import { Sparkles, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSuggestedFriends } from "@/hooks/queries/useFriendInvites";
import { useSendFriendRequest } from "@/hooks/queries/useFriends";
import { useSignedAvatarUrl } from "@/hooks/useSignedAvatarUrl";
import { useToast } from "@/components/shared/toast";
import { initials } from "@/lib/utils";
import type { SuggestedFriend } from "@/types/database";

function SuggestedFriendCard({ suggestion }: { suggestion: SuggestedFriend }) {
  const avatarUrl = useSignedAvatarUrl(suggestion.avatar_url);
  const sendRequest = useSendFriendRequest();
  const { push } = useToast();
  const [sent, setSent] = React.useState(false);

  return (
    <div className="flex w-40 shrink-0 flex-col items-center gap-2 rounded-2xl border border-border/70 bg-card/70 p-3.5 text-center">
      <Avatar className="h-12 w-12 border border-border">
        {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
        <AvatarFallback>{initials(suggestion.display_name || suggestion.username)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{suggestion.display_name || suggestion.username}</p>
        <p className="truncate text-xs text-muted-foreground">
          {suggestion.mutual_group_count} mutual group{suggestion.mutual_group_count === 1 ? "" : "s"}
        </p>
      </div>
      <Button
        size="sm"
        variant={sent ? "outline" : "default"}
        disabled={sent || sendRequest.isPending}
        onClick={async () => {
          await sendRequest.mutateAsync(suggestion.id);
          setSent(true);
          push("Friend request sent", "success");
        }}
      >
        {sent ? "Sent" : <><UserPlus className="h-3.5 w-3.5" /> Add</>}
      </Button>
    </div>
  );
}

export function SuggestedFriendsRow() {
  const { data: suggestions = [] } = useSuggestedFriends();
  if (suggestions.length === 0) return null;

  return (
    <Card className="glass-subtle border-border/60">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold" />
          <h3 className="text-sm font-semibold">Suggested friends</h3>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {suggestions.map((s) => (
            <SuggestedFriendCard key={s.id} suggestion={s} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
