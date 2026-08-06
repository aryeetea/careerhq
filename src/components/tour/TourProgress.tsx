import { Flower2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** A small row of blooming flowers standing in for "Step 3 of 7" — filled
 * for steps already seen, glowing for the current one, an open outline for
 * what's ahead. */
export function TourProgress({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1" role="progressbar" aria-valuenow={current + 1} aria-valuemin={1} aria-valuemax={total}>
      {Array.from({ length: total }).map((_, i) => (
        <Flower2
          key={i}
          fill={i <= current ? "currentColor" : "none"}
          className={cn(
            "h-3 w-3 transition-all duration-500 ease-out",
            i === current
              ? "scale-110 text-primary drop-shadow-[0_0_4px_hsl(var(--primary)/0.55)]"
              : i < current
              ? "text-primary/55"
              : "text-border"
          )}
        />
      ))}
    </div>
  );
}
