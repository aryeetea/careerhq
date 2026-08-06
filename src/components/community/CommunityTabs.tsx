import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CommunityTabItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Small count badge — used for Invites so people notice something's
   * waiting on them without having to open the tab first. */
  count?: number;
}

// Route-backed tabs rather than local state: each tab is a real,
// bookmarkable URL under the same CommunityLayout, so switching between
// Friends / Groups / Invites only swaps the Outlet's content — the layout
// (header, tab bar) never remounts and nothing does a full page reload.
export function CommunityTabs({ items }: { items: CommunityTabItem[] }) {
  return (
    <nav
      aria-label="Community sections"
      className="flex gap-1.5 overflow-x-auto rounded-2xl border border-border/70 bg-secondary/70 p-1.5 shadow-soft"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-150",
              isActive
                ? "bg-card text-foreground shadow-soft ring-1 ring-primary/10"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
            )
          }
        >
          <item.icon className="h-4 w-4" />
          {item.label}
          {Boolean(item.count) && (
            <span className="flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {item.count}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
