import * as React from "react";
import { parseISO } from "date-fns";
import { NotebookPen, Plus } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { PageContent, PageContainer } from "@/components/layout/PageContent";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { JournalComposer } from "@/components/journal/JournalComposer";
import { JournalEntryCard } from "@/components/journal/JournalEntryCard";
import { useJournalEntries } from "@/hooks/queries/useJournal";
import { groupByRecency, DATE_GROUP_ORDER } from "@/lib/dateGroups";
import type { JournalEntry } from "@/types/database";

// A record for the person keeping it, not an audience. No likes, no
// comments, no follower count — just today, and the days before it.
export default function Journal() {
  const { data: entries = [], isLoading, isError, refetch } = useJournalEntries();
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [editingEntry, setEditingEntry] = React.useState<JournalEntry | null>(null);

  const groups = React.useMemo(() => groupByRecency(entries, (e) => parseISO(e.entry_date)), [entries]);
  const hasEntries = entries.length > 0;

  function openNew() {
    setEditingEntry(null);
    setComposerOpen(true);
  }
  function openEdit(entry: JournalEntry) {
    setEditingEntry(entry);
    setComposerOpen(true);
  }

  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        title="Journal"
        subtitle="A quiet place to document your search, for yourself"
        action={
          <Button onClick={openNew} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New entry</span>
          </Button>
        }
      />

      <PageContent className="pb-16">
        <PageContainer className="max-w-2xl">
          {isError ? (
            <ErrorState description="Your journal couldn't load. Your entries are safe — try again." onRetry={() => refetch()} />
          ) : isLoading ? (
            <div className="grid gap-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
            </div>
          ) : !hasEntries ? (
            <EmptyState
              icon={<NotebookPen className="h-5 w-5" />}
              title="Your journal is empty"
              description="Start with how today felt. Even a sentence counts."
              action={<Button onClick={openNew}><Plus className="h-4 w-4" /> Write your first entry</Button>}
            />
          ) : (
            <div className="grid gap-6">
              {DATE_GROUP_ORDER.filter((key) => (groups.get(key)?.length ?? 0) > 0).map((key) => (
                <section key={key}>
                  <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{key}</h2>
                  <div className="divide-y divide-border/40">
                    {groups.get(key)!.map((entry) => (
                      <JournalEntryCard key={entry.id} entry={entry} onEdit={() => openEdit(entry)} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </PageContainer>
      </PageContent>

      <JournalComposer open={composerOpen} onOpenChange={setComposerOpen} entry={editingEntry} />
    </div>
  );
}
