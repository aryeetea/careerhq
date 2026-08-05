import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { goalFormSchema, type GoalFormValues } from "@/lib/validation";
import { useCreateGoal } from "@/hooks/queries/useGoals";
import { useToast } from "@/components/shared/toast";

const SUGGESTIONS = ["Apply to 10 jobs this week", "Complete 3 lessons", "Follow up with 2 recruiters", "Practice 5 interview questions"];

export function CreateGoalDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createGoal = useCreateGoal();
  const { push } = useToast();
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: { name: "", description: "", targetCount: 10, unit: "applications", deadline: "", isShared: false },
  });

  function close(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function onSubmit(values: GoalFormValues) {
    try {
      await createGoal.mutateAsync({
        name: values.name.trim(),
        description: values.description?.trim() || null,
        target_count: values.targetCount,
        unit: values.unit.trim(),
        deadline: values.deadline || null,
        is_shared: values.isShared,
      });
      push("Goal created", "success");
      close(false);
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't create that goal.", "error");
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
            <Label htmlFor="g-name">Goal *</Label>
            <Input id="g-name" list="goal-suggestions" placeholder="Apply to 10 jobs this week" {...register("name")} aria-invalid={!!errors.name} />
            <datalist id="goal-suggestions">{SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="g-target">Target count</Label>
              <Input id="g-target" type="number" min={1} {...register("targetCount")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="g-unit">Unit</Label>
              <Input id="g-unit" placeholder="applications" {...register("unit")} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="g-deadline">Deadline</Label>
            <Input id="g-deadline" type="date" {...register("deadline")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="g-description">Description</Label>
            <Textarea id="g-description" rows={2} {...register("description")} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-card/60 p-3.5">
            <div>
              <p className="text-sm font-medium">Share with friends</p>
              <p className="text-xs text-muted-foreground">Friends can join and see everyone's progress on this goal only.</p>
            </div>
            <Switch checked={watch("isShared")} onCheckedChange={(v) => setValue("isShared", v)} />
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
