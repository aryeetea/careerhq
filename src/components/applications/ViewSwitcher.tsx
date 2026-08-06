import { KanbanSquare, LayoutList, Calendar, GanttChartSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export type ApplicationsView = "board" | "list" | "calendar" | "timeline";

const VIEWS: { id: ApplicationsView; label: string; icon: typeof KanbanSquare }[] = [
  { id: "board", label: "Board", icon: KanbanSquare },
  { id: "list", label: "List", icon: LayoutList },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "timeline", label: "Timeline", icon: GanttChartSquare },
];

// Four ways of looking at the same roles, not four datasets — Board is
// still the default way in, the Kanban itself is unchanged, and switching
// views never re-fetches anything (see Applications.tsx).
export function ViewSwitcher({ value, onChange }: { value: ApplicationsView; onChange: (view: ApplicationsView) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-secondary/70 p-1 shadow-soft">
      {VIEWS.map((view) => (
        <button
          key={view.id}
          type="button"
          onClick={() => onChange(view.id)}
          aria-current={value === view.id ? "true" : undefined}
          className={cn(
            "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-semibold transition-all duration-150",
            value === view.id
              ? "bg-card text-foreground shadow-soft ring-1 ring-primary/10"
              : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
          )}
        >
          <view.icon className="h-3.5 w-3.5" />
          {view.label}
        </button>
      ))}
    </div>
  );
}
