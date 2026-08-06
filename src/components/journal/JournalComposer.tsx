import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { journalEntryFormSchema, type JournalEntryFormValues } from "@/lib/validation";
import { useCreateJournalEntry, useUpdateJournalEntry } from "@/hooks/queries/useJournal";
import { useGroups } from "@/hooks/queries/useGroups";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/shared/toast";
import { JOURNAL_MOOD_META, JOURNAL_VISIBILITY_META } from "@/lib/constants";
import { cn, toDateInputValue } from "@/lib/utils";
import type { JournalEntry, JournalMood, JournalVisibility } from "@/types/database";

const MOODS = Object.keys(JOURNAL_MOOD_META) as JournalMood[];
const VISIBILITIES = Object.keys(JOURNAL_VISIBILITY_META) as JournalVisibility[];

// One form for both new entries and edits — documenting today is the
// common case, so it opens ready to write, with everything else (mood,
// who can see it, the date) as quiet, optional choices underneath.
export function JournalComposer({
  open,
  onOpenChange,
  entry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: JournalEntry | null;
}) {
  const isEditing = Boolean(entry);
  const { user } = useAuth();
  const createEntry = useCreateJournalEntry();
  const updateEntry = useUpdateJournalEntry();
  const { data: groups = [] } = useGroups();
  const { push } = useToast();
  const submitGuardRef = React.useRef(false);
  const draftKey = user ? `bloom:journal-draft:${user.id}:${entry?.id ?? "new"}` : null;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<JournalEntryFormValues>({
    resolver: zodResolver(journalEntryFormSchema),
    defaultValues: {
      title: "",
      body: "",
      mood: "",
      visibility: "private",
      groupId: "",
      entryDate: toDateInputValue(new Date().toISOString()),
    },
  });

  React.useEffect(() => {
    if (!open) return;
    const fallbackValues = {
      title: entry?.title ?? "",
      body: entry?.body ?? "",
      mood: entry?.mood ?? "",
      visibility: entry?.visibility ?? "private",
      groupId: entry?.group_id ?? "",
      entryDate: toDateInputValue(entry?.entry_date ?? new Date().toISOString()),
    };

    if (!draftKey) {
      reset(fallbackValues);
      return;
    }

    try {
      const savedDraft = window.localStorage.getItem(draftKey);
      if (savedDraft) {
        reset({ ...fallbackValues, ...JSON.parse(savedDraft) });
        return;
      }
    } catch {
      // Ignore malformed draft data and fall back to the saved entry/defaults.
    }

    reset(fallbackValues);
  }, [open, entry, reset, draftKey]);

  const mood = watch("mood");
  const visibility = watch("visibility");
  const watchedValues = watch();

  React.useEffect(() => {
    if (!open || !draftKey) return;

    const hasMeaningfulContent =
      (watchedValues.title ?? "").trim().length > 0 ||
      watchedValues.body.trim().length > 0 ||
      (watchedValues.mood ?? "").trim().length > 0 ||
      watchedValues.visibility !== "private" ||
      (watchedValues.groupId ?? "").trim().length > 0;

    const timer = window.setTimeout(() => {
      try {
        if (!hasMeaningfulContent) {
          window.localStorage.removeItem(draftKey);
          return;
        }
        window.localStorage.setItem(draftKey, JSON.stringify(watchedValues));
      } catch {
        // Draft persistence is best-effort; editing should continue even if storage fails.
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [open, draftKey, watchedValues]);

  async function onSubmit(values: JournalEntryFormValues) {
    if (submitGuardRef.current) return;
    submitGuardRef.current = true;
    try {
      const payload = {
        title: values.title?.trim() || null,
        body: values.body.trim(),
        mood: (values.mood || null) as JournalMood | null,
        visibility: values.visibility,
        group_id: values.visibility === "group" ? values.groupId || null : null,
        entry_date: values.entryDate,
      };
      if (isEditing && entry) {
        await updateEntry.mutateAsync({ id: entry.id, patch: payload });
        push("Your entry has been updated.", "success");
      } else {
        await createEntry.mutateAsync(payload);
        push("Your entry has been saved.", "success");
      }
      if (draftKey) {
        try {
          window.localStorage.removeItem(draftKey);
        } catch {
          // Ignore draft cleanup failures.
        }
      }
      onOpenChange(false);
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't save that entry. Please try again.", "error");
    } finally {
      submitGuardRef.current = false;
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit entry" : "New journal entry"}</DialogTitle>
          <DialogDescription>A few honest lines are enough. Nothing here is shared unless you choose to share it.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="j-title">Title (optional)</Label>
            <Input id="j-title" placeholder="Finished my portfolio" {...register("title")} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="j-body">What's on your mind?</Label>
            <AutoResizeTextarea
              id="j-body"
              minRows={4}
              maxHeight={280}
              placeholder="What felt important today?"
              value={watchedValues.body}
              onChange={(event) => setValue("body", event.target.value, { shouldDirty: true, shouldValidate: true })}
              aria-invalid={!!errors.body}
              error={!!errors.body}
            />
            {errors.body && <p className="text-xs text-destructive">{errors.body.message}</p>}
          </div>

          <div className="grid gap-1.5">
            <Label>How are you feeling?</Label>
            <div className="flex flex-wrap gap-1.5">
              {MOODS.map((m) => {
                const meta = JOURNAL_MOOD_META[m];
                const active = mood === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setValue("mood", active ? "" : m, { shouldDirty: true })}
                    aria-pressed={active}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                      active ? "border-primary/40 bg-primary/10 text-primary" : "border-border/70 bg-card/70 text-foreground/78 hover:border-primary/25"
                    )}
                  >
                    <span aria-hidden="true">{meta.emoji}</span> {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="j-date">Date</Label>
              <Input id="j-date" type="date" {...register("entryDate")} />
            </div>
            <div className="grid gap-1.5">
              <Label>Who can see this</Label>
              <Select value={visibility} onValueChange={(v) => setValue("visibility", v as JournalVisibility, { shouldDirty: true })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VISIBILITIES.map((v) => (
                    <SelectItem key={v} value={v}>{JOURNAL_VISIBILITY_META[v].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {visibility === "group" && (
            <div className="grid gap-1.5">
              <Label>Which group</Label>
              {groups.length === 0 ? (
                <p className="text-xs text-muted-foreground">You're not in a group yet — start one from Community.</p>
              ) : (
                <Select value={watch("groupId")} onValueChange={(v) => setValue("groupId", v, { shouldDirty: true })}>
                  <SelectTrigger><SelectValue placeholder="Choose a group" /></SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {(() => {
              const Icon = JOURNAL_VISIBILITY_META[visibility].icon;
              return <Icon className="h-3.5 w-3.5" />;
            })()}
            {JOURNAL_VISIBILITY_META[visibility].description}
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : isEditing ? "Save changes" : "Save entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
