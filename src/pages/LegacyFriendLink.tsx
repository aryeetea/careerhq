import { Link } from "react-router-dom";
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
              Ask your friend for their Bloom friend code instead — you can enter it from Community once you&apos;re signed
              in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!loading && (
              <Button asChild size="lg" className="w-full">
                <Link to={user ? "/app/community/friends" : "/login"}>{user ? "Go to Community" : "Sign in"}</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
