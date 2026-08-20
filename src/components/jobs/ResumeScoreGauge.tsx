import { getResumeScoreBand } from "@/lib/constants";

const SIZE = 96;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Colors mirror badgeVariants in ui/badge.tsx (success/warning/destructive)
// so a given band always reads the same color everywhere it appears —
// gauge, dimension bars, and the status banner alike.
const RING_COLOR_CLASS: Record<ReturnType<typeof getResumeScoreBand>["badgeVariant"], string> = {
  success: "stroke-success",
  default: "stroke-primary",
  warning: "stroke-warning",
  destructive: "stroke-destructive",
};

const TEXT_COLOR_CLASS: Record<ReturnType<typeof getResumeScoreBand>["badgeVariant"], string> = {
  success: "text-success",
  default: "text-primary",
  warning: "text-warning",
  destructive: "text-destructive",
};

/** A small ring gauge for a 0-100 résumé-tailoring score — the score number
 * and its derived band label (see getResumeScoreBand) sit in the center. */
export function ResumeScoreGauge({ score }: { score: number }) {
  const band = getResumeScoreBand(score);
  const clamped = Math.min(100, Math.max(0, score));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="-rotate-90" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`Overall score ${score} out of 100, ${band.label}`}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} strokeWidth={STROKE} className="fill-none stroke-muted" />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
          strokeLinecap="round"
          className={`fill-none transition-[stroke-dashoffset] duration-700 ease-out ${RING_COLOR_CLASS[band.badgeVariant]}`}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-semibold leading-none ${TEXT_COLOR_CLASS[band.badgeVariant]}`}>{score}</span>
        <span className="mt-0.5 text-[10px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}
