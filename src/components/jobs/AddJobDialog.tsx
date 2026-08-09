import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { jobFormSchema, type JobFormValues } from "@/lib/validation";
import type { NewJob, Resume } from "@/types/database";
import { useCreateJob } from "@/hooks/queries/useJobs";
import { useAnalyzeJob } from "@/hooks/queries/useJobAi";
import { useSettings } from "@/hooks/queries/useProfile";
import { useToast } from "@/components/shared/toast";
import { JOB_STATUSES, UNSET_SELECT_VALUE, VERDICT_OPTIONS } from "@/lib/constants";
import { AnalysisSummary } from "@/components/jobs/AnalysisSummary";
import { deriveVerdictSource, formatDate, toDateInputValue } from "@/lib/utils";
import type { JobAnalysisPayload } from "@/lib/ai";
import { ANALYSIS_PROGRESS_STEPS, useProgressHint } from "@/hooks/useProgressHint";

interface AddJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resumes: Resume[];
}

const DEFAULT_VALUES: Partial<JobFormValues> = {
  company: "",
  title: "",
  location: "",
  workArrangement: "",
  employmentType: "",
  salary: "",
  source: "",
  jobUrl: "",
  jobDescription: "",
  status: "saved",
  verdict: "",
  fitScore: null,
  resumeId: "",
  coverLetterUsed: "",
  priority: 2,
  deadline: "",
  recruiterName: "",
  recruiterEmail: "",
  recruiterLinkedin: "",
  strengths: "",
  missingQualifications: "",
  notes: "",
};

