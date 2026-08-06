import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { PostgrestError } from "@supabase/supabase-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { groupFormSchema, type GroupFormValues } from "@/lib/validation";
import { useCreateGroup } from "@/hooks/queries/useGroups";
import { useToast } from "@/components/shared/toast";

const SUGGESTIONS = ["Friends Job Search Group", "Recent Graduates", "Cybersecurity Study Group"];

// Maps whatever createGroup() threw to copy a person can act on. Postgrest
// errors carry a `.code` (Postgres SQLSTATE, or "PGRST..." for API-layer
// issues); a plain network failure never reaches Postgrest at all, so it
// surfaces as a TypeError with no `.code`. Never shown: the raw
// Postgres/Postgrest message itself.
function describeCreateGroupError(err: unknown): string {
  if (err instanceof PostgrestError || (err && typeof err === "object" && "code" in err)) {
    const code = (err as { code?: string }).code;
    switch (code) {
      case "23505": // unique_violation
        return "You already have a group with this name.";
      case "42501": // insufficient_privilege (RLS)
        return "You don't have permission to create groups.";
      case "PGRST301": // JWT expired/invalid
        return "Please sign in again.";
      default:
        return "We couldn't create the group right now. Please try again.";
    }
  }
  if (err instanceof TypeError) {
    // fetch() rejects with a TypeError for DNS/offline/CORS-level failures —
    // the request never reached Supabase at all.
    return "Connection lost. Please try again.";
  }
  return "We couldn't create the group right now. Please try again.";
}

export function CreateGroupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createGroup = useCreateGroup();
  const { push } = useToast();
  const navigate = useNavigate();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: { name: "", description: "", weeklyGoalTarget: undefined },
  });
  // handleSubmit's own isSubmitting flips true synchronously for a real
  // submit, but a rapid double-click can still queue two calls before
  // React commits that state — this ref is checked immediately, so the
  // second click is a no-op instead of a second request (and a second
  // error toast if it fails).
  const submitGuardRef = React.useRef(false);

  function close(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function onSubmit(values: GroupFormValues) {
    if (submitGuardRef.current) return;
    submitGuardRef.current = true;
    try {
      const group = await createGroup.mutateAsync({
        name: values.name.trim(),
        description: values.description?.trim() || null,
        weekly_goal_target: values.weeklyGoalTarget ?? null,
      });
      push("Group created.", "success");
      close(false);
      navigate(`/app/groups/${group.id}`);
    } catch (err) {
      push(describeCreateGroupError(err), "error");
    } finally {
      submitGuardRef.current = false;
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a group</DialogTitle>
          <DialogDescription>Invite a few people to support each other through the job search.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="grp-name">Group name</Label>
            <Input
              id="grp-name"
              list="group-suggestions"
              placeholder="NYC Product Designers"
              {...register("name")}
              aria-invalid={!!errors.name}
            />
            <datalist id="group-suggestions">{SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="grp-description">Description (optional)</Label>
            <Textarea
              id="grp-description"
              rows={2}
              placeholder="Weekly accountability and interview prep."
              {...register("description")}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="grp-goal">Weekly application goal (optional)</Label>
            <Input id="grp-goal" type="number" min={1} placeholder="10" {...register("weeklyGoalTarget")} aria-invalid={!!errors.weeklyGoalTarget} />
            {errors.weeklyGoalTarget && <p className="text-xs text-destructive">{errors.weeklyGoalTarget.message}</p>}
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
