import * as React from "react";

interface ProgressStep {
  afterMs: number;
  message: string;
}

/**
 * Cycles through reassuring status messages the longer `active` stays true.
 * This doesn't make the underlying request any faster — AI analysis
 * genuinely takes 30-60s+ (see analyze-job's OpenAI call) — it just keeps a
 * long wait from reading as "stuck" by showing that something is still
 * happening. `steps` must be sorted by `afterMs` ascending and start at 0.
 */
export function useProgressHint(active: boolean, steps: ProgressStep[]): string | null {
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!active) {
      setMessage(null);
      return;
    }
    setMessage(steps[0]?.message ?? null);
    const timers = steps.slice(1).map((step) => window.setTimeout(() => setMessage(step.message), step.afterMs));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return message;
}

// Based on observed analyze-job latency (Supabase edge function logs: ~28-73s,
// most in the 30-45s range) — a single large reasoning-model call that
// extracts the job, scores fit, and ranks every saved resume in one shot.
export const ANALYSIS_PROGRESS_STEPS: ProgressStep[] = [
  { afterMs: 0, message: "Reading the job description…" },
  { afterMs: 6_000, message: "Comparing it against your resume…" },
  { afterMs: 16_000, message: "Scoring your fit and spotting gaps…" },
  { afterMs: 30_000, message: "Almost there — thorough analyses can take up to a minute." },
  { afterMs: 55_000, message: "Still working — this one's taking a bit longer than usual." },
];

// Cover letter generation is a lighter single call (~10-15s typically).
export const COVER_LETTER_PROGRESS_STEPS: ProgressStep[] = [
  { afterMs: 0, message: "Drafting your cover letter…" },
  { afterMs: 6_000, message: "Tailoring it to this role…" },
  { afterMs: 15_000, message: "Almost done…" },
];

// Résumé tailoring is a comparably heavy call to analysis (extracting ATS
// keywords, scoring coverage, and rewriting the full résumé in one shot)
// — cadence modeled on ANALYSIS_PROGRESS_STEPS above.
export const TAILOR_RESUME_PROGRESS_STEPS: ProgressStep[] = [
  { afterMs: 0, message: "Scanning the job description for keywords…" },
  { afterMs: 6_000, message: "Checking how your résumé stacks up…" },
  { afterMs: 16_000, message: "Rewriting your résumé for this posting…" },
  { afterMs: 30_000, message: "Almost there — thorough rewrites can take up to a minute." },
  { afterMs: 55_000, message: "Still working — this one's taking a bit longer than usual." },
];
