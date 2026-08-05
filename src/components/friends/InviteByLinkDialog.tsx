import * as React from "react";
import { Check, Copy, Mail, RefreshCw, Share2, ShieldOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { useProfile } from "@/hooks/queries/useProfile";
import {
  useCreateFriendInviteLink,
  useDisableFriendInviteLink,
  useMyFriendInviteLinks,
  useRegenerateFriendInviteLink,
} from "@/hooks/queries/useFriendInvites";
import { useToast } from "@/components/shared/toast";
import type { FriendInviteLinkSettings } from "@/services/friendInvites";

type ExpirationOption = "24h" | "7d" | "30d" | "never";
type MaxUsesOption = "1" | "5" | "10" | "unlimited";

const EXPIRATION_MS: Record<Exclude<ExpirationOption, "never">, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

function toSettings(expiration: ExpirationOption, maxUses: MaxUsesOption): FriendInviteLinkSettings {
  return {
    expiresAt: expiration === "never" ? null : new Date(Date.now() + EXPIRATION_MS[expiration]).toISOString(),
    maxUses: maxUses === "unlimited" ? null : Number(maxUses),
  };
}

function inviteMessage(inviterName: string, link: string): string {
  return `🌸 ${inviterName} invited you to Bloom.\n\nBloom is a calm space to organize your job search, receive AI career coaching, and stay accountable together.\n\nJoin me:\n${link}`;
}

export function InviteByLinkDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: profile } = useProfile();
  const { data: links = [], isLoading } = useMyFriendInviteLinks();
  const createLink = useCreateFriendInviteLink();
  const disableLink = useDisableFriendInviteLink();
  const regenerateLink = useRegenerateFriendInviteLink();
  const { push } = useToast();

  const [expiration, setExpiration] = React.useState<ExpirationOption>("7d");
  const [maxUses, setMaxUses] = React.useState<MaxUsesOption>("1");
  const [copied, setCopied] = React.useState(false);
  const createdRef = React.useRef(false);

  const currentLink = links[0] ?? null;
  const inviterName = profile?.display_name || "A friend";

  // Auto-generate a link the first time the dialog opens if the user
  // doesn't already have an active one — the spec shows the link as
  // already present when the modal opens, not behind a separate step.
  React.useEffect(() => {
    if (!open || isLoading || createdRef.current) return;
    if (links.length === 0) {
      createdRef.current = true;
      createLink.mutate(toSettings(expiration, maxUses));
    }
  }, [open, isLoading, links.length, createLink, expiration, maxUses]);

  React.useEffect(() => {
    if (!open) {
      createdRef.current = false;
      setCopied(false);
    }
  }, [open]);

  const inviteUrl = currentLink ? `${window.location.origin}/join/friend/${currentLink.token}` : "";
  const usesRemaining =
    currentLink?.max_uses == null ? "Unlimited uses" : `${Math.max(0, currentLink.max_uses - currentLink.use_count)} use${currentLink.max_uses - currentLink.use_count === 1 ? "" : "s"} left`;

  async function handleCopy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      push("Invite link copied.", "success");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      push("Couldn't copy the link — try selecting and copying it manually.", "error");
    }
  }

  async function handleShare() {
    if (!inviteUrl) return;
    const text = inviteMessage(inviterName, inviteUrl);
    if (navigator.share) {
      try {
        await navigator.share({ text, url: inviteUrl });
      } catch {
        // User cancelled the share sheet — not an error worth surfacing.
      }
    } else {
      await handleCopy();
    }
  }

  function handleMail() {
    if (!inviteUrl) return;
    const subject = encodeURIComponent(`${inviterName} invited you to Bloom`);
    const body = encodeURIComponent(inviteMessage(inviterName, inviteUrl));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  async function handleRegenerate() {
    try {
      if (currentLink) {
        await regenerateLink.mutateAsync({ id: currentLink.id, settings: toSettings(expiration, maxUses) });
      } else {
        await createLink.mutateAsync(toSettings(expiration, maxUses));
      }
      push("A fresh invite link is ready.", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't create a new link.", "error");
    }
  }

  async function handleDisable() {
    if (!currentLink) return;
    try {
      await disableLink.mutateAsync(currentLink.id);
      push("Invite link disabled.", "info");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't disable that link.", "error");
    }
  }

  const busy = createLink.isPending || regenerateLink.isPending || disableLink.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite someone to Bloom</DialogTitle>
          <DialogDescription>Help a friend organize their career search and grow alongside you.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="invite-link">Invite link</Label>
            <div className="flex gap-2">
              <Input id="invite-link" readOnly value={isLoading || !inviteUrl ? "Generating your link…" : inviteUrl} className="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={handleCopy} disabled={!inviteUrl} aria-label="Copy invite link">
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            {currentLink && (
              <p className="text-xs text-muted-foreground">
                {currentLink.is_active ? usesRemaining : "This link is disabled."}
                {currentLink.expires_at ? ` · Expires ${new Date(currentLink.expires_at).toLocaleDateString()}` : " · Never expires"}
              </p>
            )}

            <div className="mt-1 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={handleShare} disabled={!inviteUrl}>
                <Share2 className="h-3.5 w-3.5" /> Share
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleMail} disabled={!inviteUrl}>
                <Mail className="h-3.5 w-3.5" /> Mail
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleRegenerate} disabled={busy}>
                <RefreshCw className="h-3.5 w-3.5" /> Regenerate
              </Button>
              {currentLink?.is_active && (
                <Button type="button" variant="ghost" size="sm" onClick={handleDisable} disabled={busy} className="text-destructive hover:bg-destructive/10">
                  <ShieldOff className="h-3.5 w-3.5" /> Disable link
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Expiration</Label>
              <Select value={expiration} onValueChange={(v) => setExpiration(v as ExpirationOption)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">24 hours</SelectItem>
                  <SelectItem value="7d">7 days</SelectItem>
                  <SelectItem value="30d">30 days</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Maximum uses</Label>
              <Select value={maxUses} onValueChange={(v) => setMaxUses(v as MaxUsesOption)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="unlimited">Unlimited</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            Changing these applies the next time you tap Regenerate.
          </p>

          <AuthNotice variant="info">
            Sharing this link will not automatically make someone your friend. They&apos;ll still need to accept your
            invitation, and neither of you can see each other&apos;s progress until they do.
          </AuthNotice>
        </div>
      </DialogContent>
    </Dialog>
  );
}
