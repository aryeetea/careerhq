import type { LucideIcon } from "lucide-react";

export interface TourStep {
  id: string;
  /** CSS selector for the element to softly spotlight. Omitted = a centered
   * card with no target — used for the welcome and finale steps. */
  target?: string;
  icon: LucideIcon;
  title: string;
  body: string;
  /** Preferred side for the card relative to the target. Falls back
   * automatically (see lib/tour/position.ts) if it would go off-screen. */
  placement?: "top" | "bottom" | "left" | "right";
  /** Extra breathing room between the spotlight and the element it outlines. */
  spotlightPadding?: number;
}

export interface Tour {
  id: string;
  steps: TourStep[];
}
