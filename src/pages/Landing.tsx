import { Link } from "react-router-dom";
import { Briefcase, KanbanSquare, Users2, GraduationCap, ArrowRight } from "lucide-react";
import { AmbientBackground } from "@/components/ambient/AmbientBackground";
import { BotanicalAccent } from "@/components/ambient/BotanicalAccent";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const FEATURES = [
  {
    icon: KanbanSquare,
    title: "A board that actually reflects reality",
    body: "Save roles from LinkedIn, Indeed, or anywhere else, then drag them through your pipeline — saved, applied, interviewing, offer.",
  },
  {
    icon: GraduationCap,
    title: "Resumes and certifications in one place",
    body: "Track which resume you sent where, and keep certifications and courses moving without a separate spreadsheet.",
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
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Briefcase className="h-4 w-4" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">CareerHQ</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/signup">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-10 sm:pt-16">
        <div className="relative mx-auto max-w-2xl text-center">
          <BotanicalAccent className="pointer-events-none absolute -right-10 -top-10 hidden h-40 w-32 rotate-12 sm:block" />
          <p className="mb-3 inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            Your job search, held gently
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            A calm, warm home base for finding what's next
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-balance text-muted-foreground">
            CareerHQ doesn't search job boards for you — it helps you organize what you find, decide what's worth applying to,
            and keep going, one small step at a time.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="gap-1.5">
              <Link to="/signup">
                Start your board <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
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
    </div>
  );
}
