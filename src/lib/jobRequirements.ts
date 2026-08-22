import type { Job, JobAiDealBreaker } from "@/types/database";

// Hard-requirement dealBreaker items on a job that the AI flagged as
// uncertain (possible/insufficient_information) and the candidate hasn't
// answered yet — see HardRequirementConfirm and candidate_hard_requirement_
// facts (migration 0044). A "confirmed" status item, or one from an
// analysis run before requirementKey existed (empty string, can't be
// matched to a saved answer), never counts as pending.
//
// Single source of truth for this predicate — shared by JobCard's alert
// badge and the Dashboard "Requirements to confirm" stat/detail page, so
// the badge and the count can never disagree, and both clear together the
// moment an answer is saved (confirmedRequirementKeys comes from
// useCandidateFacts, which useUpsertCandidateFact invalidates on save).
export function getPendingRequirementConfirmations(
  job: Job,
  confirmedRequirementKeys: ReadonlySet<string>
): JobAiDealBreaker[] {
  return (job.ai_extracted_data?.dealBreakers ?? []).filter(
    (item) =>
      item.requirementKey &&
      (item.status === "possible" || item.status === "insufficient_information") &&
      !confirmedRequirementKeys.has(item.requirementKey)
  );
}

export function jobNeedsRequirementConfirmation(job: Job, confirmedRequirementKeys: ReadonlySet<string>): boolean {
  return getPendingRequirementConfirmations(job, confirmedRequirementKeys).length > 0;
}
