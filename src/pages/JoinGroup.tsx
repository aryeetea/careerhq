import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LoaderCircle, UsersRound } from "lucide-react";
import { AmbientBackground } from "@/components/ambient/AmbientBackground";
import { BrandMark } from "@/components/shared/BrandMark";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useGroupJoinLinkPreview, useJoinGroupViaLink } from "@/hooks/queries/useGroups";
import { useToast } from "@/components/shared/toast";

export default function JoinGroup() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { push } = useToast();
  const joinGroup = useJoinGroupViaLink();
  const { data: preview, isLoading: previewLoading, isError: previewError } = useGroupJoinLinkPreview(token);
  const attemptedRef = React.useRef(false);

  React.useEffect(() => {
    if (!token || !user || loading || joinGroup.isPending || attemptedRef.current) return;
    attemptedRef.current = true;
    joinGroup.mutate(token, {
      onSuccess: (groupId) => {
        push("You joined the group", "success");
        navigate(`/app/groups/${groupId}`, { replace: true });
      },
      onError: (error) => {
        push(error instanceof Error ? error.message : "Couldn't join this group right now.", "error");
      },
    });
  }, [joinGroup, loading, navigate, push, token, user]);

  const nextTarget = token ? `/join/group/${token}` : "/signup";
  const signUpHref = `/signup?next=${encodeURIComponent(nextTarget)}`;
  const signInHref = `/login?next=${encodeURIComponent(nextTarget)}`;

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
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/12 text-primary">
              <UsersRound className="h-5 w-5" />
            </div>
            <CardTitle className="font-display text-2xl">
              {preview?.group_name ? `Join ${preview.group_name}` : "Join this Bloom group"}
            </CardTitle>
            <CardDescription className="text-sm leading-6 text-muted-foreground">
              {preview?.group_description
                ? preview.group_description
                : "A friend shared a private Bloom group with you so you can grow your job search together."}
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
                We couldn&apos;t read this group invite. It may be broken, expired, or no longer active.
              </AuthNotice>
            )}

            {!previewLoading && preview && !preview.is_active && (
              <AuthNotice variant="error">This invite link has been turned off by the group owner.</AuthNotice>
            )}

            {!previewLoading && preview?.expires_at && new Date(preview.expires_at).getTime() < Date.now() && (
              <AuthNotice variant="error">This invite link has expired.</AuthNotice>
            )}

            {!previewLoading && preview && preview.is_active && (
              <p className="text-center text-sm text-muted-foreground">
                {preview.member_count} member{preview.member_count === 1 ? "" : "s"} already inside.
              </p>
            )}

            {loading ? (
              <div className="flex justify-center py-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Checking your session…
                </span>
              </div>
            ) : user ? (
              <AuthNotice variant={joinGroup.isError ? "error" : "info"}>
                <span className="inline-flex items-center gap-2">
                  {joinGroup.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  {joinGroup.isPending
                    ? "Joining the group now…"
                    : joinGroup.isError
                      ? "We couldn't finish joining this group. Try the button below."
                      : "You’re signed in. We’re bringing you into the group now."}
                </span>
              </AuthNotice>
            ) : (
              <>
                <AuthNotice variant="info">
                  You&apos;ll need a Bloom account before you can open the app or join this group.
                </AuthNotice>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button asChild className="flex-1">
                    <Link to={signUpHref}>Create an account</Link>
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <Link to={signInHref}>I already have an account</Link>
                  </Button>
                </div>
              </>
            )}

            {user && joinGroup.isError && (
              <Button onClick={() => joinGroup.mutate(token as string)} disabled={!token || joinGroup.isPending}>
                {joinGroup.isPending ? "Joining…" : "Try again"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
