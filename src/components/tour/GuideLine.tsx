import * as React from "react";
import { buildGuidePath } from "@/lib/tour/path";
import type { ConnectorPoint } from "@/lib/tour/position";

/**
 * A thin, gently curved connector line that draws itself from the tour card
 * to the spotlighted element — meant to be rendered inside a full-viewport
 * `<svg>` (see TourOverlay). Uses the classic stroke-dashoffset technique so
 * the line appears to be sketched on, rather than popping in.
 */
export function GuideLine({ from, to, seed }: { from: ConnectorPoint; to: ConnectorPoint; seed: string }) {
  const pathRef = React.useRef<SVGPathElement>(null);
  const [length, setLength] = React.useState(0);
  const [drawn, setDrawn] = React.useState(false);
  const d = buildGuidePath(from, to, seed);

  React.useLayoutEffect(() => {
    setDrawn(false);
    const el = pathRef.current;
    if (!el) return;
    setLength(el.getTotalLength());
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, [d]);

  return (
    <path
      ref={pathRef}
      d={d}
      fill="none"
      stroke="hsl(var(--primary) / 0.5)"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeDasharray={length || 1}
      strokeDashoffset={drawn ? 0 : length || 1}
      style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.16, 1, 0.3, 1)" }}
    />
  );
}
