import { UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useFriendCards } from "@/hooks/queries/useFriends";
import { useInviteToGroup } from "@/hooks/queries/useGroups";
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
  const memberSet = new Set(existingMemberIds);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite friends</DialogTitle>
          <DialogDescription>Only people you're already friends with can be invited to a group.</DialogDescription>
        </DialogHeader>
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