export function AddJobDialog({ open, onOpenChange, resumes }: AddJobDialogProps) {
  const createJob = useCreateJob();
  const analyzeJob = useAnalyzeJob();
  const { data: settings } = useSettings();
  const { push } = useToast();
  const [analysis, setAnalysis] = React.useState<JobAnalysisPayload | null>(null);
  const [openSections, setOpenSections] = React.useState<string[]>([]);
  const analyzingHint = useProgressHint(analyzeJob.isPending, ANALYSIS_PROGRESS_STEPS);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<JobFormValues>({ resolver: zodResolver(jobFormSchema), defaultValues: DEFAULT_VALUES });

  // Pre-fill the resume picker with the user's chosen default (Settings →
  // AI & Resumes) so most job saves need one less click. AI's own
  // per-job recommendation, set later via handleAnalyze, still wins.
  React.useEffect(() => {
    if (open && settings?.default_resume_id && !watch("resumeId")) {
      setValue("resumeId", settings.default_resume_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, settings?.default_resume_id]);

  function close(nextOpen: boolean) {
    if (!nextOpen) {
      reset(DEFAULT_VALUES);
      setAnalysis(null);
      setOpenSections([]);
    }
    onOpenChange(nextOpen);
  }

  function focusResumeSelection() {
    setOpenSections((prev) => Array.from(new Set([...prev, "evaluation"])));
    setTimeout(() => document.getElementById("add-resume-select-trigger")?.focus(), 0);
  }

  async function handleAnalyze() {
    try {
      const result = await analyzeJob.mutateAsync({
        jobUrl: watch("jobUrl")?.trim() || undefined,
        manualJobDescription: watch("jobDescription")?.trim() || undefined,
      });
      const next = result.analysis;
      setAnalysis(next);
      setValue("company", next.jobExtraction.company ?? "", { shouldDirty: true });
      setValue("title", next.jobExtraction.jobTitle ?? "", { shouldDirty: true });
      setValue("location", next.jobExtraction.location ?? "", { shouldDirty: true });
      setValue("salary", next.jobExtraction.salary ?? "", { shouldDirty: true });
      setValue("workArrangement", next.jobExtraction.workArrangement ?? "", { shouldDirty: true });
      setValue("deadline", toDateInputValue(next.jobExtraction.applicationDeadline), { shouldDirty: true });
      setValue("jobDescription", next.jobExtraction.rawJobText, { shouldDirty: true });
      setValue("fitScore", next.analysis.candidateFit.fitScore, { shouldDirty: true });
      setValue("verdict", next.analysis.verdict === "not_yet_assessed" ? "" : next.analysis.verdict, { shouldDirty: true });
      setValue("strengths", next.analysis.candidateFit.strongMatches.join("\n"), { shouldDirty: true });
      setValue(
        "missingQualifications",
        [
          ...next.analysis.candidateFit.criticalGaps.map((item) => `Critical: ${item}`),
          ...next.analysis.candidateFit.preferredGaps.map((item) => `Preferred: ${item}`),
        ].join("\n"),
        { shouldDirty: true },
      );
      if (result.selected_resume_id) {
        setValue("resumeId", result.selected_resume_id, { shouldDirty: true });
      }
      push("AI analysis is ready to review.", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't analyze that job yet.", "error");
    }
  }

  async function onSubmit(values: JobFormValues) {
    const input: NewJob = {
      company: values.company.trim(),
      title: values.title.trim(),
      location: values.location?.trim() || null,
      work_arrangement: (values.workArrangement || null) as NewJob["work_arrangement"],
      employment_type: (values.employmentType || null) as NewJob["employment_type"],
      salary: values.salary?.trim() || null,
      source: values.source?.trim() || null,
      job_url: values.jobUrl?.trim() || null,
      job_description: values.jobDescription?.trim() || null,
      status: values.status,
      verdict: (values.verdict || null) as NewJob["verdict"],
      verdict_source: deriveVerdictSource(
        analysis?.analysis.verdict,
        analysis?.analysis.candidateFit.fitScore,
        values.verdict || "",
        values.fitScore ?? null,
      ),
      fit_score: values.fitScore ?? null,
      resume_id: values.resumeId || null,
      cover_letter_used: values.coverLetterUsed?.trim() || null,
      priority: values.priority,
      deadline: values.deadline || null,
      recruiter_name: values.recruiterName?.trim() || null,
      recruiter_email: values.recruiterEmail?.trim() || null,
      recruiter_linkedin: values.recruiterLinkedin?.trim() || null,
      strengths: values.strengths?.trim() || null,
      missing_qualifications: values.missingQualifications?.trim() || null,
      notes: values.notes?.trim() || null,
      ai_extracted_data: analysis?.jobExtraction,
      ai_analysis: analysis,
      ai_recommended_resume_id: analysis?.recommendedResumeId ?? null,
      ai_last_analyzed_at: analysis ? new Date().toISOString() : null,
      ai_prompt_version: analysis?.promptVersion ?? null,
    };

    try {
      const created = await createJob.mutateAsync(input);
      if (created.status === "applied" && created.follow_up_date) {
        push(`Application recorded. We'll remind you to follow up on ${formatDate(created.follow_up_date)}.`, "success");
      } else {
        push(`Saved ${values.title} at ${values.company}.`, "success");
      }
      close(false);
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't save that job. Try again.", "error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Add a job</DialogTitle>
          <DialogDescription>Paste in what you found on LinkedIn, Indeed, or a company site.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3" noValidate>
          <div className="grid gap-3 rounded-xl border border-border/70 bg-card/40 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Basic information</p>
            <div className="grid gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="jobUrl">Job link</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAnalyze}
                  disabled={analyzeJob.isPending || (!watch("jobUrl")?.trim() && !watch("jobDescription")?.trim())}
                >
                  {analyzeJob.isPending
                    ? "Analyzing…"
                    : watch("jobUrl")?.trim()
                      ? "Import & analyze with AI"
                      : "Analyze pasted description"}
                </Button>
              </div>
              <Input id="jobUrl" placeholder="https://linkedin.com/jobs/view/…" {...register("jobUrl")} />
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {analyzingHint ??
                  "Indeed, LinkedIn, and Glassdoor block automated imports. You don't need a link at all — paste the full job description below and analyze that directly."}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="company">Company *</Label>
                <Input id="company" {...register("company")} aria-invalid={!!errors.company} />
                {errors.company && <p className="text-xs text-destructive">{errors.company.message}</p>}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="title">Job title *</Label>
                <Input id="title" {...register("title")} aria-invalid={!!errors.title} />
                {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="location">Location</Label>
                <Input id="location" {...register("location")} />
              </div>
              <div className="grid gap-1.5">
                <Label>Work mode</Label>
                <Select value={watch("workArrangement") || ""} onValueChange={(v) => setValue("workArrangement", v as JobFormValues["workArrangement"])}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="remote">Remote</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="onsite">Onsite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="salary">Salary</Label>
                <Input id="salary" placeholder="$90k – $110k" {...register("salary")} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="jobDescription">Job description</Label>
              <Textarea id="jobDescription" rows={5} placeholder="Paste the full job description here…" {...register("jobDescription")} />
            </div>
          </div>

          {analysis && (
            <AnalysisSummary
              analysis={analysis}
              selectedResumeId={watch("resumeId") || null}
              onApplyRecommendation={(resumeId) => setValue("resumeId", resumeId, { shouldDirty: true })}
              onRequestResumeEvidence={focusResumeSelection}
            />
          )}

          <Accordion type="multiple" value={openSections} onValueChange={setOpenSections} className="rounded-xl border border-border/70 bg-card/40 px-3.5">
            <AccordionItem value="evaluation">
              <AccordionTrigger>Evaluation</AccordionTrigger>
              <AccordionContent className="grid gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="grid gap-1.5">
                    <Label>Status</Label>
                    <Select value={watch("status")} onValueChange={(v) => setValue("status", v as JobFormValues["status"])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {JOB_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Verdict</Label>
                      {watch("verdict") && (
                        <span className="text-xs text-muted-foreground">
                          {deriveVerdictSource(
                            analysis?.analysis.verdict,
                            analysis?.analysis.candidateFit.fitScore,
                            watch("verdict") || "",
                            watch("fitScore") ?? null,
                          ) === "user"
                            ? "You set this"
                            : "🤖 AI recommended"}
                        </span>
                      )}
                    </div>
                    <Select
                      value={watch("verdict") || UNSET_SELECT_VALUE}
                      onValueChange={(v) => setValue("verdict", (v === UNSET_SELECT_VALUE ? "" : v) as JobFormValues["verdict"])}
                    >
                      <SelectTrigger><SelectValue placeholder="Not evaluated" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNSET_SELECT_VALUE}>Not evaluated</SelectItem>
                        {VERDICT_OPTIONS.map((v) => (
                          <SelectItem key={v.value} value={v.value}>{v.emoji} {v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="fitScore">Fit score (0–10)</Label>
                    <Input
                      id="fitScore"
                      type="number"
                      min={0}
                      max={10}
                      {...register("fitScore", { setValueAs: (v) => (v === "" || v === null || v === undefined ? null : Number(v)) })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label>Resume to use</Label>
                    <Select value={watch("resumeId") || ""} onValueChange={(v) => setValue("resumeId", v)}>
                      <SelectTrigger id="add-resume-select-trigger"><SelectValue placeholder="Not yet decided" /></SelectTrigger>
                      <SelectContent>
                        {resumes.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Priority</Label>
                    <Select value={String(watch("priority"))} onValueChange={(v) => setValue("priority", Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Low</SelectItem>
                        <SelectItem value="2">Normal</SelectItem>
                        <SelectItem value="3">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="application">
              <AccordionTrigger>Application details</AccordionTrigger>
              <AccordionContent className="grid gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="grid gap-1.5">
                    <Label>Employment type</Label>
                    <Select value={watch("employmentType") || ""} onValueChange={(v) => setValue("employmentType", v as JobFormValues["employmentType"])}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_time">Full-time</SelectItem>
                        <SelectItem value="part_time">Part-time</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="internship">Internship</SelectItem>
                        <SelectItem value="temporary">Temporary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="source">Source</Label>
                    <Input id="source" placeholder="LinkedIn, Indeed…" {...register("source")} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="deadline">Application deadline</Label>
                    <Input id="deadline" type="date" {...register("deadline")} />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="coverLetterUsed">Cover letter used</Label>
                  <Input id="coverLetterUsed" placeholder="e.g. Cover letter v2" {...register("coverLetterUsed")} />
                </div>
                {watch("status") === "applied" && (
                  <p className="text-xs text-muted-foreground">
                    Follow-up reminders are scheduled automatically when a job first reaches Applied, based on your Job Search
                    preferences.
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="recruiter">
              <AccordionTrigger>Recruiter</AccordionTrigger>
              <AccordionContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="recruiterName">Name</Label>
                  <Input id="recruiterName" {...register("recruiterName")} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="recruiterEmail">Email</Label>
                  <Input id="recruiterEmail" type="email" {...register("recruiterEmail")} aria-invalid={!!errors.recruiterEmail} />
                  {errors.recruiterEmail && <p className="text-xs text-destructive">{errors.recruiterEmail.message}</p>}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="recruiterLinkedin">LinkedIn</Label>
                  <Input id="recruiterLinkedin" placeholder="linkedin.com/in/…" {...register("recruiterLinkedin")} />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="notes">
              <AccordionTrigger>Notes</AccordionTrigger>
              <AccordionContent className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="strengths">Strengths</Label>
                  <Textarea id="strengths" rows={2} {...register("strengths")} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="missingQualifications">Missing qualifications</Label>
                  <Textarea id="missingQualifications" rows={2} {...register("missingQualifications")} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="notes">Personal notes</Label>
                  <Textarea id="notes" rows={2} {...register("notes")} />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <DialogFooter className="mt-1">
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save job"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
