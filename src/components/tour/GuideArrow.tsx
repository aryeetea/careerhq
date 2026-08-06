import * as React from "react";
import type { ConnectorPoint } from "@/lib/tour/position";

/**
 * A tiny, open hand-drawn arrowhead — a chevron, not a filled triangle —
 * positioned at `point` and rotated to match the guide line's direction.
 * Meant to be rendered inside the same `<svg>` as GuideLine.
 */
export function GuideArrow({ point, angleDeg }: { point: ConnectorPoint; angleDeg: number }) {
  const [drawn, setDrawn] = React.useState(false);

  React.useEffect(() => {
    setDrawn(false);
    const t = window.setTimeout(() => setDrawn(true), 550);
    return () => window.clearTimeout(t);
  }, [point.x, point.y, angleDeg]);

  return (
    <g
      transform={`translate(${point.x}, ${point.y}) rotate(${angleDeg})`}
      style={{
        opacity: drawn ? 1 : 0,
        transform: drawn ? "scale(1)" : "scale(0.6)",
        transformOrigin: "center",
        transition: "opacity 0.25s ease-out, transform 0.25s cubic-bezier(0.34, 1.4, 0.64, 1)",
      }}
    >
      <path
        d="M -7 -6 L 0 0 L -7 6"
        fill="none"
        stroke="hsl(var(--primary) / 0.6)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}
