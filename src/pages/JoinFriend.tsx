import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, LoaderCircle, Sparkles, X } from "lucide-react";
import { AmbientBackground } from "@/components/ambient/AmbientBackground";
import { BrandMark } from "@/components/shared/BrandMark";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useAcceptFriendInviteLink, useFriendInviteLinkPreview } from "@/hooks/queries/useFriendInvites";
import { useSignedAvatarUrl } from "@/hooks/useSignedAvatarUrl";
import { useCelebration } from "@/components/ambient/Celebration";
import { useToast } from "@/components/shared/toast";
import { initials } from "@/lib/utils";

export default function JoinFriend() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { push } = useToast();
  const { celebrate } = useCelebration();
  const acceptInvite = useAcceptFriendInviteLink();
  const { data: preview, isLoading: previewLoading, isError: previewError } = useFriendInviteLinkPreview(token);
  const avatarUrl = useSignedAvatarUrl(preview?.avatar_url ?? null);
  const [declined, setDeclined] = React.useState(false);

  const nextTarget = token ? `/join/friend/${token}` : "/signup";
  const signUpHref = `/signup?next=${encodeURIComponent(nextTarget)}`;
  const signInHref = `/login?next=${encodeURIComponent(nextTarget)}`;

  const expired = Boolean(preview?.expires_at && new Date(preview.expires_at).getTime() < Date.now());
  const usedUp = Boolean(preview?.max_uses != null && preview.use_count >= preview.max_uses);
  const linkUnusable = Boolean(preview) && (!preview!.is_active || expired || usedUp);

  async function handleAccept() {
    if (!token) return;
    try {
      await acceptInvite.mutateAsync(token);
      celebrate("You're growing together now. 🌸");
      push("You're now friends", "success");
      navigate("/app/friends", { replace: true });
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't accept this invitation right now.", "error");
    }
  }

  function handleDecline() {
    setDeclined(true);
    window.setTimeout(() => navigate("/app", { replace: true }), 600);
  }

  const inviterName = preview?.display_name || preview?.username || "A friend";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <AmbientBackground />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
        <Card className="glass-subtle w-full max-w-xl border-border/70">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto flex items-center gap-3">
              <BrandMark size="md" />
              <span className="font-display text-lg font-semibold tracking-tight">Bloom</span>
            </div>

            {!previewLoading && preview ? (
              <Avatar className="mx-auto h-16 w-16 border border-border shadow-soft">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                <AvatarFallback className="text-lg">{initials(inviterName)}</AvatarFallback>
              </Avatar>
            ) : (
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/12 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
            )}

            <CardTitle className="font-display text-2xl">
              {preview ? `${inviterName} invited you to Bloom` : "Join Bloom"}
            </CardTitle>
            <CardDescription className="text-sm leading-6 text-muted-foreground">
              Grow your career together. Track applications. Get AI coaching. Celebrate progress together.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4">
            {previewLoading && (
              <AuthNotice variant="info">
                <span className="inline-flex items-center gap-2">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Checking this invite link…
                </span>
              </AuthNotice>
            )}

            {previewError && (
              <AuthNotice variant="error">
                We couldn&apos;t read this invite. It may be broken, expired, or no longer active.
              </AuthNotice>
            )}

            {!previewLoading && preview && linkUnusable && (
              <AuthNotice variant="error">
                {usedUp
                  ? "This invite link has already been used."
                  : expired
                    ? "This invite link has expired."
                    : "This invite link has been turned off."}
              </AuthNotice>
            )}

            {!previewLoading && preview?.bio && (
              <p className="rounded-xl bg-secondary/40 p-3 text-center text-sm leading-6 text-foreground/82">{preview.bio}</p>
            )}
            {!previewLoading && preview?.career_goal && (
              <p className="text-center text-xs text-muted-foreground">Working toward: {preview.career_goal}</p>
            )}

            {loading ? (
              <div className="flex justify-center py-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Checking your session…
                </span>
              </div>
            ) : !user ? (
              <>
                <AuthNotice variant="info">You&apos;ll need a Bloom account before you can accept this invitation.</AuthNotice>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button asChild className="flex-1">
                    <Link to={signUpHref}>Create Account</Link>
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <Link to={signInHref}>Sign In</Link>
                  </Button>
                </div>
              </>
            ) : declined ? (
              <p className="py-2 text-center text-sm text-muted-foreground">No worries — heading back to Bloom.</p>
            ) : !linkUnusable && preview ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="flex-1" onClick={handleAccept} disabled={acceptInvite.isPending}>
                  {acceptInvite.isPending ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" /> Accepting…
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" /> Accept Invitation
                    </>
                  )}
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleDecline} disabled={acceptInvite.isPending}>
                  <X className="h-4 w-4" /> Decline
                </Button>
              </div>
            ) : (
              <Button asChild size="lg" className="w-full">
                <Link to="/app/friends">Back to Bloom</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
