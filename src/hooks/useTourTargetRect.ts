import * as React from "react";

export interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// The same data-tour value can exist twice at once (e.g. a nav link rendered
// in both the desktop Sidebar and the mobile bottom bar) — whichever one is
// actually on screen (non-zero size) wins. An element that's hidden via
// Tailwind's `hidden` utility reports a zero-size rect, so this doubles as
// the mechanism that lets steps gracefully skip elements that don't exist
// at the current viewport (see the fallback-to-centered behavior in
// TourOverlay when this hook returns null).
function findVisibleTarget(selector: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(selector);
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return node;
  }
  return null;
}

function readRect(el: HTMLElement): TargetRect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * Tracks the live viewport position of a tour target. Scrolls it into a
 * comfortable, centered position the moment it's requested (the tour's
 * "camera pan"), then keeps measuring through the scroll animation and
 * afterward via resize/scroll listeners and a ResizeObserver, since
 * scrollIntoView has no completion callback to hook into.
 *
 * Returns null while `active` is false, while there's no selector (a
 * centered step), or when nothing on screen currently matches the selector.
 */
export function useTourTargetRect(selector: string | undefined, active: boolean): TargetRect | null {
  const [rect, setRect] = React.useState<TargetRect | null>(null);

  React.useEffect(() => {
    if (!active || !selector) {
      setRect(null);
      return;
    }

    let cancelled = false;
    let raf = 0;
    let resizeObserver: ResizeObserver | null = null;

    function measure() {
      const el = findVisibleTarget(selector!);
      setRect(el ? readRect(el) : null);
    }

    const initialEl = findVisibleTarget(selector);
    initialEl?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

    // Re-measure every frame for ~0.6s to track the smooth-scroll animation,
    // then settle into passive listeners below.
    let ticks = 0;
    function tick() {
      if (cancelled) return;
      measure();
      ticks += 1;
      if (ticks < 40) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    if (initialEl && "ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(measure);
      resizeObserver.observe(initialEl);
    }

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [selector, active]);

  return rect;
}
