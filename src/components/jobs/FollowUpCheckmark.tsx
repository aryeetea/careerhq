import * as React from "react";
import { Check } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCompleteFollowUp, useScheduleAnotherFollowUp } from "@/hooks/queries/useJobs";
import { useSettings } from "@/hooks/queries/useProfile";
import { useToast } from "@/components/shared/toast";
import { cn } from "@/lib/utils";
import type { Job } from "@/types/database";

/**
 * The one action every follow-up reminder gets, everywhere it appears —
 * Dashboard, Job Details, Calendar's day agenda. Completing clears the
 * reminder immediately (optimistic; rolls back if the save fails) and, the
 * first time only, offers a single optional second follow-up rather than
 * silently starting an endless reminder chain.
 */
export function FollowUpCheckmark({ job, className }: { job: Job; className?: string }) {
  const completeFollowUp = useCompleteFollowUp();
  const scheduleAnother = useScheduleAnotherFollowUp();
  const { data: settings } = useSettings();
  const { push } = useToast();
  const [offerAnother, setOfferAnother] = React.useState(false);
  const guardRef = React.useRef(false);

  async function handleComplete(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation();
    if (guardRef.current) return;
    guardRef.current = true;
    try {
      await completeFollowUp.mutateAsync({ id: job.id, nextRound: job.follow_up_round + 1 });
      push("Follow-up completed.", "success");
      // Only offer a second round once, and only if the user hasn't turned
      // automatic scheduling off entirely — never past round 2.
      if (job.follow_up_round === 0 && settings?.default_application_follow_up_days) {
        setOfferAnother(true);
        window.setTimeout(() => setOfferAnother(false), 8000);
      }
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't mark that complete. Try again.", "error");
    } finally {
      guardRef.current = false;
    }
  }

  async function handleScheduleAnother() {
    const days = settings?.default_application_follow_up_days ?? 7;
    const date = new Date();
    date.setDate(date.getDate() + days);
    try {
      await scheduleAnother.mutateAsync({ id: job.id, followUpDate: date.toISOString().slice(0, 10) });
      push("One more follow-up scheduled.", "success");
    } catch {
      push("Couldn't schedule that — try again from the job.", "error");
    } finally {
      setOfferAnother(false);
    }
  }

  if (offerAnother) {
    return (
      <div className={cn("flex shrink-0 items-center gap-1.5 text-xs", className)} onClick={(e) => e.stopPropagation()}>
        <span className="text-muted-foreground">One more follow-up?</span>
        <button type="button" onClick={handleScheduleAnother} className="font-medium text-primary hover:underline">
          Yes
        </button>
        <button type="button" onClick={() => setOfferAnother(false)} className="text-muted-foreground hover:underline">
          No thanks
        </button>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleComplete}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleComplete(e);
          }}
          disabled={completeFollowUp.isPending}
          aria-label="Mark follow-up complete"
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-success/35 text-success transition-colors hover:bg-success/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
            className
          )}
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>Mark follow-up complete</TooltipContent>
    </Tooltip>
  );
}
