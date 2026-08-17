const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/** A quiet 7-day bar chart — applications sent per day. No axes, no legend, just a shape. */
export function MiniBarChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="flex items-end gap-2">
      {data.map((d) => {
        const dayIndex = new Date(`${d.date}T12:00:00`).getDay();
        const heightPct = Math.max(6, (d.count / max) * 100);
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex h-16 w-full items-end overflow-hidden rounded-md bg-muted/60">
              <div
                className="w-full rounded-md bg-gradient-to-t from-primary to-gold transition-all duration-500 ease-out"
                style={{ height: `${heightPct}%` }}
                title={`${d.count} on ${d.date}`}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{DAY_LABELS[dayIndex]}</span>
          </div>
        );
      })}
    </div>
  );
}
