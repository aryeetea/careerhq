import * as React from "react";
import { Check, Link2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useFriendCards } from "@/hooks/queries/useFriends";
import { useCreateGroupJoinLink, useInviteToGroup } from "@/hooks/queries/useGroups";
import { useSignedAvatarUrl } from "@/hooks/useSignedAvatarUrl";
import { useToast } from "@/components/shared/toast";
import { initials } from "@/lib/utils";

function FriendRow({ id, name, avatarPath, groupId, disabled }: { id: string; name: string; avatarPath: string | null; groupId: string; disabled: boolean }) {
  const invite = useInviteToGroup();
  const avatarUrl = useSignedAvatarUrl(avatarPath);
  const { push } = useToast();

  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2">
      <Avatar className="h-8 w-8 border border-border">
        {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
        <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
      </Avatar>
      <span className="flex-1 truncate text-sm">{name}</span>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || invite.isPending}
        onClick={async () => {
          await invite.mutateAsync({ groupId, inviteeId: id });
          push("Invite sent", "success");
        }}
      >
        {disabled ? "Invited" : <><UserPlus className="h-3.5 w-3.5" /> Invite</>}
      </Button>
    </div>
  );
}

export function InviteToGroupDialog({ open, onOpenChange, groupId, existingMemberIds }: { open: boolean; onOpenChange: (open: boolean) => void; groupId: string; existingMemberIds: string[] }) {
  const { data: friends = [] } = useFriendCards();
  const createJoinLink = useCreateGroupJoinLink();
  const { push } = useToast();
  const [copied, setCopied] = React.useState(false);
  const memberSet = new Set(existingMemberIds);

  async function handleCopyJoinLink() {
    try {
      const link = await createJoinLink.mutateAsync(groupId);
      const inviteUrl = `${window.location.origin}/join/group/${link.token}`;
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      push("Group invite link copied", "success");
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      push(error instanceof Error ? error.message : "Couldn't create a group invite link right now.", "error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite to this group</DialogTitle>
          <DialogDescription>Invite an existing friend, or share a join link with someone new to Bloom.</DialogDescription>
        </DialogHeader>

        <Button type="button" variant="outline" size="sm" className="w-full gap-1.5" onClick={handleCopyJoinLink} disabled={createJoinLink.isPending}>
          {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Link2 className="h-3.5 w-3.5" />}
          {createJoinLink.isPending ? "Making link…" : copied ? "Link copied" : "Copy join link"}
        </Button>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or invite a friend directly <div className="h-px flex-1 bg-border" />
        </div>

        <div className="max-h-72 overflow-y-auto">
          {friends.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Add some friends first, then invite them here.</p>
          ) : (
            <div className="grid gap-0.5">
              {friends.map((f) => (
                <FriendRow key={f.user_id} id={f.user_id} name={f.display_name || f.username} avatarPath={f.avatar_url} groupId={groupId} disabled={memberSet.has(f.user_id)} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
