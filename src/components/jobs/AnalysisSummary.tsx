import { AlertCircle, Sparkles, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ANALYSIS_SOURCE_META,
  ANALYSIS_VERDICT_META,
  APPLICATION_PRIORITY_META,
  CONFIDENCE_META,
  DEAL_BREAKER_STATUS_META,
  IMPORT_STATUS_META,
  LOGISTICS_MATCH_META,
  OPPORTUNITY_ASSESSMENT_META,
  RESUME_SUGGESTION_TYPE_META,
} from "@/lib/constants";
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
  onRequestResumeEvidence,
}: {
  analysis: JobAnalysisPayload;
  selectedResumeId?: string | null;
  onApplyRecommendation?: (resumeId: string) => void;
  onRequestResumeEvidence?: () => void;
}) {
  const verdict = ANALYSIS_VERDICT_META[analysis.analysis.verdict];
  const confidence = CONFIDENCE_META[analysis.analysis.candidateFit.confidence];
  const importStatus = IMPORT_STATUS_META[analysis.importStatus];
  const applicationPriority = APPLICATION_PRIORITY_META[analysis.analysis.applicationRecommendation];
  const opportunityAssessment = OPPORTUNITY_ASSESSMENT_META[analysis.analysis.opportunityAssessment];
  const recommendedResumeId = analysis.recommendedResumeId;
  const recommended = analysis.resumeRanking.find((resume) => resume.resumeId === recommendedResumeId) ?? null;
  const fitScore = analysis.analysis.candidateFit.fitScore;
  const fitNotAssessed = fitScore === null;

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
                Imported from {ANALYSIS_SOURCE_META[analysis.source]}.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn("border-0", verdict.className)}>{verdict.emoji} {verdict.label}</Badge>
              <Badge className={cn("border-0", opportunityAssessment.className)}>{opportunityAssessment.label}</Badge>
              <Badge variant="outline">{fitNotAssessed ? "Fit not assessed yet" : `${fitScore}/10 fit`}</Badge>
              <Badge className={cn("border-0", applicationPriority.className)}>{applicationPriority.label}</Badge>
              <span className={cn("text-xs", confidence.className)}>{confidence.label}</span>
            </div>
          </div>

          <p className="mt-3 rounded-xl bg-secondary/40 p-3 text-sm leading-6 text-foreground/85">{analysis.analysis.candidateFit.explanation}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className={cn("font-medium", importStatus.className)}>{importStatus.label}</span>
            <span>Prompt v{analysis.promptVersion}</span>
          </div>

          {fitNotAssessed && (
            <div className="mt-4 rounded-xl border border-gold/30 bg-gold/10 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 text-gold" />
                  <div>
                    <p className="text-sm font-medium">Fit not assessed yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">Upload or select a resume to assess fit. Missing information should not be treated as zero fit.</p>
                  </div>
                </div>
                {onRequestResumeEvidence && (
                  <Button size="sm" variant="outline" onClick={onRequestResumeEvidence}>
                    Upload or select a resume
                  </Button>
                )}
              </div>
            </div>
          )}

          {recommended && (
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Recommended resume: {recommended.resumeName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{recommended.recommendationReason}</p>
                </div>
                {onApplyRecommendation && recommendedResumeId && selectedResumeId !== recommendedResumeId && (
                  <Button size="sm" variant="outline" onClick={() => onApplyRecommendation(recommendedResumeId)}>
                    Use recommendation
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <ListBlock title="Strong matches" items={analysis.analysis.candidateFit.strongMatches} empty="No strong matches were identified from the available evidence." />
        <ListBlock
          title="Transferable strengths"
          items={analysis.analysis.candidateFit.transferableStrengths}
          empty="No major transferable strengths were highlighted from the available evidence."
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ListBlock title="Critical gaps" items={analysis.analysis.candidateFit.criticalGaps} empty="No gaps identified that would meaningfully hurt your chances." />
        <ListBlock title="Preferred gaps" items={analysis.analysis.candidateFit.preferredGaps} empty="No preferred-only gaps stood out from the available evidence." />
      </div>

      <Card className="border-primary/25 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-4">
          <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Highest-impact next step</p>
            <p className="mt-1 text-sm leading-6 text-foreground/85">{analysis.analysis.nextStep}</p>
          </div>
        </CardContent>
      </Card>

      {analysis.jobExtraction.dealBreakers.length > 0 && (
        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-4">
            <p className="text-sm font-semibold">Hard requirements to confirm</p>
            <p className="mt-1 text-sm text-muted-foreground">
              These are the only things that can make you genuinely ineligible — not general considerations.
            </p>
            <div className="mt-3 grid gap-2.5">
              {analysis.jobExtraction.dealBreakers.map((item) => {
                const status = DEAL_BREAKER_STATUS_META[item.status];
                return (
                  <div key={`${item.status}-${item.label}`} className="rounded-xl border border-border/60 bg-card/50 px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={cn("border-0", status.className)}>{status.label}</Badge>
                      <p className="text-sm">{item.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logistics/lifestyle factors — relocation, travel, work arrangement,
          schedule — are deliberately kept separate from the hard requirements
          above. They may affect whether this role fits what the candidate
          wants, never whether they're qualified for it. Optional: absent on
          analyses saved before this field existed. */}
      {(analysis.jobExtraction.logisticsConsiderations ?? []).length > 0 && (
        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-4">
            <p className="text-sm font-semibold">Things to consider</p>
            <div className="mt-3 grid gap-2.5">
              {(analysis.jobExtraction.logisticsConsiderations ?? []).map((item) => {
                const match = LOGISTICS_MATCH_META[item.preferenceMatch];
                return (
                  <div key={item.label} className="rounded-xl border border-border/60 bg-card/50 px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={cn("border-0", match.className)}>{match.label}</Badge>
                      <p className="text-sm font-medium">{item.label}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              These factors don&apos;t necessarily make you unqualified, but they may affect whether this role fits what you want.
            </p>
          </CardContent>
        </Card>
      )}

      {analysis.analysis.candidateFit.unknowns.length > 0 && (
        <ListBlock
          title="Missing information"
          items={analysis.analysis.candidateFit.unknowns}
          empty="No major unknowns were identified."
          muted
        />
      )}

      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4">
          <p className="text-sm font-semibold">Resume ranking</p>
          {analysis.resumeRanking.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No active resumes with extractable text were available to compare.</p>
          ) : (
            <div className="mt-3 grid gap-2.5">
              {analysis.resumeRanking.map((resume, index) => (
                <div key={resume.resumeId} className={cn("rounded-xl border px-3 py-3", selectedResumeId === resume.resumeId ? "border-primary/40 bg-primary/5" : "border-border/60 bg-card/50")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {index + 1}. {resume.resumeName}
                    </p>
                    <Badge variant="outline">{resume.compatibilityScore}/100</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{resume.recommendationReason}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4">
          <p className="text-sm font-semibold">Resume improvement suggestions</p>
          {analysis.resumeSuggestions.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No resume-improvement suggestions were needed from the available evidence.</p>
          ) : (
            <div className="mt-3 grid gap-2.5">
              {analysis.resumeSuggestions.map((suggestion, index) => (
                <div key={`${suggestion.type}-${index}`} className="rounded-xl border border-border/60 bg-card/50 px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{RESUME_SUGGESTION_TYPE_META[suggestion.type]}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-foreground/90">{suggestion.suggestion}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{suggestion.reason}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
