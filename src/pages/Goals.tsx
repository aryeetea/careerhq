import * as React from "react";
import { Plus, Target } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { PageContent, PageContainer } from "@/components/layout/PageContent";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalCard } from "@/components/goals/GoalCard";
import { CreateGoalDialog } from "@/components/goals/CreateGoalDialog";
import { useGoals } from "@/hooks/queries/useGoals";
import { ENCOURAGING_EMPTY_MESSAGES } from "@/lib/constants";

// How long a freshly-created goal's card stays highlighted before settling
// in with the rest of the list.
const HIGHLIGHT_MS = 2500;

export default function Goals() {
  const { data: goals = [], isLoading, isError, refetch } = useGoals();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [justCreatedId, setJustCreatedId] = React.useState<string | null>(null);

  function handleCreated(goal: { id: string }) {
    setJustCreatedId(goal.id);
    window.setTimeout(() => setJustCreatedId((current) => (current === goal.id ? null : current)), HIGHLIGHT_MS);
  }

  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        title="Goals"
        subtitle="Small, doable targets — alone or with friends"
        action={
          <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New goal</span>
          </Button>
        }
      />
      <PageContent>
        <PageContainer>
        {isError ? (
          <ErrorState description="Your goals couldn't load. Your data is safe — try again." onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
          </div>
        ) : goals.length === 0 ? (
          <EmptyState
            icon={<Target className="h-5 w-5" />}
            title="No goals yet"
            description={ENCOURAGING_EMPTY_MESSAGES.noGoals}
            action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Set a goal</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {goals.map((g) => <GoalCard key={g.id} goal={g} highlighted={g.id === justCreatedId} />)}
          </div>
        )}
        </PageContainer>
      </PageContent>
      <CreateGoalDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={handleCreated} />
    </div>
  );
}
