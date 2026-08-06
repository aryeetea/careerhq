import { KanbanSquare, LayoutList, Calendar, GanttChartSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export type ApplicationsView = "board" | "list" | "calendar" | "timeline";

const VIEWS: { id: ApplicationsView; label: string; icon: typeof KanbanSquare; comingSoon?: boolean }[] = [
  { id: "board", label: "Board", icon: KanbanSquare },
  { id: "list", label: "List", icon: LayoutList },
  { id: "calendar", label: "Calendar", icon: Calendar, comingSoon: true },
  { id: "timeline", label: "Timeline", icon: GanttChartSquare, comingSoon: true },
];

// Board is still the default way in — the Kanban itself is unchanged —
// this just gives Applications room to grow into other ways of seeing the
// same roles without needing a new top-level page for each one.
export function ViewSwitcher({ value, onChange }: { value: ApplicationsView; onChange: (view: ApplicationsView) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-secondary/70 p-1 shadow-soft">
      {VIEWS.map((view) => (
        <button
          key={view.id}
          type="button"
          onClick={() => onChange(view.id)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-semibold transition-all duration-150",
            value === view.id
              ? "bg-card text-foreground shadow-soft ring-1 ring-primary/10"
              : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
          )}
        >
          <view.icon className="h-3.5 w-3.5" />
          {view.label}
          {view.comingSoon && (
            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              Soon
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
