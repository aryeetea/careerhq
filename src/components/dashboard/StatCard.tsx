import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Card's own classes (rounded-2xl border border-border bg-card
// text-card-foreground shadow-soft) plus interactive affordances — applied
// directly to the Link/button below since Card itself is a plain div with
// no asChild/Slot support, so it can't be the interactive element itself.
const interactiveCardClassName =
  "hover-lift glass-subtle block w-full rounded-2xl border border-border/60 bg-card text-left text-card-foreground shadow-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function StatCardBody({ icon: Icon, label, value, accent }: { icon: LucideIcon; label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", accent ?? "bg-secondary")}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="font-mono text-xl font-semibold leading-none tabular-nums">{value}</p>
        <p className="mt-1.5 truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/** Every stat on the Dashboard is a jumping-off point to the roles behind
 * the number, not just a static readout — `to` (with optional router
 * `state`, e.g. an initial status filter for Applications) navigates
 * there, `onClick` handles anything that stays on this page (like
 * scrolling to a section below). Exactly one of the two is expected;
 * omitting both keeps the old static, non-interactive card. */
export function StatCard({
  icon,
  label,
  value,
  accent,
  to,
  state,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  accent?: string;
  to?: string;
  state?: Record<string, unknown>;
  onClick?: () => void;
}) {
  if (to) {
    return (
      <Link to={to} state={state} className={interactiveCardClassName}>
        <StatCardBody icon={icon} label={label} value={value} accent={accent} />
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={interactiveCardClassName}>
        <StatCardBody icon={icon} label={label} value={value} accent={accent} />
      </button>
    );
  }

  return (
    <Card className="hover-lift glass-subtle border-border/60">
      <CardContent className="p-0">
        <StatCardBody icon={icon} label={label} value={value} accent={accent} />
      </CardContent>
    </Card>
  );
}
