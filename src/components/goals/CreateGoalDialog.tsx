import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight } from "lucide-react";
import { PostgrestError } from "@supabase/supabase-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { goalFormSchema, type GoalFormValues } from "@/lib/validation";
import { parseGoalText } from "@/lib/goals";
import { useCreateGoal } from "@/hooks/queries/useGoals";
import { useToast } from "@/components/shared/toast";
import { cn } from "@/lib/utils";
import type { Goal } from "@/types/database";

const SUGGESTIONS = ["Apply to 10 jobs this week", "Complete 3 lessons", "Follow up with 2 recruiters", "Practice 5 interview questions"];

// Maps whatever createGoal() threw to copy a person can act on, mirroring
// the same code-based mapping used for group creation. Never shows the
// raw Postgres/Postgrest message.
function describeCreateGoalError(err: unknown): string {
  if (err instanceof PostgrestError || (err && typeof err === "object" && "code" in err)) {
    const code = (err as { code?: string }).code;
    switch (code) {
      case "42501": // insufficient_privilege (RLS)
        return "You don't have permission to create goals.";
      case "PGRST301": // JWT expired/invalid
        return "Please sign in again.";
      default:
        return "We couldn't save your goal. Please try again.";
    }
  }
  if (err instanceof TypeError) {
    return "Connection lost. Please try again.";
  }
  return "We couldn't save your goal. Please try again.";
}

export function CreateGoalDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (goal: Goal) => void;
}) {
  const createGoal = useCreateGoal();
  const { push } = useToast();
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [deadlineOpen, setDeadlineOpen] = React.useState(false);
  const submitGuardRef = React.useRef(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting, dirtyFields } } = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: { name: "", description: "", targetCount: 1, unit: "applications", deadline: "", isShared: false },
  });

  function close(next: boolean) {
    if (!next) {
      reset();
      setDetailsOpen(false);
      setDeadlineOpen(false);
    }
    onOpenChange(next);
  }

  // "Apply to 25 jobs" already says the target and the unit — asking for
  // them again in separate fields would just make someone retype what
  // they already wrote. Fill target/unit from the goal text as they type,
  // but only while they haven't touched those fields themselves; once
  // they've edited one by hand, their choice always wins.
  function handleNameChange(value: string) {
    setValue("name", value, { shouldDirty: true });
    const { targetCount, unit } = parseGoalText(value);
    if (targetCount !== null && !dirtyFields.targetCount) {
      setValue("targetCount", targetCount);
    }
    if (unit !== null && !dirtyFields.unit) {
      setValue("unit", unit);
    }
  }

  async function onSubmit(values: GoalFormValues) {
    if (submitGuardRef.current) return;
    submitGuardRef.current = true;
    try {
      const goal = await createGoal.mutateAsync({
        name: values.name.trim(),
        description: values.description?.trim() || null,
        target_count: values.targetCount,
        unit: values.unit.trim(),
        deadline: values.deadline || null,
        is_shared: values.isShared,
      });
      push("Goal created.", "success");
      close(false);
      onCreated?.(goal);
    } catch (err) {
      push(describeCreateGoalError(err), "error");
    } finally {
      submitGuardRef.current = false;
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New goal</DialogTitle>
          <DialogDescription>Small and doable beats ambitious and abandoned.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="g-name">Goal</Label>
            <Input
              id="g-name"
              list="goal-suggestions"
              placeholder="Apply to 10 jobs this week"
              value={watch("name")}
              onChange={(e) => handleNameChange(e.target.value)}
              aria-invalid={!!errors.name}
            />
            <datalist id="goal-suggestions">{SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="g-target">Target number</Label>
              <Input id="g-target" type="number" min={1} {...register("targetCount")} aria-invalid={!!errors.targetCount} />
              {errors.targetCount && <p className="text-xs text-destructive">{errors.targetCount.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="g-unit">Unit</Label>
              <Input id="g-unit" placeholder="applications" {...register("unit")} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-card/60 p-3.5">
            <button
              type="button"
              className="text-left"
              onClick={() => setValue("isShared", !watch("isShared"), { shouldDirty: true })}
            >
              <p className="text-sm font-medium">Share with friends</p>
              <p className="text-xs text-muted-foreground">Friends can join and see progress on this goal only.</p>
            </button>
            <Switch checked={watch("isShared")} onCheckedChange={(v) => setValue("isShared", v, { shouldDirty: true })} />
          </div>

          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-primary"
            >
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", detailsOpen && "rotate-90")} />
              Add details (optional)
            </button>
            {detailsOpen && (
              <div className="grid gap-1.5">
                <Label htmlFor="g-description">Description</Label>
                <Textarea id="g-description" rows={2} placeholder="What does hitting this look like?" {...register("description")} />
              </div>
            )}

            <button
              type="button"
              onClick={() => setDeadlineOpen((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-primary"
            >
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", deadlineOpen && "rotate-90")} />
              Add a deadline (optional)
            </button>
            {deadlineOpen && (
              <div className="grid gap-1.5">
                <Label htmlFor="g-deadline">Deadline</Label>
                <Input id="g-deadline" type="date" {...register("deadline")} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Creating…" : "Create goal"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
