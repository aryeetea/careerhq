import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "@/components/layout/nav";
import { BrandMark } from "@/components/shared/BrandMark";
import { cn } from "@/lib/utils";

export function Sidebar() {
  return (
    <aside className="glass-subtle sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r-0 px-3 pb-4 pt-6 lg:flex">
      <div className="mb-6 flex items-center gap-2 px-2">
        <BrandMark size="md" />
        <span className="font-display text-[15px] font-semibold tracking-tight">Bloom</span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/app"}
            data-tour={`nav-${item.tourId}`}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <p className="px-2.5 text-[11px] leading-relaxed text-muted-foreground/70">
        One step at a time. You're doing better than it feels.
      </p>
    </aside>
  );
}
