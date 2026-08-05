import { Compass, Sparkles, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CONFIDENCE_META, VERDICT_META } from "@/lib/constants";
import type { JobAnalysisPayload } from "@/lib/ai";

function ListBlock({ title, items, empty, muted }: { title: string; items: string[]; empty: string; muted?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-3", muted ? "border-border/40 bg-card/30" : "border-border/60 bg-card/50")}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 grid gap-1.5 text-sm">
          {items.map((item) => (
            <li key={item} className={cn("rounded-lg px-2.5 py-2", muted ? "bg-secondary/30" : "bg-secondary/50")}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AnalysisSummary({
  analysis,
  selectedResumeId,
  onApplyRecommendation,
}: {
  analysis: JobAnalysisPayload;
  selectedResumeId?: string | null;
  onApplyRecommendation?: (resumeId: string) => void;
}) {
  const verdict = VERDICT_META[analysis.verdict];
  const confidence = CONFIDENCE_META[analysis.confidence_level];
  const recommended = analysis.resume_rankings.find((resume) => resume.resume_id === analysis.recommended_resume_id) ?? null;

  return (
    <div className="grid gap-3">
      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">AI analysis</p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Imported from {analysis.source === "url_plus_manual" ? "URL + pasted description" : analysis.source === "url" ? "URL" : "pasted description"}.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn("border-0", verdict.className)}>{verdict.emoji} {verdict.label}</Badge>
              <Badge variant="outline">{analysis.fit_score}/10 fit</Badge>
              <span className={cn("text-xs", confidence.className)}>{confidence.label}</span>
            </div>
          </div>

          {/* The "why" behind the verdict — every analysis explains itself, never just a number. */}
          <p className="mt-3 rounded-xl bg-secondary/40 p-3 text-sm leading-6 text-foreground/85">{analysis.verdict_explanation}</p>

          {recommended && (
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Recommended resume: {recommended.resume_name}</p>
                  {analysis.recommended_resume_reason && (
                    <p className="mt-1 text-sm text-muted-foreground">{analysis.recommended_resume_reason}</p>
                  )}
                </div>
                {onApplyRecommendation && analysis.recommended_resume_id && selectedResumeId !== analysis.recommended_resume_id && (
                  <Button size="sm" variant="outline" onClick={() => onApplyRecommendation(analysis.recommended_resume_id!)}>
                    Use recommendation
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <ListBlock title="What's working in your favor" items={analysis.matching_strengths} empty="No strong matches were identified from the available resume evidence." />
        <ListBlock title="Deal breakers" items={analysis.deal_breakers} empty="No explicit deal breakers were identified from the available evidence." />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ListBlock title="Gaps that matter" items={analysis.gaps_that_matter} empty="No gaps identified that would meaningfully hurt your chances." />
        <ListBlock title="Gaps you can set aside" items={analysis.gaps_that_dont_matter} empty="Nothing here worth setting aside — see the gaps above instead." />
      </div>

      <Card className="border-primary/25 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-4">
          <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Highest-impact next step</p>
            <p className="mt-1 text-sm leading-6 text-foreground/85">{analysis.highest_impact_next_step}</p>
          </div>
        </CardContent>
      </Card>

      {(analysis.missing_required_qualifications.length > 0 || analysis.missing_preferred_qualifications.length > 0) && (
        <div className="grid gap-3 lg:grid-cols-2">
          <ListBlock
            title="Missing required qualifications (reference)"
            items={analysis.missing_required_qualifications}
            empty="No required gaps were identified."
            muted
          />
          <ListBlock
            title="Missing preferred qualifications (reference)"
            items={analysis.missing_preferred_qualifications}
            empty="No preferred gaps were identified."
            muted
          />
        </div>
      )}

      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4">
          <p className="text-sm font-semibold">Resume ranking</p>
          {analysis.resume_rankings.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No active resumes with extractable text were available to compare.</p>
          ) : (
            <div className="mt-3 grid gap-2.5">
              {analysis.resume_rankings.map((resume, index) => (
                <div key={resume.resume_id} className={cn("rounded-xl border px-3 py-3", selectedResumeId === resume.resume_id ? "border-primary/40 bg-primary/5" : "border-border/60 bg-card/50")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {index + 1}. {resume.resume_name}
                    </p>
                    <Badge variant="outline">{resume.score}/10</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{resume.explanation}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ListBlock
        title="Resume improvement suggestions"
        items={analysis.resume_improvement_suggestions}
        empty="No resume-improvement suggestions were needed from the available evidence."
      />

      {/* Bloom's signature moment — always the last word on an analysis. */}
      <Card className="border-gold/30 bg-gradient-to-br from-gold/10 via-card/60 to-primary/5">
        <CardContent className="flex items-start gap-3 p-4">
          <Compass className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">Career coach's advice</p>
            <p className="mt-1.5 text-sm leading-6 text-foreground/85">{analysis.career_coach_advice}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
