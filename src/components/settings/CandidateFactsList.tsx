import * as React from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCandidateFacts, useDeleteCandidateFact } from "@/hooks/queries/useCandidateFacts";
import { useToast } from "@/components/shared/toast";
import type { CandidateFactAnswer } from "@/types/database";

const ANSWER_LABEL: Record<CandidateFactAnswer, string> = {
  yes: "Confirmed: Yes",
  no: "Confirmed: No",
  partial: "Confirmed: Partially",
};

const ANSWER_VARIANT: Record<CandidateFactAnswer, React.ComponentProps<typeof Badge>["variant"]> = {
  yes: "success",
  no: "destructive",
  partial: "warning",
};

/** Everything the candidate has confirmed from "Hard requirements to
 * confirm" and "Missing information" cards, gathered in one place so it
 * reads like part of the profile — not just a one-off answer buried in a
 * single job's analysis. Removing a fact here makes future analyses ask
 * about it again, which is the intended way to walk back an answer that no
 * longer applies (as opposed to "Update," which corrects it in place). */
export function CandidateFactsList() {
  const { data: facts, isLoading } = useCandidateFacts();
  const deleteFact = useDeleteCandidateFact();
  const { push } = useToast();
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);

  async function remove(requirementKey: string) {
    setPendingKey(requirementKey);
    try {
      await deleteFact.mutateAsync(requirementKey);
      push("Removed. Bloom will ask about this again next time it comes up.", "info");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't remove that.", "error");
    } finally {
      setPendingKey(null);
    }
  }

  if (isLoading) return null;

  return (
    <div>
      <p className="mb-2 text-sm font-medium">Confirmed requirements &amp; skills</p>
      <p className="mb-2 text-xs text-muted-foreground">
        Answers you've given to "Hard requirements to confirm" and "Missing information" questions on job postings. Bloom
        reuses these across every job that raises the same requirement or skill, so you're never asked twice — update or
        remove one any time your situation changes.
      </p>
      {!facts || facts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing confirmed yet. When a job analysis flags a requirement or skill it can't verify, you'll be able to answer
          it right there and it'll show up here.
        </p>
      ) : (
        <div className="grid gap-2">
          {facts.map((fact) => (
            <div key={fact.id} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-border/60 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="text-sm">{fact.label}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge variant={ANSWER_VARIANT[fact.answer]}>{ANSWER_LABEL[fact.answer]}</Badge>
                  {fact.detail && <span className="text-xs text-muted-foreground">{fact.detail}</span>}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground hover:text-destructive"
                disabled={deleteFact.isPending && pendingKey === fact.requirement_key}
                onClick={() => remove(fact.requirement_key)}
              >
                {deleteFact.isPending && pendingKey === fact.requirement_key ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
