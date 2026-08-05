// =====================================================================
// Bloom — Fit-score rubric. The application calculates the weighted
// final score from per-category inputs supplied by the AI model. The
// model provides evidence and a raw score (0–10) per category; this
// module performs the deterministic weighted aggregation.
//
// Bump RUBRIC_VERSION whenever any category name, weight, or the
// calculateFitScore formula changes. The version is stamped onto every
// saved analysis so score changes can be traced to a specific rubric.
// =====================================================================

export const RUBRIC_VERSION = "1.0.0";

/** Weights must sum to exactly 1.0 — enforced at module load time. */
export const SCORING_RUBRIC = {
  required_qualifications:  { weight: 0.30, label: "Required Qualifications" },
  relevant_experience:      { weight: 0.20, label: "Relevant Experience & Responsibilities" },
  relevant_skills:          { weight: 0.15, label: "Relevant Skills & Tools" },
  education_certifications: { weight: 0.10, label: "Education, Certifications & Licenses" },
  projects_portfolio:       { weight: 0.10, label: "Relevant Projects & Portfolio Evidence" },
  preferred_qualifications: { weight: 0.05, label: "Preferred Qualifications" },
  seniority_alignment:      { weight: 0.05, label: "Seniority & Years-of-Experience Alignment" },
  location_logistics:       { weight: 0.05, label: "Location, Travel, Arrangement & Work Authorization" },
} as const satisfies Record<string, { weight: number; label: string }>;

const _totalWeight = Object.values(SCORING_RUBRIC).reduce((s, c) => s + c.weight, 0);
if (Math.abs(_totalWeight - 1.0) > 1e-9) {
  throw new Error(`Rubric weights must sum to 1.0, got ${_totalWeight}`);
}

export type ScoringCategory = keyof typeof SCORING_RUBRIC;
export const SCORING_CATEGORIES = Object.keys(SCORING_RUBRIC) as ScoringCategory[];

/** What the AI model provides per category (raw inputs only). */
export interface CategoryInput {
  rawScore: number; // 0–10 integer, AI-supplied
  evidence: string[];
  notes: string;
}

/** Full per-category record after the app adds weight and contribution. */
export interface CategoryScore extends CategoryInput {
  category: ScoringCategory;
  label: string;
  weight: number;
  weightedContribution: number; // rawScore * weight — calculated by app, never by model
}

export interface ScoredRubric {
  categories: CategoryScore[];
  fitScore: number; // deterministically calculated; rounded to 1 decimal
  rubricVersion: string;
}

/**
 * Deterministically compute the weighted fit score from per-category raw
 * scores. Raw scores are clamped to [0, 10] before multiplication.
 */
export function calculateFitScore(inputs: Record<ScoringCategory, CategoryInput>): number {
  const raw = SCORING_CATEGORIES.reduce((sum, cat) => {
    const score = Math.min(10, Math.max(0, inputs[cat]?.rawScore ?? 0));
    return sum + score * SCORING_RUBRIC[cat].weight;
  }, 0);
  return Math.round(raw * 10) / 10;
}

/**
 * Build the complete scored rubric from model inputs, adding label,
 * weight, and weightedContribution to each category.
 */
export function buildScoredRubric(inputs: Record<ScoringCategory, CategoryInput>): ScoredRubric {
  const categories: CategoryScore[] = SCORING_CATEGORIES.map((cat) => {
    const input = inputs[cat] ?? { rawScore: 0, evidence: [], notes: "" };
    const clampedScore = Math.min(10, Math.max(0, input.rawScore));
    const weight = SCORING_RUBRIC[cat].weight;
    return {
      category: cat,
      label: SCORING_RUBRIC[cat].label,
      rawScore: clampedScore,
      weight,
      weightedContribution: Math.round(clampedScore * weight * 100) / 100,
      evidence: input.evidence,
      notes: input.notes,
    };
  });

  return {
    categories,
    fitScore: calculateFitScore(inputs),
    rubricVersion: RUBRIC_VERSION,
  };
}
