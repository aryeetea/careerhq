import * as React from "react";
import { Link } from "react-router-dom";
import { CalendarClock, FileText, KanbanSquare, Settings, Sparkles, Target, Users2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TOUR_VERSION = "v1";

const STEPS = [
  {
    title: "Start on the dashboard",
    description: "This is your calm snapshot. It shows what needs attention and what is quietly moving forward.",
    icon: Sparkles,
    tips: [
      { label: "Dashboard", text: "Your weekly momentum, upcoming follow-ups, and interviews live here." },
      { label: "First move", text: "If the page feels empty, add a job or upload a resume to wake things up." },
    ],
  },
  {
    title: "Use the board to track every role",
    description: "The board is where Bloom keeps each application stage easy to see and update.",
    icon: KanbanSquare,
    tips: [
      { label: "Drag to update", text: "Move a job to Applied, Interview, or Offer as your search changes." },
      { label: "Automatic help", text: "When you mark a job Applied, Bloom can schedule a follow-up for you." },
    ],
  },
  {
    title: "Build your materials once",
    description: "Resumes, goals, and certifications give Bloom enough context to make the rest of the app more useful.",
    icon: FileText,
    tips: [
      { label: "Resumes", text: "Upload at least one resume so job tracking and AI suggestions have something to work from." },
      { label: "Goals", text: "Set a gentle weekly target so progress feels measurable without becoming pressure." },
    ],
  },
  {
    title: "Shape the app around you",
    description: "Privacy, friends, and preferences are all optional, and you stay in control of what Bloom shares.",
    icon: Settings,
    tips: [
      { label: "Friends", text: "Add friends only if you want encouragement and shared accountability." },
      { label: "Settings", text: "Choose your follow-up preferences, theme, and sharing defaults whenever you're ready." },
    ],
  },
] as const;

export function WelcomeTutorialDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    if (!open) setStep(0);
  }, [open]);

  function completeTour() {
    localStorage.setItem(`bloom-welcome-tour:${TOUR_VERSION}:${userId}`, "seen");
    onOpenChange(false);
  }

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="overflow-hidden">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-primary/10 p-2 text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/75">
              Welcome to Bloom
            </span>
          </div>
          <DialogTitle className="text-2xl">{current.title}</DialogTitle>
          <DialogDescription className="max-w-2xl text-sm leading-6 text-foreground/72">
            {current.description}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="flex items-center gap-2">
            {STEPS.map((item, index) => (
              <div
                key={item.title}
                className={cn(
                  "h-2 flex-1 rounded-full transition-colors",
                  index <= step ? "bg-primary/70" : "bg-border/70"
                )}
                aria-hidden="true"
              />
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {current.tips.map((tip) => (
              <div key={tip.label} className="rounded-2xl border border-border/60 bg-card/70 p-4">
                <p className="text-sm font-semibold">{tip.label}</p>
                <p className="mt-1 text-sm leading-6 text-foreground/72">{tip.text}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
            <p className="text-sm font-semibold">Helpful places to visit next</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <QuickJump to="/app/board" icon={<KanbanSquare className="h-4 w-4" />} title="Open the board" description="Track each job stage visually." />
              <QuickJump to="/app/resumes" icon={<FileText className="h-4 w-4" />} title="Upload a resume" description="Give Bloom something to work from." />
              <QuickJump to="/app/goals" icon={<Target className="h-4 w-4" />} title="Set a goal" description="Keep your week focused and gentle." />
              <QuickJump to="/app/friends" icon={<Users2 className="h-4 w-4" />} title="Add friends later" description="Optional encouragement when you want it." />
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/75 px-4 py-3">
            <p className="flex items-start gap-2 text-sm leading-6 text-foreground/72">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              Bloom works best when you update it a little at a time. You do not need to fill out everything at once.
            </p>
          </div>
        </div>

        <DialogFooter className="mt-2">
          <div className="mr-auto text-sm text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </div>
          {step > 0 && (
            <Button type="button" variant="ghost" onClick={() => setStep((currentStep) => currentStep - 1)}>
              Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={() => setStep((currentStep) => currentStep + 1)}>
              Next tip
            </Button>
          ) : (
            <Button type="button" onClick={completeTour}>
              Start using Bloom
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuickJump({
  to,
  icon,
  title,
  description,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-border/55 bg-background/85 px-3.5 py-3 transition-colors hover:border-primary/20 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </p>
      <p className="mt-1 text-sm leading-6 text-foreground/68">{description}</p>
    </Link>
  );
}
