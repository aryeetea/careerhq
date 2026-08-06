import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Copy,
  KeyRound,
  LoaderCircle,
  Mail,
  MessageSquareText,
  RefreshCw,
  ScanLine,
  Search,
  Send,
  Share2,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { PersonLink } from "@/components/people/PersonLink";
import { useUserSearch, useSendFriendRequest, useOutgoingRequests, useFriendIds } from "@/hooks/queries/useFriends";
import { useValidateFriendCode, useSendFriendRequestByCode, useCreateFriendCode, useMyFriendCodes, useRegenerateFriendCode } from "@/hooks/queries/useFriendCode";
import { useProfile } from "@/hooks/queries/useProfile";
import { useSignedAvatarUrl } from "@/hooks/useSignedAvatarUrl";
import { useToast } from "@/components/shared/toast";
import { initials } from "@/lib/utils";
import type { FriendCodePreview } from "@/types/database";

// A single entry point for every friendship action. Rather than scattering
// "Add Friend" / "Enter Friend Code" / "My Friend Code" as separate,
// near-identical header buttons, this dialog offers one obvious place to
// start, then narrows to exactly the one flow the user picked —
// progressive disclosure instead of upfront choice overload.
type Mode = "menu" | "search" | "code" | "invite";

const HEADERS: Record<Mode, { title: string; description: string }> = {
  menu: { title: "Add a friend", description: "Choose how you'd like to connect." },
  search: { title: "Search Bloom users", description: "Find someone already using Bloom." },
  code: { title: "Enter a friend code", description: "Have a code from a friend? Enter it below." },
  invite: { title: "Invite someone", description: "Share your Bloom Code so someone can send you a friend request." },
};

export function AddFriendDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [mode, setMode] = React.useState<Mode>("menu");

  React.useEffect(() => {
    if (!open) setMode("menu");
  }, [open]);

  const header = HEADERS[mode];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1rem)] max-w-[40rem] gap-3 overflow-y-auto rounded-[1.75rem] px-4 py-5 sm:w-[calc(100%-2rem)] sm:gap-4 sm:px-6 sm:py-6">
        <DialogHeader>
          <div className="flex items-center gap-1.5">
            {mode !== "menu" && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="-ml-2 h-7 w-7 shrink-0"
                aria-label="Back"
                onClick={() => setMode("menu")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>{header.title}</DialogTitle>
          </div>
          <DialogDescription>{header.description}</DialogDescription>
        </DialogHeader>

        {mode === "menu" && <ModeMenu onSelect={setMode} />}
        {mode === "search" && <SearchUsersView />}
        {mode === "code" && <EnterCodeView onDone={() => onOpenChange(false)} />}
        {mode === "invite" && <InviteSomeoneView />}
      </DialogContent>
    </Dialog>
  );
}

function ModeMenu({ onSelect }: { onSelect: (mode: Mode) => void }) {
  return (
    <div className="grid gap-2.5 sm:gap-3">
      <OptionRow
        icon={<Search className="h-4.5 w-4.5" />}
        title="Search Bloom users"
        description="Find someone already using Bloom."
        onClick={() => onSelect("search")}
      />
      <OptionRow
        icon={<ScanLine className="h-4.5 w-4.5" />}
        title="Enter a friend code"
        description="Have a code from a friend? Enter it here."
        onClick={() => onSelect("code")}
      />
      <OptionRow
        icon={<KeyRound className="h-4.5 w-4.5" />}
        title="Invite someone"
        description="Share your Bloom Code so someone can send you a friend request."
        onClick={() => onSelect("invite")}
      />
    </div>
  );
}

function OptionRow({ icon, title, description, onClick }: { icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-2xl border border-border/70 bg-card/70 px-4 py-3.5 text-left transition-colors hover:border-primary/40 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:items-center sm:px-5 sm:py-4"
    >
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground sm:mt-0 sm:h-11 sm:w-11">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-5 sm:text-base">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground sm:text-sm">{description}</span>
      </span>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground sm:mt-0" />
    </button>
  );
}

