import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDailyEncouragement } from "@/hooks/queries/useDailyEncouragement";

/** A quiet, AI-written note grounded in today's real activity (streak,
 * applications this week vs. goal, recent status changes) — see
 * generate-daily-encouragement and useDailyEncouragement. "dashboard" is a
 * punchy one-liner at the top of the Dashboard; "profile" is a slightly
 * warmer note next to the user's own "Today's thought" on Profile. Never
 * load-bearing: a slow or failed AI call just renders nothing rather than
 * an error box, so it can never make either page feel broken. */
export function DailyEncouragement({ variant }: { variant: "dashboard" | "profile" }) {
  const { data, isLoading, isError } = useDailyEncouragement();

  if (isError) return null;

  if (isLoading) {
    return variant === "dashboard" ? <Skeleton className="h-[52px] rounded-2xl" /> : <Skeleton className="h-5 w-2/3 rounded-md" />;
  }

  const message = variant === "dashboard" ? data?.dashboardMessage : data?.profileMessage;
  if (!message) return null;

  if (variant === "dashboard") {
    return (
      <Card className="glass-subtle border-border/60 bg-card/50">
        <CardContent className="flex items-center gap-2.5 px-4 py-3">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm font-medium leading-6">{message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <p className="flex items-start gap-1.5 text-sm leading-6 text-foreground/80">
      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      <span>{message}</span>
    </p>
  );
}
