import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, KanbanSquare, FileText, GraduationCap, Users2, Target, UsersRound, Settings, UserRound } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the compact bottom bar on mobile. */
  primary?: boolean;
  /** Stable id for `data-tour="nav-<id>"` — independent of `to` so a route
   * rename never silently breaks a tour step's target selector. */
  tourId: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, primary: true, tourId: "dashboard" },
  { to: "/app/board", label: "Board", icon: KanbanSquare, primary: true, tourId: "board" },
  { to: "/app/profile", label: "Profile", icon: UserRound, tourId: "profile" },
  { to: "/app/resumes", label: "Resumes", icon: FileText, primary: true, tourId: "resumes" },
  { to: "/app/certifications", label: "Certifications", icon: GraduationCap, tourId: "certifications" },
  { to: "/app/goals", label: "Goals", icon: Target, tourId: "goals" },
  { to: "/app/friends", label: "Friends", icon: Users2, primary: true, tourId: "friends" },
  { to: "/app/groups", label: "Groups", icon: UsersRound, tourId: "groups" },
  { to: "/app/settings", label: "Settings", icon: Settings, tourId: "settings" },
];
