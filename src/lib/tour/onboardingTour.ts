import { Flower2, LayoutDashboard, Plus, KanbanSquare, FileText, UserRound, Users2 } from "lucide-react";
import type { Tour } from "@/lib/tour/types";

// The six teaching steps stay on the dashboard route the whole time and
// point at things that are always mounted there (the top-bar action, the
// sidebar / bottom-nav links) rather than forcing a click-through of every
// page. That sidesteps a whole category of flakiness — a page mid-navigation
// showing a loading skeleton or an unrelated empty state when the tour
// tries to spotlight it — and matches how Linear, Arc, and Notion introduce
// their shell: a light pass over the destinations, not a forced tour of
// each one's contents.
export const onboardingTour: Tour = {
  id: "onboarding",
  steps: [
    {
      id: "welcome",
      icon: Flower2,
      title: "Welcome to Bloom",
      body: "A quick look around, about thirty seconds. Skip anytime, or replay this later from Settings.",
    },
    {
      id: "dashboard",
      target: '[data-tour="dashboard-overview"]',
      icon: LayoutDashboard,
      title: "Your dashboard",
      body: "Everything important lives here. We'll keep it updated automatically as you apply.",
      placement: "bottom",
    },
    {
      id: "add-job",
      target: '[data-tour="add-job-button"]',
      icon: Plus,
      title: "Add your first role",
      body: "This is where your opportunities come together. Save one the moment you find it. Details can wait.",
      placement: "bottom",
    },
    {
      id: "board",
      target: '[data-tour="nav-board"]',
      icon: KanbanSquare,
      title: "The Bloom Board",
      body: "We'll keep track of your applications for you. Drag a role forward as things move.",
      placement: "right",
    },
    {
      id: "resumes",
      target: '[data-tour="nav-resumes"]',
      icon: FileText,
      title: "Resume Manager",
      body: "Keep every version in one place. Bloom uses them to help you apply well.",
      placement: "right",
    },
    {
      id: "profile",
      target: '[data-tour="nav-profile"]',
      icon: UserRound,
      title: "Your profile",
      body: "Your progress lives here too. Goals, momentum, and what you choose to share.",
      placement: "right",
    },
    {
      id: "friends",
      target: '[data-tour="nav-friends"]',
      icon: Users2,
      title: "Friends & Groups",
      body: "Invite people who'll cheer you on. Nothing private is ever shared automatically.",
      placement: "right",
    },
    {
      id: "finale",
      icon: Flower2,
      title: "You're all set.",
      body: "Welcome to Bloom. Let's grow your career together.",
    },
  ],
};
