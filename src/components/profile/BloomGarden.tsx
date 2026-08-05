import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { computeGardenStages } from "@/lib/garden";
import { formatDate, cn } from "@/lib/utils";
import type { Job, Resume } from "@/types/database";

/**
 * Bloom's signature progress motif — six stages, unlocked purely by data
 * already on the Profile page (no separate persistence). Kept small and
 * single-card on purpose: celebrates progress, never calls out a gap, and
 * never dominates the page.
 */
export function BloomGarden({ jobs, resumes, accountCreatedAt }: { jobs: Job[]; resumes: Resume[]; accountCreatedAt: string }) {
  const stages = computeGardenStages(jobs, resumes, accountCreatedAt);
  const unlockedCount = stages.filter((s) => s.unlocked).length;

  return (
    <Card className="glass-subtle border-border/60">
      <CardContent className="p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="font-semibold">Bloom Garden</h3>
          <p className="text-xs text-muted-foreground">
            {unlockedCount} of {stages.length} stages grown
          </p>
        </div>

        <div className="relative flex flex-wrap items-start justify-between gap-x-2 gap-y-6 px-1">
          <div aria-hidden="true" className="absolute left-6 right-6 top-6 hidden h-px bg-border/60 sm:block" />
          {stages.map((stage) => (
            <Tooltip key={stage.key}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "relative z-10 flex flex-col items-center gap-1.5 rounded-2xl px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    stage.unlocked && "motion-safe:animate-gentle-pop"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full border text-xl shadow-soft transition-colors",
                      stage.unlocked
                        ? "border-primary/25 bg-secondary"
                        : "border-dashed border-border/70 bg-card/50 opacity-50 grayscale"
                    )}
                  >
                    {stage.emoji}
                  </span>
                  <span
                    className={cn(
                      "max-w-[5.5rem] text-center text-[11px] leading-tight",
                      stage.unlocked ? "font-medium text-foreground/80" : "text-muted-foreground"
                    )}
                  >
                    {stage.label}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{stage.label}</p>
                <p className="mt-0.5 max-w-[14rem] text-[11px] leading-4 opacity-90">
                  {stage.unlocked ? stage.description : "Not yet — keep going."}
                </p>
                {stage.unlocked && stage.unlockedAt && (
                  <p className="mt-1 text-[11px] opacity-70">Reached {formatDate(stage.unlockedAt)}</p>
                )}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
