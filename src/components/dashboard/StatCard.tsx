import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Card's own classes (rounded-2xl border border-border bg-card
// text-card-foreground shadow-soft) plus interactive affordances — applied
// directly to the Link below since Card itself is a plain div with no
// asChild/Slot support, so it can't be the interactive element itself.
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

/** Every stat on the Dashboard is a jumping-off point to a dedicated page
 * showing the roles behind the number (see DashboardStatDetail, one page
 * driven by a ":kind" route param), not just a static readout. `to` is
 * that page's path; omitting it keeps the old static, non-interactive
 * card for any future stat that doesn't have one. */
export function StatCard({
  icon,
  label,
  value,
  accent,
  to,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  accent?: string;
  to?: string;
}) {
  if (to) {
    return (
      <Link to={to} className={interactiveCardClassName}>
        <StatCardBody icon={icon} label={label} value={value} accent={accent} />
      </Link>
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