// ---------------------------------------------------------------------
// Search Bloom users
// ---------------------------------------------------------------------

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
      <PersonLink userId={id} className="shrink-0">
        <Avatar className="h-9 w-9 border border-border">
          {signedUrl && <AvatarImage src={signedUrl} alt="" />}
          <AvatarFallback>{initials(displayName || username)}</AvatarFallback>
        </Avatar>
      </PersonLink>
      <PersonLink userId={id} className="min-w-0 flex-1">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium transition-colors hover:text-primary">{displayName || username}</p>
          <p className="truncate text-xs text-muted-foreground">@{username}</p>
        </div>
      </PersonLink>
      <Button size="sm" variant={disabled ? "outline" : "default"} disabled={disabled} onClick={handleSend}>
        {alreadyFriend ? "Friends" : disabled ? "Sent" : <><UserPlus className="h-3.5 w-3.5" /> Add</>}
      </Button>
    </div>
  );
}

function SearchUsersView() {
  const [query, setQuery] = React.useState("");
  const { data: results = [], isFetching } = useUserSearch(query);
  const { data: outgoing = [] } = useOutgoingRequests();
  const { data: friendIds = [] } = useFriendIds();
  const outgoingIds = new Set(outgoing.map((r) => r.recipient_id));
  const friendIdSet = new Set(friendIds);

  return (
    <div className="grid gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input autoFocus placeholder="username" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
      </div>
      <div className="max-h-[min(52vh,22rem)] overflow-y-auto">
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
    </div>
  );
}

// ---------------------------------------------------------------------
// Enter a friend code
// ---------------------------------------------------------------------

