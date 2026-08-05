import * as React from "react";
import { usePageVisible } from "@/hooks/useTheme";

/**
 * A quiet, decorative backdrop of slowly drifting color pools — like light
 * moving through frosted glass. Fixed behind all content, low opacity,
 * pointer-events disabled. Animation is CSS-only (cheap on mobile), pauses
 * when the tab isn't visible, and `motion-safe:` means it never animates at
 * all under prefers-reduced-motion (handled by Tailwind + the global rule
 * in index.css that also collapses the animation duration to ~0).
 */
export function AmbientBackground() {
  const visible = usePageVisible();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ animationPlayState: visible ? "running" : "paused" }}
    >
      <div
        className="motion-safe:animate-stream absolute left-1/2 top-[18%] hidden h-[18rem] w-[42rem] -translate-x-1/2 rounded-full opacity-[0.16] blur-3xl sm:block dark:opacity-[0.1]"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, hsl(var(--peach) / 0.18) 18%, hsl(var(--rose) / 0.16) 44%, hsl(var(--lavender) / 0.18) 72%, transparent 100%)",
          animationPlayState: visible ? "running" : "paused",
        }}
      />
      <div
        className="motion-safe:animate-drift-a absolute -left-[10%] -top-[15%] h-[55vmax] w-[55vmax] rounded-full opacity-[0.35] blur-3xl dark:opacity-[0.18]"
        style={{
          background: "radial-gradient(circle at 30% 30%, hsl(var(--peach) / 0.55), transparent 70%)",
          animationPlayState: visible ? "running" : "paused",
        }}
      />
      <div
        className="motion-safe:animate-drift-b absolute -right-[15%] top-[5%] h-[50vmax] w-[50vmax] rounded-full opacity-[0.3] blur-3xl dark:opacity-[0.16]"
        style={{
          background: "radial-gradient(circle at 60% 40%, hsl(var(--lavender) / 0.55), transparent 70%)",
          animationPlayState: visible ? "running" : "paused",
        }}
      />
      <div
        className="motion-safe:animate-drift-c absolute bottom-[-20%] left-[15%] h-[60vmax] w-[60vmax] rounded-full opacity-[0.28] blur-3xl dark:opacity-[0.14]"
        style={{
          background: "radial-gradient(circle at 50% 50%, hsl(var(--rose) / 0.5), transparent 70%)",
          animationPlayState: visible ? "running" : "paused",
        }}
      />
    </div>
  );
}
