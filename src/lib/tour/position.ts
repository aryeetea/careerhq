import { clamp } from "@/lib/utils";
import type { TargetRect } from "@/hooks/useTourTargetRect";

export interface Size {
  width: number;
  height: number;
}

export type CardPlacement = "top" | "bottom" | "left" | "right" | "center";

export interface CardPosition {
  top: number;
  left: number;
  placement: CardPlacement;
}

const GAP = 18;
const MARGIN = 16;

/**
 * Where to float the tour card relative to its target. Tries the preferred
 * side first, then rotates through the rest, and only settles on one that
 * fully fits the viewport — so the card never covers the spotlighted
 * element and never runs off-screen. A final clamp is a safety net for
 * viewports too small for any side to fit cleanly.
 */
export function computeCardPosition(
  anchor: TargetRect | null,
  card: Size,
  viewport: Size,
  preferred?: "top" | "bottom" | "left" | "right"
): CardPosition {
  if (!anchor || card.width === 0 || card.height === 0) {
    return {
      top: Math.max(MARGIN, viewport.height / 2 - card.height / 2),
      left: Math.max(MARGIN, viewport.width / 2 - card.width / 2),
      placement: "center",
    };
  }

  // Reassigned so the nested closure below captures a type TypeScript knows
  // is non-null — narrowing from the guard above doesn't carry into nested
  // function bodies on its own.
  const target = anchor;

  const sides: Array<"top" | "bottom" | "left" | "right"> = ["bottom", "top", "right", "left"];
  const order = preferred ? [preferred, ...sides.filter((s) => s !== preferred)] : sides;

  function fits(side: "top" | "bottom" | "left" | "right"): boolean {
    if (side === "bottom") return target.top + target.height + GAP + card.height <= viewport.height - MARGIN;
    if (side === "top") return target.top - GAP - card.height >= MARGIN;
    if (side === "right") return target.left + target.width + GAP + card.width <= viewport.width - MARGIN;
    return target.left - GAP - card.width >= MARGIN;
  }

  const side = order.find(fits) ?? order[0];

  let top: number;
  let left: number;
  if (side === "bottom") {
    top = anchor.top + anchor.height + GAP;
    left = anchor.left + anchor.width / 2 - card.width / 2;
  } else if (side === "top") {
    top = anchor.top - GAP - card.height;
    left = anchor.left + anchor.width / 2 - card.width / 2;
  } else if (side === "right") {
    top = anchor.top + anchor.height / 2 - card.height / 2;
    left = anchor.left + anchor.width + GAP;
  } else {
    top = anchor.top + anchor.height / 2 - card.height / 2;
    left = anchor.left - GAP - card.width;
  }

  top = clamp(top, MARGIN, Math.max(MARGIN, viewport.height - card.height - MARGIN));
  left = clamp(left, MARGIN, Math.max(MARGIN, viewport.width - card.width - MARGIN));

  return { top, left, placement: side };
}

export interface ConnectorPoint {
  x: number;
  y: number;
}

/** The point on the target's edge, and the point on the card's edge, that
 * the guide line should run between — the edges that actually face each
 * other for the chosen placement. */
export function connectorPoints(
  anchor: TargetRect,
  cardPos: CardPosition,
  card: Size
): { from: ConnectorPoint; to: ConnectorPoint } {
  switch (cardPos.placement) {
    case "bottom":
      return {
        from: { x: anchor.left + anchor.width / 2, y: anchor.top + anchor.height },
        to: { x: cardPos.left + card.width / 2, y: cardPos.top },
      };
    case "top":
      return {
        from: { x: anchor.left + anchor.width / 2, y: anchor.top },
        to: { x: cardPos.left + card.width / 2, y: cardPos.top + card.height },
      };
    case "right":
      return {
        from: { x: anchor.left + anchor.width, y: anchor.top + anchor.height / 2 },
        to: { x: cardPos.left, y: cardPos.top + card.height / 2 },
      };
    default:
      return {
        from: { x: anchor.left, y: anchor.top + anchor.height / 2 },
        to: { x: cardPos.left + card.width, y: cardPos.top + card.height / 2 },
      };
  }
}
