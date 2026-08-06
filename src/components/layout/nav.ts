import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, KanbanSquare, FileText, GraduationCap, Handshake, Target, Settings, UserRound, NotebookPen } from "lucide-react";

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

// Friends and Groups used to be two separate top-level destinations even
// though people think of them as one thing — "who I'm connected to on
// Bloom." They're now one Community item (see src/pages/community/), with
// Friends / Groups / Invites as tabs inside it. Board is now Applications —
// the feature, not one particular view of it (Board is still the default
// view, alongside List, with Calendar and Timeline reserved for later).
export const NAV_ITEMS: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, primary: true, tourId: "dashboard" },
  { to: "/app/applications", label: "Applications", icon: KanbanSquare, primary: true, tourId: "applications" },
  { to: "/app/resumes", label: "Resumes", icon: FileText, primary: true, tourId: "resumes" },
  { to: "/app/certifications", label: "Certifications", icon: GraduationCap, tourId: "certifications" },
  { to: "/app/goals", label: "Goals", icon: Target, tourId: "goals" },
  { to: "/app/journal", label: "Journal", icon: NotebookPen, tourId: "journal" },
  { to: "/app/community", label: "Community", icon: Handshake, primary: true, tourId: "community" },
  { to: "/app/profile", label: "Profile", icon: UserRound, tourId: "profile" },
  { to: "/app/settings", label: "Settings", icon: Settings, tourId: "settings" },
];
