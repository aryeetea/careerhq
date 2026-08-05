import type { ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shown when a query fails (network drop, RLS denial, server error) instead
 * of silently rendering an empty list forever. Pair with `isError`/`refetch`
 * from the query hook.
 */
export function ErrorState({
  title = "Something went wrong",
  description = "That didn't load. Check your connection and try again — your data is safe.",
  onRetry,
  className,
  icon,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-14 text-center",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        {icon ?? <AlertTriangle className="h-5 w-5" />}
      </div>
      <div className="max-w-sm">
        <p className="font-display text-base font-semibold">{title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1 gap-1.5">
          <RotateCw className="h-3.5 w-3.5" /> Try again
        </Button>
      )}
    </div>
  );
}
