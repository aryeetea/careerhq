import * as React from "react";
import { AlertCircle, ChevronsUpDown, Sparkles, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import {
  ANALYSIS_SOURCE_META,
  ANALYSIS_VERDICT_META,
  APPLICATION_PRIORITY_META,
  CONFIDENCE_META,
  DEAL_BREAKER_STATUS_META,
  GAP_SEVERITY_META,
  IMPORT_STATUS_META,
  LOGISTICS_MATCH_META,
  OPPORTUNITY_ASSESSMENT_META,
  RECOMMENDATION_PRIORITY_META,
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

// The four headline numbers/badges from the redesign — [VERDICT] [FIT]
// [PRIORITY] [CAREER DIRECTION]. Kept to just these four so the summary
// reads at a glance; everything else (sub-scores, résumé ranking, raw
// metadata) lives in the "Detailed scoring" accordion below.
function StatTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ScoreTile({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/50 bg-card/40 px-2.5 py-2">
      <p className="break-words text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value === null ? "—" : `${value}/10`}</p>
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
  // scoringDimensions/gapSeverity/recommendationPriority/careerDirectionNote/
  // shouldApply are all absent on analyses saved before this redesign (or
  // saved by a browser tab that hadn't picked up this schema yet) — the type
  // says they're required, but that's only true for freshly-validated
  // responses, never for old JSONB read back off the row. Fall back to safe
  // "unknown" values rather than indexing META records with undefined and
  // crashing the dialog.
  const priority = RECOMMENDATION_PRIORITY_META[analysis.analysis.recommendationPriority] ?? RECOMMENDATION_PRIORITY_META.normal;
  const gapSeverity = GAP_SEVERITY_META[analysis.analysis.gapSeverity] ?? GAP_SEVERITY_META.none;
  const scoring = analysis.analysis.scoringDimensions as JobAnalysisPayload["analysis"]["scoringDimensions"] | undefined;
  const careerDirectionFit = scoring?.careerDirectionFit ?? null;
  const hasNewFields = Boolean(analysis.analysis.scoringDimensions && analysis.analysis.gapSeverity && analysis.analysis.recommendationPriority);

  return (
    <div className="grid gap-3">
      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">AI analysis</p>
            <span className="text-xs text-muted-foreground">· Imported from {ANALYSIS_SOURCE_META[analysis.source]}</span>
          </div>

          {fitNotAssessed ? (
            <div className="mt-3 rounded-xl border border-gold/30 bg-gold/10 p-3">
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
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile label="Verdict">
                <Badge className={cn("border-0", verdict.className)}>{verdict.emoji} {verdict.label}</Badge>
              </StatTile>
              <StatTile label="Fit">
                <p className="text-lg font-semibold leading-none">{fitScore}<span className="text-sm font-normal text-muted-foreground">/10</span></p>
              </StatTile>
              <StatTile label="Priority">
                {hasNewFields ? (
                  <Badge className={cn("border-0", priority.className)}>{priority.emoji} {priority.label}</Badge>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </StatTile>
              <StatTile label="Career direction">
                <p className="text-lg font-semibold leading-none">
                  {careerDirectionFit === null ? "—" : careerDirectionFit}
                  {careerDirectionFit !== null && <span className="text-sm font-normal text-muted-foreground">/10</span>}
                </p>
              </StatTile>
            </div>
          )}

          {!fitNotAssessed && !hasNewFields && (
            <p className="mt-2 text-xs text-muted-foreground">
              This analysis predates priority/gap-severity scoring — re-run analysis to see it here.
            </p>
          )}

          <p className="mt-3 rounded-xl bg-secondary/40 p-3 text-sm leading-6 text-foreground/85">{analysis.analysis.candidateFit.explanation}</p>

          {recommended && (
            <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
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

      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4">
          <p className="text-sm font-semibold">Why you match</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <ListBlock title="Strong matches" items={analysis.analysis.candidateFit.strongMatches} empty="No strong matches were identified from the available evidence." />
            <ListBlock
              title="Transferable strengths"
              items={analysis.analysis.candidateFit.transferableStrengths}
              empty="No major transferable strengths were highlighted from the available evidence."
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">What&apos;s missing</p>
            {!fitNotAssessed && hasNewFields && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Gap severity
                <Badge className={cn("border-0", gapSeverity.className)}>{gapSeverity.label}</Badge>
              </div>
            )}
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <ListBlock title="Critical gaps" items={analysis.analysis.candidateFit.criticalGaps} empty="No gaps identified that would meaningfully hurt your chances." />
            <ListBlock title="Preferred gaps" items={analysis.analysis.candidateFit.preferredGaps} empty="No preferred-only gaps stood out from the available evidence." />
          </div>
        </CardContent>
      </Card>

      {/* Career direction fit is deliberately separate from qualification —
          a role can be technically possible and worth applying to even when
          it's not the candidate's ideal target direction. See
          careerCoach.ts CAREER DIRECTION FIT. */}
      {!fitNotAssessed && analysis.analysis.careerDirectionNote && (
        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-4">
            <p className="text-sm font-semibold">Career direction</p>
            <p className="mt-2 text-sm leading-6 text-foreground/85">{analysis.analysis.careerDirectionNote}</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/25 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Should I apply?</p>
              <p className="mt-1 text-sm leading-6 text-foreground/85">
                {analysis.analysis.shouldApply || "This analysis predates a direct recommendation — re-run analysis to see one here."}
              </p>
            </div>
          </div>
          <p className="mt-3 border-t border-primary/15 pt-3 text-sm leading-6 text-foreground/70">
            <span className="font-medium text-foreground/85">Next step: </span>
            {analysis.analysis.nextStep}
          </p>
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

      {/* Everything below is real, but secondary — the five numeric
          sub-scores behind [FIT], the raw assessment/confidence metadata,
          and the full résumé breakdown. Collapsed by default so the
          headline above doesn't get buried in metrics. */}
      <Accordion type="single" collapsible className="rounded-xl border border-border/60 bg-card/60 px-4">
        <AccordionItem value="detailed-scoring" className="border-b-0">
          <AccordionTrigger className="gap-2 text-sm">
            <span className="flex items-center gap-1.5">
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              Detailed scoring &amp; résumé analysis
            </span>
          </AccordionTrigger>
          <AccordionContent className="grid gap-4 pb-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <ScoreTile label="Qualification" value={scoring?.qualificationFit ?? null} />
              <ScoreTile label="Transferable" value={scoring?.transferableSkillsFit ?? null} />
              <ScoreTile label="Career direction" value={scoring?.careerDirectionFit ?? null} />
              <ScoreTile label="Experience/seniority" value={scoring?.experienceSeniorityFit ?? null} />
              <ScoreTile label="Location/arrangement" value={scoring?.locationWorkArrangementFit ?? null} />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge className={cn("border-0", opportunityAssessment.className)}>{opportunityAssessment.label}</Badge>
              <span className={cn("font-medium", confidence.className)}>{confidence.label}</span>
              <span className={cn("font-medium", importStatus.className)}>{importStatus.label}</span>
              <span>Prompt v{analysis.promptVersion}</span>
            </div>

            <div>
              <p className="text-sm font-semibold">Résumé ranking</p>
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
            </div>

            <div>
              <p className="text-sm font-semibold">Résumé improvement suggestions</p>
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
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
