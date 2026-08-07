import type { ReactNode } from "react";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { UserMenu } from "@/components/layout/UserMenu";

export function TopBar({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="glass-subtle sticky top-0 z-30 flex items-start justify-between gap-4 px-4 pb-5 pt-4 sm:px-8 sm:pb-6 sm:pt-5 lg:px-10 lg:pb-7 lg:pt-6">
      <div className="min-w-0">
        <h1 className="truncate font-display text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-2 hidden text-sm text-muted-foreground sm:block">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 pt-0.5 sm:gap-2">
        {action}
        <NotificationBell />
        <UserMenu />
      </div>
    </div>
  );
}
