import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, KanbanSquare, FileText, GraduationCap, Users2, Target, UsersRound, Settings } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the compact bottom bar on mobile. */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, primary: true },
  { to: "/app/board", label: "Board", icon: KanbanSquare, primary: true },
  { to: "/app/resumes", label: "Resumes", icon: FileText, primary: true },
  { to: "/app/certifications", label: "Certifications", icon: GraduationCap },
  { to: "/app/goals", label: "Goals", icon: Target },
  { to: "/app/friends", label: "Friends", icon: Users2, primary: true },
  { to: "/app/groups", label: "Groups", icon: UsersRound },
  { to: "/app/settings", label: "Settings", icon: Settings },
];
