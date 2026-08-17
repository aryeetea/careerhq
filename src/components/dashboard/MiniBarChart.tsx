const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** A quiet 7-day bar chart — applications sent per day, Monday through
 * Sunday of the current week (see stats.ts' thisWeekDays). Days later in
 * the week that haven't happened yet render as a faint placeholder rather
 * than an equal-looking empty bar — otherwise "hasn't happened yet" and
 * "you applied to nothing that day" look identical. */
export function MiniBarChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const todayKey = localDayKey(new Date());

  return (
    <div className="flex items-end gap-2">
      {data.map((d) => {
        const dayIndex = new Date(`${d.date}T12:00:00`).getDay();
        const isFuture = d.date > todayKey;
        const heightPct = Math.max(6, (d.count / max) * 100);
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex h-16 w-full items-end overflow-hidden rounded-md bg-muted/60">
              {!isFuture && (
                <div
                  className="w-full rounded-md bg-gradient-to-t from-primary to-gold transition-all duration-500 ease-out"
                  style={{ height: `${heightPct}%` }}
                  title={`${d.count} on ${d.date}`}
                />
              )}
            </div>
            <span className={`text-[10px] ${isFuture ? "text-muted-foreground/40" : "text-muted-foreground"}`}>
              {DAY_LABELS[dayIndex]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
