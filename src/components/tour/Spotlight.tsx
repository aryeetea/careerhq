import * as React from "react";
import type { TargetRect } from "@/hooks/useTourTargetRect";
import type { ViewportSize } from "@/hooks/useViewportSize";

/**
 * Softly outlines a target element: the rest of the screen gets a light
 * tint and a couple of pixels of blur (never a heavy dark scrim), and the
 * target itself gets a thin glowing ring instead of a blocky rectangle.
 * Both layers are built from one SVG mask with a feathered (blurred) hole,
 * so the edge of the highlight fades rather than cutting sharply.
 */
export function Spotlight({
  rect,
  viewport,
  padding = 10,
}: {
  rect: TargetRect;
  viewport: ViewportSize;
  padding?: number;
}) {
  const maskId = React.useId();
  const x = rect.left - padding;
  const y = rect.top - padding;
  const w = rect.width + padding * 2;
  const h = rect.height + padding * 2;
  const radius = Math.min(20, Math.min(w, h) / 2 + 4);

  return (
    <>
      <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <filter id={`${maskId}-feather`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <mask id={maskId}>
            <rect x={0} y={0} width={viewport.width} height={viewport.height} fill="white" />
            <rect x={x} y={y} width={w} height={h} rx={radius} fill="black" filter={`url(#${maskId}-feather)`} />
          </mask>
        </defs>
      </svg>

      {/* Dim + blur layer, masked so the target area stays untouched. */}
      <div
        className="fixed inset-0 z-[85] animate-fade-in transition-[top,left,width,height] duration-500 ease-out"
        style={{
          background: "hsl(var(--background) / 0.38)",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
          mask: `url(#${maskId})`,
          WebkitMask: `url(#${maskId})`,
        }}
      />

      {/* Thin glowing outline around the target, in place of a blocky box. */}
      <div
        className="fixed z-[86] animate-scale-in transition-all duration-500 ease-out"
        style={{
          top: y,
          left: x,
          width: w,
          height: h,
          borderRadius: radius,
          boxShadow:
            "0 0 0 1.5px hsl(var(--primary) / 0.5), 0 0 0 5px hsl(var(--primary) / 0.12), 0 0 34px 6px hsl(var(--primary) / 0.16)",
        }}
        aria-hidden="true"
      />
    </>
  );
}
