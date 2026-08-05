import type { ReactNode } from "react";
import { BotanicalAccent } from "@/components/ambient/BotanicalAccent";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl px-6 py-14 text-center", className)}>
      <BotanicalAccent className="pointer-events-none absolute -right-4 -top-6 h-32 w-24 rotate-12 opacity-60" />
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">{icon}</div>
      )}
      <div className="max-w-sm">
        <p className="font-display text-base font-semibold">{title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
