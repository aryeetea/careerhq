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
  Settings2,
  Share2,
  ShieldOff,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { useUserSearch, useSendFriendRequest, useOutgoingRequests, useFriendIds } from "@/hooks/queries/useFriends";
import { useValidateFriendCode, useSpendFriendCode, useCreateFriendCode, useMyFriendCodes, useRegenerateFriendCode, useRevokeFriendCode } from "@/hooks/queries/useFriendCode";
import { useProfile } from "@/hooks/queries/useProfile";
import { useSignedAvatarUrl } from "@/hooks/useSignedAvatarUrl";
import { useToast } from "@/components/shared/toast";
import { initials } from "@/lib/utils";
import type { FriendCodeExpiration, FriendCodeMaxUses, FriendCodePreview } from "@/types/database";

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
  invite: { title: "Invite someone", description: "Share a code with someone who isn't on Bloom yet." },
};

export function AddFriendDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [mode, setMode] = React.useState<Mode>("menu");

  React.useEffect(() => {
    if (!open) setMode("menu");
  }, [open]);

  const header = HEADERS[mode];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
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
    <div className="grid gap-2">
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
        description="Generate a code to share with someone who isn't connected yet."
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
      className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card/70 px-4 py-3.5 text-left transition-colors hover:border-primary/40 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{description}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
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
  const spendCode = useSpendFriendCode();
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
      await spendCode.mutateAsync(input);
      push("Friend request sent", "success");
      onDone();
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't send that request right now.", "error");
    }
  }

  if (preview) {
    return <CodeConfirmationView preview={preview} onSend={handleSend} onCancel={() => setPreview(null)} sending={spendCode.isPending} />;
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="friend-code-input">Friend code</Label>
        <div className="flex items-center gap-2">
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
  return `${inviterName} invited you to Bloom 🌸\n\nCreate an account, open Friends, and enter this code:\n${displayCode(code)}\n\nBloom helps us organize our job searches and encourage each other without sharing private application details.`;
}

function InviteSomeoneView() {
  const { data: profile } = useProfile();
  const { data: codes = [], isLoading } = useMyFriendCodes();
  const createCode = useCreateFriendCode();
  const regenerateCode = useRegenerateFriendCode();
  const revokeCode = useRevokeFriendCode();
  const { push } = useToast();

  const [expiration, setExpiration] = React.useState<FriendCodeExpiration>("7d");
  const [maxUses, setMaxUses] = React.useState<FriendCodeMaxUses>(1);
  const [copied, setCopied] = React.useState(false);
  const [showOptions, setShowOptions] = React.useState(false);
  // The plaintext code only ever exists here, in memory, for the session
  // that created or regenerated it — friend_codes never persists it.
  const [plaintext, setPlaintext] = React.useState<string | null>(null);
  const createdRef = React.useRef(false);

  const currentCode = codes[0] ?? null;
  const inviterName = profile?.display_name || "A friend";

  React.useEffect(() => {
    if (isLoading || createdRef.current) return;
    if (codes.length === 0) {
      createdRef.current = true;
      createCode.mutate(
        { expiresIn: expiration, maxUses },
        { onSuccess: (result) => setPlaintext(result.code) }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, codes.length]);

  const visibleCode = plaintext ? displayCode(plaintext) : currentCode ? `BLOOM-${currentCode.code_hint}` : null;
  const usesRemaining = currentCode ? Math.max(0, currentCode.max_uses - currentCode.use_count) : 0;

  async function handleCopy() {
    if (!plaintext) {
      push("Regenerate to get a copyable code — this one was already shown once.", "info");
      return;
    }
    try {
      await navigator.clipboard.writeText(displayCode(plaintext));
      setCopied(true);
      push("Friend code copied.", "success");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      push("Couldn't copy — try selecting and copying it manually.", "error");
    }
  }

  async function handleShare() {
    if (!plaintext) return;
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
      const result = currentCode
        ? await regenerateCode.mutateAsync({ id: currentCode.id, settings: { expiresIn: expiration, maxUses } })
        : await createCode.mutateAsync({ expiresIn: expiration, maxUses });
      setPlaintext(result.code);
      push("A fresh friend code is ready.", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't create a new code.", "error");
    }
  }

  async function handleDisable() {
    if (!currentCode) return;
    try {
      await revokeCode.mutateAsync(currentCode.id);
      setPlaintext(null);
      push("Friend code disabled.", "info");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't disable that code.", "error");
    }
  }

  const busy = createCode.isPending || regenerateCode.isPending || revokeCode.isPending;
  const canShare = Boolean(plaintext);

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label>Your code</Label>
        <div className="flex items-center gap-2">
          <div className="flex h-11 flex-1 items-center rounded-2xl border border-input/90 bg-card/95 px-3.5 font-mono text-base tracking-wide shadow-soft">
            {isLoading || !visibleCode ? "Generating your code…" : visibleCode}
          </div>
          <Button type="button" variant="outline" size="icon" onClick={handleCopy} disabled={!visibleCode} aria-label="Copy friend code">
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        {currentCode && (
          <p className="text-xs text-muted-foreground">
            {currentCode.is_active ? `${usesRemaining} use${usesRemaining === 1 ? "" : "s"} left` : "This code is disabled."}
            {currentCode.expires_at ? ` · Expires ${new Date(currentCode.expires_at).toLocaleDateString()}` : " · Never expires"}
          </p>
        )}
        {!plaintext && currentCode && (
          <p className="text-xs text-muted-foreground">
            For your security, the full code is only shown once. Open Options to regenerate a fresh one you can share.
          </p>
        )}

        <div className="mt-1 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={handleShare} disabled={!canShare}>
            <Share2 className="h-3.5 w-3.5" /> Share
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleText} disabled={!canShare}>
            <MessageSquareText className="h-3.5 w-3.5" /> Text
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleMail} disabled={!canShare}>
            <Mail className="h-3.5 w-3.5" /> Email
          </Button>
        </div>
      </div>

      {/* Progressive disclosure: expiration, max uses, regenerate, and
          disable are secondary actions — shown only once a code exists and
          only when the user asks for them. */}
      {currentCode && (
        <div className="rounded-xl border border-border/60">
          <button
            type="button"
            onClick={() => setShowOptions((v) => !v)}
            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-medium text-muted-foreground hover:text-foreground"
            aria-expanded={showOptions}
          >
            <Settings2 className="h-3.5 w-3.5" />
            Options
            <ChevronRight className={`ml-auto h-3.5 w-3.5 transition-transform ${showOptions ? "rotate-90" : ""}`} />
          </button>
          {showOptions && (
            <div className="grid gap-3 border-t border-border/60 p-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Expiration</Label>
                  <Select value={expiration} onValueChange={(v) => setExpiration(v as FriendCodeExpiration)}>
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
                  <Select value={String(maxUses)} onValueChange={(v) => setMaxUses(Number(v) as FriendCodeMaxUses)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="-mt-1 text-xs text-muted-foreground">Changing these applies the next time you tap Regenerate.</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleRegenerate} disabled={busy}>
                  <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                </Button>
                {currentCode.is_active && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleDisable} disabled={busy} className="text-destructive hover:bg-destructive/10">
                    <ShieldOff className="h-3.5 w-3.5" /> Disable code
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <AuthNotice variant="info">
        Share this code with someone you trust. They&apos;ll still need to accept the connection before either of you can see
        shared progress.
      </AuthNotice>
    </div>
  );
}
