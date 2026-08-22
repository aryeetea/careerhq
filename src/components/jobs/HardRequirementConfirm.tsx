import * as React from "react";
import { Check, LoaderCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { cn } from "@/lib/utils";
import { useCandidateFacts, useUpsertCandidateFact } from "@/hooks/queries/useCandidateFacts";
import { useToast } from "@/components/shared/toast";
import type { CandidateFactAnswer, JobAiDealBreaker } from "@/types/database";

const ANSWER_META: Record<CandidateFactAnswer, { label: string }> = {
  yes: { label: "Yes, I have this" },
  no: { label: "No, I don't" },
  partial: { label: "Partially" },
};

/** Inline questionnaire for one "Hard requirements to confirm" item — lets
 * the user answer it directly instead of leaving it as a dead-end badge.
 * The answer is saved to candidate_hard_requirement_facts (keyed on
 * requirementKey, not this posting's wording), so it's reused across every
 * other job with a matching requirement and can be updated later if the
 * candidate's situation changes. Requires requirementKey — items from
 * analyses saved before that field existed can't be matched to anything,
 * so they fall back to just the plain badge (see AnalysisSummary). */
export function HardRequirementConfirm({ item }: { item: JobAiDealBreaker }) {
  const { data: facts } = useCandidateFacts();
  const upsertFact = useUpsertCandidateFact();
  const { push } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [detail, setDetail] = React.useState("");
  const [pendingAnswer, setPendingAnswer] = React.useState<CandidateFactAnswer | null>(null);

  const existing = facts?.find((fact) => fact.requirement_key === item.requirementKey);

  React.useEffect(() => {
    if (existing && !editing) setDetail(existing.detail ?? "");
  }, [existing, editing]);

  async function save(answer: CandidateFactAnswer) {
    setPendingAnswer(answer);
    try {
      await upsertFact.mutateAsync({ requirementKey: item.requirementKey, label: item.label, answer, detail });
      push("Saved to your profile — future job matches will reflect this.", "success");
      setEditing(false);
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't save your answer.", "error");
    } finally {
      setPendingAnswer(null);
    }
  }

  if (existing && !editing) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/40 pt-2 text-xs">
        <span className="inline-flex items-center gap-1 font-medium text-success">
          <Check className="h-3.5 w-3.5" /> You confirmed: {ANSWER_META[existing.answer].label}
        </span>
        {existing.detail && <span className="text-muted-foreground">— {existing.detail}</span>}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
        >
          <Pencil className="h-3 w-3" /> Update
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2.5 border-t border-border/40 pt-2.5">
      <p className="text-xs font-medium text-muted-foreground">Do you meet this requirement?</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {(Object.keys(ANSWER_META) as CandidateFactAnswer[]).map((answer) => (
          <Button
            key={answer}
            type="button"
            size="sm"
            variant="outline"
            className={cn("h-7 px-2.5 text-xs", pendingAnswer === answer && "opacity-70")}
            disabled={upsertFact.isPending}
            onClick={() => save(answer)}
          >
            {pendingAnswer === answer && upsertFact.isPending ? <LoaderCircle className="h-3 w-3 animate-spin" /> : null}
            {ANSWER_META[answer].label}
          </Button>
        ))}
        {existing && (
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2.5 text-xs" onClick={() => setEditing(false)} disabled={upsertFact.isPending}>
            Cancel
          </Button>
        )}
      </div>
      <AutoResizeTextarea
        minRows={1}
        maxHeight={80}
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="Optional: add a detail, e.g. 3 years as a site supervisor"
        className="mt-1.5 text-xs"
      />
    </div>
  );
}
