import * as React from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { JOURNAL_MOOD_META, JOURNAL_VISIBILITY_META } from "@/lib/constants";
import { useDeleteJournalEntry } from "@/hooks/queries/useJournal";
import { useToast } from "@/components/shared/toast";
import { cn } from "@/lib/utils";
import type { JournalEntry } from "@/types/database";

// Compact, text-forward, no engagement chrome — this is a page in a
// journal, not a post. Mood is the one visual anchor.
export function JournalEntryCard({ entry, onEdit }: { entry: JournalEntry; onEdit: () => void }) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const deleteEntry = useDeleteJournalEntry();
  const { push } = useToast();
  const moodMeta = entry.mood ? JOURNAL_MOOD_META[entry.mood] : null;
  const visibilityMeta = JOURNAL_VISIBILITY_META[entry.visibility];
  const VisibilityIcon = visibilityMeta.icon;

  return (
    <div className="group flex gap-3 py-3">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base",
          moodMeta ? "bg-primary/10" : "bg-secondary text-muted-foreground"
        )}
        aria-hidden="true"
      >
        {moodMeta?.emoji ?? "📝"}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {entry.title && <p className="truncate text-sm font-semibold">{entry.title}</p>}
            <p className={cn("whitespace-pre-line text-sm leading-6 text-foreground/85", !entry.title && "font-medium")}>
              {entry.body}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="rounded-full p-1 text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-secondary group-hover:opacity-100 focus-visible:opacity-100"
              aria-label="Entry actions"
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setConfirmDelete(true)} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <VisibilityIcon className="h-3 w-3" />
          {visibilityMeta.label}
        </p>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this entry?"
        description="This can't be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          await deleteEntry.mutateAsync(entry.id);
          push("Entry deleted.", "info");
        }}
      />
    </div>
  );
}
