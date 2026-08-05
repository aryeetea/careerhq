import { Link } from "react-router-dom";
import { Sparkles, ShieldCheck, HeartHandshake, Leaf } from "lucide-react";
import { AmbientBackground } from "@/components/ambient/AmbientBackground";
import { BotanicalAccent } from "@/components/ambient/BotanicalAccent";
import { AuthIntentButton } from "@/components/shared/AuthIntentButton";
import { BrandMark } from "@/components/shared/BrandMark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PRINCIPLES = [
  {
    icon: Leaf,
    title: "Growth, not grind",
    body: "A job search isn't a sprint to win — it's a season to move through. Bloom is built around steady, sustainable progress instead of pressure and streak-shaming.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    body: "Your applications, notes, recruiter details, and resumes are yours alone. Nothing is ever shared automatically — sharing is a choice you make, field by field, whenever you're ready.",
  },
  {
    icon: HeartHandshake,
    title: "Encouragement, not competition",
    body: "Friends can see that you're making progress — never the specifics. There are no leaderboards here, just people rooting for each other.",
  },
];

export default function About() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <AmbientBackground />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandMark size="md" />
          <span className="font-display text-lg font-semibold tracking-tight">Bloom</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/login">Sign in</Link>
          </Button>
          <AuthIntentButton destination="/signup" signedInLabel="Opening sign up…">
            Get started
          </AuthIntentButton>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-8 sm:pt-14">
        <div className="relative text-center">
          <BotanicalAccent className="pointer-events-none absolute -right-8 -top-10 hidden h-36 w-28 rotate-12 sm:block" />
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Why Bloom exists</h1>
          <p className="mx-auto mt-4 max-w-xl text-balance text-muted-foreground">
            Most job-search tools are built like sales pipelines — funnels, conversion rates, quotas. A career change is a
            personal, often difficult season of life, and it deserves a tool that feels like that: calm, organized, and a
            little bit kind. Bloom is what we wished existed — a place to keep track of everything without it feeling like
            one more thing keeping score against you.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-1">
          {PRINCIPLES.map((p) => (
            <Card key={p.title} className="hover-lift">
              <CardContent className="flex items-start gap-4 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <p.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-base font-semibold">{p.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-14 text-center">
          <p className="text-sm text-muted-foreground">Ready to give your search a calmer home?</p>
          <AuthIntentButton destination="/signup" size="lg" className="mt-4" signedInLabel="Opening sign up…">
            Start growing with Bloom
          </AuthIntentButton>
        </div>
      </main>
    </div>
  );
}
