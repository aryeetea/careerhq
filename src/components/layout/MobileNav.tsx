import { NavLink, useNavigate } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { NAV_ITEMS } from "@/components/layout/nav";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const navigate = useNavigate();
  const primary = NAV_ITEMS.filter((i) => i.primary);
  const rest = NAV_ITEMS.filter((i) => !i.primary);

  return (
    <nav className="glass-strong fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 flex items-center justify-around rounded-full px-2 py-1.5 lg:hidden">
      {primary.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/app"}
          data-tour={`nav-${item.tourId}`}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-[10px] font-medium transition-colors",
              isActive ? "text-primary" : "text-muted-foreground"
            )
          }
        >
          <item.icon className="h-5 w-5" />
          {item.label}
        </NavLink>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-[10px] font-medium text-muted-foreground outline-none">
          <MoreHorizontal className="h-5 w-5" />
          More
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="mb-2">
          {rest.map((item) => (
            <DropdownMenuItem key={item.to} data-tour={`nav-${item.tourId}`} onSelect={() => navigate(item.to)}>
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
