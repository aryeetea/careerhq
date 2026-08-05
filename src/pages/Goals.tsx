import * as React from "react";
import { Plus, Target } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalCard } from "@/components/goals/GoalCard";
import { CreateGoalDialog } from "@/components/goals/CreateGoalDialog";
import { useGoals } from "@/hooks/queries/useGoals";
import { ENCOURAGING_EMPTY_MESSAGES } from "@/lib/constants";

export default function Goals() {
  const { data: goals = [], isLoading } = useGoals();
  const [createOpen, setCreateOpen] = React.useState(false);

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
      <div className="flex-1 overflow-y-auto px-4 pb-10 sm:px-8">
        {isLoading ? (
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
            {goals.map((g) => <GoalCard key={g.id} goal={g} />)}
          </div>
        )}
      </div>
      <CreateGoalDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