function formatCodeInput(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/^BLOOM-?/, "")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function CodeConfirmationView({
  preview,
  onSend,
  onCancel,
  sending,
}: {
  preview: FriendCodePreview;
  onSend: () => void;
  onCancel: () => void;
  sending: boolean;
}) {
  const avatarUrl = useSignedAvatarUrl(preview.avatar_url);
  const name = preview.display_name || preview.username;

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <Avatar className="h-14 w-14 border border-border">
          {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
          <AvatarFallback className="text-lg">{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold">{name}</p>
          <p className="truncate text-sm text-muted-foreground">@{preview.username}</p>
        </div>
      </div>

      {preview.bio && <p className="text-sm leading-6 text-foreground/82">{preview.bio}</p>}
      {preview.career_goal && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground/80">Working toward: </span>
          {preview.career_goal}
        </p>
      )}
      {preview.mutual_groups.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {preview.mutual_groups.map((name) => (
            <span key={name} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
              {name}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="flex-1" onClick={onSend} disabled={sending}>
          {sending ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" /> Sending…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" /> Send Friend Request
            </>
          )}
        </Button>
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={sending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function EnterCodeView({ onDone }: { onDone: () => void }) {
  const [input, setInput] = React.useState("");
  const [preview, setPreview] = React.useState<FriendCodePreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const validateCode = useValidateFriendCode();
  const sendFriendRequestByCode = useSendFriendRequestByCode();
  const { push } = useToast();

  async function handleContinue() {
    if (input.length < 6) return;
    setError(null);
    try {
      const result = await validateCode.mutateAsync(input);
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't check that code right now.");
    }
  }

  async function handleSend() {
    try {
      await sendFriendRequestByCode.mutateAsync(input);
      push("Friend request sent", "success");
      onDone();
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't send that request right now.", "error");
    }
  }

  if (preview) {
    return <CodeConfirmationView preview={preview} onSend={handleSend} onCancel={() => setPreview(null)} sending={sendFriendRequestByCode.isPending} />;
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="friend-code-input">Friend code</Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="text-sm font-medium text-muted-foreground">BLOOM-</span>
          <Input
            id="friend-code-input"
            value={input}
            onChange={(e) => setInput(formatCodeInput(e.target.value))}
            onKeyDown={(e) => e.key === "Enter" && handleContinue()}
            placeholder="A7K4P9"
            autoFocus
            className="font-mono tracking-widest"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "friend-code-error" : "friend-code-hint"}
          />
        </div>
        <p id="friend-code-hint" className="text-xs text-muted-foreground">
          Six characters, e.g. BLOOM-A7K4P9. Case doesn&apos;t matter.
        </p>
        {error && (
          <p id="friend-code-error" role="alert" className="text-xs font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
      <Button onClick={handleContinue} disabled={input.length < 6 || validateCode.isPending} size="lg">
        {validateCode.isPending ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" /> Checking…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" /> Continue
          </>
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------
// Invite someone (generate + share a friend code)
// ---------------------------------------------------------------------

function displayCode(code: string): string {
  return `BLOOM-${code}`;
}

function codeMessage(inviterName: string, code: string): string {
  return `${inviterName} invited you to Bloom 🌸\n\nCreate an account, open Community, and enter this code:\n${displayCode(code)}\n\nBloom helps us organize our job searches and encourage each other without sharing private application details.`;
}

function InviteSomeoneView() {
  const { data: profile } = useProfile();
  const { data: codes = [], isLoading } = useMyFriendCodes();
  const createCode = useCreateFriendCode();
  const regenerateCode = useRegenerateFriendCode();
  const { push } = useToast();
  const [copied, setCopied] = React.useState(false);
  const [plaintext, setPlaintext] = React.useState<string | null>(null);
  const createdRef = React.useRef(false);

  const currentCode = codes[0] ?? null;
  const inviterName = profile?.display_name || "A friend";

  React.useEffect(() => {
    if (isLoading || createdRef.current) return;
    if (!currentCode) {
      createdRef.current = true;
      createCode.mutate(undefined, { onSuccess: (result) => setPlaintext(result.code) });
      return;
    }
    if (currentCode.code_plaintext) {
      setPlaintext(currentCode.code_plaintext);
      return;
    }
    createdRef.current = true;
    regenerateCode.mutate(currentCode.id, { onSuccess: (result) => setPlaintext(result.code) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCode, isLoading]);

  const visibleCode = plaintext ? displayCode(plaintext) : null;

  async function handleCopy() {
    if (!visibleCode) {
      return;
    }
    try {
      await navigator.clipboard.writeText(visibleCode);
      setCopied(true);
      push("Friend code copied.", "success");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      push("Couldn't copy — try selecting and copying it manually.", "error");
    }
  }

  async function handleShare() {
    if (!visibleCode || !plaintext) return;
    const text = codeMessage(inviterName, plaintext);
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // Cancelled share sheet — not an error worth surfacing.
      }
    } else {
      await handleCopy();
    }
  }

  function handleText() {
    if (!plaintext) return;
    window.location.href = `sms:?&body=${encodeURIComponent(codeMessage(inviterName, plaintext))}`;
  }

  function handleMail() {
    if (!plaintext) return;
    const subject = encodeURIComponent(`${inviterName} invited you to Bloom`);
    const body = encodeURIComponent(codeMessage(inviterName, plaintext));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  async function handleRegenerate() {
    try {
      const result = currentCode ? await regenerateCode.mutateAsync(currentCode.id) : await createCode.mutateAsync();
      setPlaintext(result.code);
      push("A fresh friend code is ready.", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't create a new code.", "error");
    }
  }

  const busy = createCode.isPending || regenerateCode.isPending;
  const canShare = Boolean(visibleCode);

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label>Your Bloom Code</Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex h-11 min-w-0 flex-1 items-center rounded-2xl border border-input/90 bg-card/95 px-3.5 font-mono text-sm tracking-[0.18em] shadow-soft sm:text-base sm:tracking-wide">
            {isLoading || !visibleCode ? "Generating your code…" : visibleCode}
          </div>
          <Button type="button" variant="outline" size="icon" onClick={handleCopy} disabled={!visibleCode} aria-label="Copy friend code" className="self-start sm:self-auto">
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          This code stays active until you regenerate it. Anyone with it can only send you a friend request.
        </p>

        <div className="mt-1 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <Button type="button" size="sm" onClick={handleShare} disabled={!canShare} className="w-full sm:w-auto">
            <Share2 className="h-3.5 w-3.5" /> Share
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleText} disabled={!canShare} className="w-full sm:w-auto">
            <MessageSquareText className="h-3.5 w-3.5" /> Text
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleMail} disabled={!canShare} className="w-full sm:w-auto">
            <Mail className="h-3.5 w-3.5" /> Email
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleRegenerate} disabled={busy} className="w-full sm:w-auto">
            <RefreshCw className="h-3.5 w-3.5" /> Regenerate code
          </Button>
        </div>
      </div>

      <AuthNotice variant="info">
        Sharing your Bloom Code does not create a friendship automatically. It only lets someone send you a friend request,
        which you can accept or ignore.
      </AuthNotice>
    </div>
  );
}
