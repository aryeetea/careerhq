import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export interface UpcomingRow {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  onClick?: () => void;
  /** An optional trailing action — the follow-up checkmark, for rows that
   * have one. Interview rows simply don't pass this. */
  action?: ReactNode;
}

export function UpcomingList({ title, rows, emptyMessage, icon }: { title: string; rows: UpcomingRow[]; emptyMessage: string; icon?: ReactNode }) {
  return (
    <Card className="glass-subtle border-border/60">
      <CardContent className="p-4">
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
          {icon}
          {title}
        </h3>
        {rows.length === 0 ? (
          <p className="py-7 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-2">
                <button onClick={r.onClick} className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2.5 text-left text-sm transition-colors hover:text-primary">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(r.date)}</span>
                </button>
                {r.action}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
