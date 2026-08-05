import { Link } from "react-router-dom";
import { KanbanSquare, Users2, GraduationCap, ArrowRight } from "lucide-react";
import { AmbientBackground } from "@/components/ambient/AmbientBackground";
import { BotanicalAccent } from "@/components/ambient/BotanicalAccent";
import { BrandMark } from "@/components/shared/BrandMark";
import { AuthIntentButton } from "@/components/shared/AuthIntentButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const FEATURES = [
  {
    icon: KanbanSquare,
    title: "A board that grows with you",
    body: "Save roles from LinkedIn, Indeed, or anywhere else, then move them through your own pace — saved, applied, interviewing, offer.",
  },
  {
    icon: GraduationCap,
    title: "Resumes and certifications in one place",
    body: "Know which resume you sent where, and keep the courses and credentials you're building moving without a separate spreadsheet.",
  },
  {
    icon: Users2,
    title: "Encouragement, not competition",
    body: "Share only what you choose with friends — high-level progress, never company names or notes — and send a little support back.",
  },
];

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <AmbientBackground />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
        <div className="flex items-center gap-2.5">
          <BrandMark size="md" />
          <span className="font-display text-lg font-semibold tracking-tight">Bloom</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link to="/about">About</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/login">Sign in</Link>
          </Button>
          <AuthIntentButton destination="/signup" signedInLabel="Opening sign up…">
            Get started
          </AuthIntentButton>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-10 sm:pt-16">
        <div className="relative mx-auto max-w-2xl text-center">
          <BotanicalAccent className="pointer-events-none absolute -right-10 -top-10 hidden h-40 w-32 rotate-12 sm:block" />
          <p className="mb-3 inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            Grow your career, gently
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            A calm, warm space to grow your career
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-balance text-muted-foreground">
            Bloom doesn't search job boards for you — it helps you organize what you find, decide what's worth pursuing, and
            keep growing, one small step at a time.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <AuthIntentButton destination="/signup" size="lg" className="gap-1.5" signedInLabel="Opening sign up…">
              <>
                Start growing <ArrowRight className="h-4 w-4" />
              </>
            </AuthIntentButton>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">I already have an account</Link>
            </Button>
          </div>
        </div>

        <div className="mt-20 grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="hover-lift">
              <CardContent className="p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <p className="font-display text-base font-semibold">{f.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <footer className="relative z-10 mx-auto max-w-5xl px-6 pb-10 pt-4 text-center text-xs text-muted-foreground sm:px-10 sm:text-left">
        <Link to="/about" className="hover:text-foreground hover:underline">
          About Bloom
        </Link>
      </footer>
    </div>
  );
}
