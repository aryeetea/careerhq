import type { ConnectorPoint } from "@/lib/tour/position";

/** Small, stable per-step hash — used only to pick which way a guide line
 * bows (left or right of straight), so the curve doesn't look identical on
 * every step but also never jitters between renders of the same step. */
function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** A gently bowed quadratic-bezier path between two points — the "lightly
 * sketched" connector line. The bow is capped and proportional to the
 * distance covered, so short hops curve subtly and long ones curve more. */
export function buildGuidePath(from: ConnectorPoint, to: ConnectorPoint, seed: string): string {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const sign = hash(seed) % 2 === 0 ? 1 : -1;
  const magnitude = Math.min(30, len * 0.2) * sign;
  const cx = mx + px * magnitude;
  const cy = my + py * magnitude;
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}

/** The angle (degrees) the curve is traveling at its endpoint — used to
 * orient the little arrowhead so it reads as pointing along the line. */
export function endAngle(from: ConnectorPoint, to: ConnectorPoint, seed: string): number {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const sign = hash(seed) % 2 === 0 ? 1 : -1;
  const magnitude = Math.min(30, len * 0.2) * sign;
  const cx = mx + px * magnitude;
  const cy = my + py * magnitude;
  return (Math.atan2(to.y - cy, to.x - cx) * 180) / Math.PI;
}
