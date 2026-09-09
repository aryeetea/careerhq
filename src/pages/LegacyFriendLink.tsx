import { Link, useParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { AmbientBackground } from "@/components/ambient/AmbientBackground";
import { BrandMark } from "@/components/shared/BrandMark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

// Bloom's friend invites moved from shareable links to friend codes
// (entered from Community → Friends, inside the authenticated app — never
// a standalone route). Anyone who still has an old /join/friend/:token link
// lands here instead of a broken page, no data fetching, no context
// dependency beyond what's available at this route level.
export default function LegacyFriendLink() {
  const { user, loading } = useAuth();
  const { token } = useParams<{ token: string }>();
  const nextTarget = token ? `/join/friend/${token}` : "/signup";
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
              <Sparkles className="h-5 w-5" />
            </div>
            <CardTitle className="font-display text-2xl">This invite link is no longer used</CardTitle>
            <CardDescription className="text-sm leading-6 text-muted-foreground">
              Friend invites now work through Bloom friend codes. Create an account or sign in, then head to Community
              to enter your friend&apos;s code.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {!loading && user && (
              <Button asChild size="lg" className="w-full sm:col-span-2">
                <Link to="/app/community/friends">Go to Community</Link>
              </Button>
            )}
            {!loading && !user && (
              <>
                <Button asChild size="lg" className="w-full">
                  <Link to={signUpHref}>Create an account</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="w-full">
                  <Link to={signInHref}>I already have an account</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
