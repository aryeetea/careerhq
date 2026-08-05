import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { groupFormSchema, type GroupFormValues } from "@/lib/validation";
import { useCreateGroup } from "@/hooks/queries/useGroups";
import { useToast } from "@/components/shared/toast";

const SUGGESTIONS = ["Friends Job Search Group", "Recent Graduates", "Cybersecurity Study Group"];

export function CreateGroupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createGroup = useCreateGroup();
  const { push } = useToast();
  const navigate = useNavigate();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: { name: "", description: "", weeklyGoalTarget: undefined },
  });

  function close(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function onSubmit(values: GroupFormValues) {
    try {
      const group = await createGroup.mutateAsync({
        name: values.name.trim(),
        description: values.description?.trim() || null,
        weekly_goal_target: values.weeklyGoalTarget ?? null,
      });
      push(`Created ${group.name}`, "success");
      close(false);
      navigate(`/app/groups/${group.id}`);
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't create that group.", "error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a group</DialogTitle>
          <DialogDescription>A small, invite-only space for people who get what this season feels like.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="grp-name">Name *</Label>
            <Input id="grp-name" list="group-suggestions" {...register("name")} aria-invalid={!!errors.name} />
            <datalist id="group-suggestions">{SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="grp-description">Description</Label>
            <Textarea id="grp-description" rows={2} {...register("description")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="grp-goal">Shared weekly goal (applications)</Label>
            <Input id="grp-goal" type="number" min={0} placeholder="Optional" {...register("weeklyGoalTarget")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Creating…" : "Create group"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
