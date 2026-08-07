import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, Download, ExternalLink, FileText, Sparkles, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { AnalysisSummary } from "@/components/jobs/AnalysisSummary";
import { StatusBadge } from "@/components/jobs/StatusBadge";
import { FollowUpCheckmark } from "@/components/jobs/FollowUpCheckmark";
import type { Job, Resume } from "@/types/database";
import { jobFormSchema, type JobFormValues } from "@/lib/validation";
import { useDeleteJob, useJobStatusHistory, useSaveCoverLetter, useUpdateJob } from "@/hooks/queries/useJobs";
import { useAnalyzeJob, useGenerateCoverLetter } from "@/hooks/queries/useJobAi";
import { useToast } from "@/components/shared/toast";
import { useCelebration } from "@/components/ambient/Celebration";
import { JOB_STATUSES, STATUS_META, UNSET_SELECT_VALUE, VERDICT_OPTIONS, normalizeEditableJobStatus } from "@/lib/constants";
import { dateInputToISO, deriveVerdictSource, formatDate, formatDateTime, toDateInputValue } from "@/lib/utils";
import type { JobAnalysisPayload } from "@/lib/ai";
import { ANALYSIS_PROGRESS_STEPS, COVER_LETTER_PROGRESS_STEPS, useProgressHint } from "@/hooks/useProgressHint";

interface JobDetailDialogProps {
  job: Job | null;
  resumes: Resume[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function jobToFormValues(job: Job): JobFormValues {
  return {
    company: job.company,
    title: job.title,
    location: job.location ?? "",
    workArrangement: job.work_arrangement ?? "",
    employmentType: job.employment_type ?? "",
    salary: job.salary ?? "",
    source: job.source ?? "",
    jobUrl: job.job_url ?? "",
    jobDescription: job.job_description ?? "",
    status: normalizeEditableJobStatus(job.status),
    verdict: job.verdict ?? "",
    fitScore: job.fit_score,
    resumeId: job.resume_id ?? "",
    coverLetterUsed: job.cover_letter_used ?? "",
    priority: job.priority,
    deadline: toDateInputValue(job.deadline),
    followUpDate: toDateInputValue(job.follow_up_date),
    interviewDate: toDateInputValue(job.interview_date),
    offerDate: toDateInputValue(job.offer_date),
    rejectionDate: toDateInputValue(job.rejection_date),
    recruiterName: job.recruiter_name ?? "",
    recruiterEmail: job.recruiter_email ?? "",
    recruiterLinkedin: job.recruiter_linkedin ?? "",
    strengths: job.strengths ?? "",
    missingQualifications: job.missing_qualifications ?? "",
    notes: job.notes ?? "",
  };
}

export function JobDetailDialog({ job, resumes, open, onOpenChange }: JobDetailDialogProps) {
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const analyzeJob = useAnalyzeJob();
  const generateCoverLetter = useGenerateCoverLetter();
  const saveCoverLetter = useSaveCoverLetter();
  const { data: history = [] } = useJobStatusHistory(job?.id ?? null);
  const { push } = useToast();
  const { celebrate } = useCelebration();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [analysisState, setAnalysisState] = React.useState<JobAnalysisPayload | null>(job?.ai_analysis ?? null);
  const [coverLetter, setCoverLetter] = React.useState(job?.ai_cover_letter ?? "");
  const [activeTab, setActiveTab] = React.useState("overview");
  const coverLetterDirty = coverLetter !== (job?.ai_cover_letter ?? "");
  const analyzingHint = useProgressHint(analyzeJob.isPending, ANALYSIS_PROGRESS_STEPS);
  const generatingCoverLetterHint = useProgressHint(generateCoverLetter.isPending, COVER_LETTER_PROGRESS_STEPS);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<JobFormValues>({ resolver: zodResolver(jobFormSchema) });

  // Keyed on job id, not the job object itself — the job prop now updates
  // reactively as the cache changes (a follow-up completed, a cover letter
  // generated, a realtime update from another tab) so this must only reset
  // the form when the dialog switches to a genuinely different job, never
  // wiping in-progress edits out from under someone because an unrelated
  // field changed underneath them.
  React.useEffect(() => {
    if (job) reset(jobToFormValues(job));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  React.useEffect(() => {
    setAnalysisState(job?.ai_analysis ?? null);
    setCoverLetter(job?.ai_cover_letter ?? "");
    setActiveTab("overview");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  if (!job) return null;

  function focusResumeSelection() {
    setActiveTab("evaluation");
    setTimeout(() => document.getElementById("detail-resume-select-trigger")?.focus(), 0);
  }

  async function onSubmit(values: JobFormValues) {
    if (!job) return;
    const wasOffer = job.status === "offer";
    try {
      const updated = await updateJob.mutateAsync({
        id: job.id,
        patch: {
          company: values.company.trim(),
          title: values.title.trim(),
          location: values.location?.trim() || null,
          work_arrangement: (values.workArrangement || null) as Job["work_arrangement"],
          employment_type: (values.employmentType || null) as Job["employment_type"],
          salary: values.salary?.trim() || null,
          source: values.source?.trim() || null,
          job_url: values.jobUrl?.trim() || null,
          job_description: values.jobDescription?.trim() || null,
          status: values.status,
          verdict: (values.verdict || null) as Job["verdict"],
          verdict_source: deriveVerdictSource(
            analysisState?.analysis.verdict,
            analysisState?.analysis.candidateFit.fitScore,
            values.verdict || "",
            values.fitScore ?? null,
          ),
          fit_score: values.fitScore ?? null,
          resume_id: values.resumeId || null,
          cover_letter_used: values.coverLetterUsed?.trim() || null,
          priority: values.priority,
          deadline: values.deadline || null,
          follow_up_date: values.followUpDate || null,
          interview_date: values.interviewDate ? dateInputToISO(values.interviewDate) : null,
          offer_date: values.offerDate ? dateInputToISO(values.offerDate) : null,
          rejection_date: values.rejectionDate ? dateInputToISO(values.rejectionDate) : null,
          recruiter_name: values.recruiterName?.trim() || null,
          recruiter_email: values.recruiterEmail?.trim() || null,
          recruiter_linkedin: values.recruiterLinkedin?.trim() || null,
          strengths: values.strengths?.trim() || null,
          missing_qualifications: values.missingQualifications?.trim() || null,
          notes: values.notes?.trim() || null,
        },
      });
      if (values.status === "applied" && !job.date_applied && updated.follow_up_date) {
        push(`Application recorded. We'll remind you to follow up on ${formatDate(updated.follow_up_date)}.`, "success");
      } else {
        push("Your changes have been saved.", "success");
      }
      if (values.status === "offer" && !wasOffer) celebrate("An offer! Take a moment — this is worth celebrating. 🎉");
      onOpenChange(false);
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't save your changes.", "error");
    }
  }

  async function handleDelete() {
    if (!job) return;
    await deleteJob.mutateAsync(job.id);
    push("This job has been removed.", "info");
    onOpenChange(false);
  }

  async function handleAnalyze() {
    if (!job) return;
    try {
      const result = await analyzeJob.mutateAsync({ jobId: job.id });
      setAnalysisState(result.analysis);
      setValue("company", result.analysis.jobExtraction.company ?? watch("company"), { shouldDirty: true });
      setValue("title", result.analysis.jobExtraction.jobTitle ?? watch("title"), { shouldDirty: true });
      setValue("location", result.analysis.jobExtraction.location ?? watch("location"), { shouldDirty: true });
      setValue("salary", result.analysis.jobExtraction.salary ?? watch("salary"), { shouldDirty: true });
      setValue("workArrangement", result.analysis.jobExtraction.workArrangement ?? watch("workArrangement"), { shouldDirty: true });
      setValue("deadline", toDateInputValue(result.analysis.jobExtraction.applicationDeadline), { shouldDirty: true });
      setValue("jobDescription", result.analysis.jobExtraction.rawJobText, { shouldDirty: true });
      setValue("fitScore", result.analysis.analysis.candidateFit.fitScore, { shouldDirty: true });
      setValue("verdict", result.analysis.analysis.verdict === "not_yet_assessed" ? "" : result.analysis.analysis.verdict, { shouldDirty: true });
      setValue("strengths", result.analysis.analysis.candidateFit.strongMatches.join("\n"), { shouldDirty: true });
      setValue(
        "missingQualifications",
        [
          ...result.analysis.analysis.candidateFit.criticalGaps.map((item) => `Critical: ${item}`),
          ...result.analysis.analysis.candidateFit.preferredGaps.map((item) => `Preferred: ${item}`),
        ].join("\n"),
        { shouldDirty: true },
      );
      if (!watch("resumeId") && result.selected_resume_id) {
        setValue("resumeId", result.selected_resume_id, { shouldDirty: true });
      }
      push("Analysis refreshed.", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't re-run the analysis.", "error");
    }
  }

  async function handleGenerateCoverLetter() {
    if (!job) return;
    try {
      const response = await generateCoverLetter.mutateAsync({
        jobId: job.id,
        selectedResumeId: watch("resumeId") || null,
      });
      // Persist the moment it's ready — not just in local state, and not
      // gated on the user separately clicking the form's "Save changes".
      await saveCoverLetter.mutateAsync({ id: job.id, coverLetter: response.cover_letter, resumeId: response.resume_id });
      setCoverLetter(response.cover_letter);
      if (response.resume_id) {
        setValue("resumeId", response.resume_id, { shouldDirty: false });
      }
      setActiveTab("cover-letter");
      push("Your cover letter is ready.", "success");
    } catch (err) {
      // Deliberately does not touch `coverLetter` — a failed regeneration
      // never clears or overwrites an existing saved draft.
      push(err instanceof Error ? err.message : "Couldn't generate a cover letter yet.", "error");
    }
  }

  async function handleSaveCoverLetterEdit() {
    if (!job) return;
    try {
      await saveCoverLetter.mutateAsync({ id: job.id, coverLetter, resumeId: null });
      push("Cover letter saved.", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't save your edits.", "error");
    }
  }

  async function handleCopyCoverLetter() {
    try {
      await navigator.clipboard.writeText(coverLetter);
      push("Copied to your clipboard.", "success");
    } catch {
      push("Couldn't copy — try selecting the text instead.", "error");
    }
  }

  function handleDownloadCoverLetter() {
    if (!job) return;
    const blob = new Blob([coverLetter], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job.company} - ${job.title} - cover letter.txt`.replace(/[/\\?%*:|"<>]/g, "-");
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <div>
              <DialogTitle>
                {job.title} <span className="font-sans text-sm font-normal text-muted-foreground">at {job.company}</span>
              </DialogTitle>
              <div className="mt-1.5 flex items-center gap-2">
                <StatusBadge status={job.status} />
              </div>
            </div>
            {job.job_url && (
              <a
                href={job.job_url}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Open listing <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex-wrap">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="evaluation">Evaluation</TabsTrigger>
              <TabsTrigger value="tracking">Tracking</TabsTrigger>
              <TabsTrigger value="recruiter">Recruiter</TabsTrigger>
              <TabsTrigger value="ai">AI Coach</TabsTrigger>
              <TabsTrigger value="cover-letter" className="gap-1.5">
                Cover Letter
                {job.ai_cover_letter && <Check className="h-3 w-3 text-success" aria-hidden="true" />}
              </TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="grid gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="d-company">Company</Label>
                  <Input id="d-company" {...register("company")} aria-invalid={!!errors.company} />
                  {errors.company && <p className="text-xs text-destructive">{errors.company.message}</p>}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="d-title">Job title</Label>
                  <Input id="d-title" {...register("title")} aria-invalid={!!errors.title} />
                  {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="d-location">Location</Label>
                  <Input id="d-location" {...register("location")} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Work mode</Label>
                  <Select value={watch("workArrangement") || ""} onValueChange={(v) => setValue("workArrangement", v as JobFormValues["workArrangement"], { shouldDirty: true })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="remote">Remote</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                      <SelectItem value="onsite">Onsite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="d-salary">Salary</Label>
                  <Input id="d-salary" {...register("salary")} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label>Status</Label>
                  <Select value={watch("status")} onValueChange={(v) => setValue("status", v as JobFormValues["status"], { shouldDirty: true })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {JOB_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Employment type</Label>
                  <Select value={watch("employmentType") || ""} onValueChange={(v) => setValue("employmentType", v as JobFormValues["employmentType"], { shouldDirty: true })}>
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
                  <Label htmlFor="d-source">Source</Label>
                  <Input id="d-source" {...register("source")} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="d-jobUrl">Job link</Label>
                <Input id="d-jobUrl" {...register("jobUrl")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="d-jobDescription">Job description</Label>
                <Textarea id="d-jobDescription" rows={6} {...register("jobDescription")} />
              </div>
            </TabsContent>

            <TabsContent value="evaluation" className="grid gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="d-fitScore">Fit score (0–10)</Label>
                  <Input
                    id="d-fitScore"
                    type="number"
                    min={0}
                    max={10}
                    {...register("fitScore", { setValueAs: (v) => (v === "" || v === null || v === undefined ? null : Number(v)) })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Verdict</Label>
                    {watch("verdict") && (
                      <span className="text-xs text-muted-foreground">
                        {deriveVerdictSource(
                          analysisState?.analysis.verdict,
                          analysisState?.analysis.candidateFit.fitScore,
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
                    onValueChange={(v) => setValue("verdict", (v === UNSET_SELECT_VALUE ? "" : v) as JobFormValues["verdict"], { shouldDirty: true })}
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
                  <Label>Priority</Label>
                  <Select value={String(watch("priority"))} onValueChange={(v) => setValue("priority", Number(v), { shouldDirty: true })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Low</SelectItem>
                      <SelectItem value="2">Normal</SelectItem>
                      <SelectItem value="3">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Resume used</Label>
                <Select value={watch("resumeId") || ""} onValueChange={(v) => setValue("resumeId", v, { shouldDirty: true })}>
                  <SelectTrigger id="detail-resume-select-trigger"><SelectValue placeholder="Not set" /></SelectTrigger>
                  <SelectContent>
                    {resumes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="d-strengths">Strengths</Label>
                <Textarea id="d-strengths" rows={3} {...register("strengths")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="d-missingQualifications">Missing qualifications</Label>
                <Textarea id="d-missingQualifications" rows={3} {...register("missingQualifications")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="d-notes">Personal notes</Label>
                <Textarea id="d-notes" rows={3} {...register("notes")} />
              </div>
            </TabsContent>

            <TabsContent value="tracking" className="grid gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Date found</Label>
                  <Input value={formatDate(job.date_found)} disabled />
                </div>
                <div className="grid gap-1.5">
                  <Label>Date applied</Label>
                  <Input value={formatDate(job.date_applied)} disabled />
                  <p className="text-xs text-muted-foreground">Set automatically the first time status reaches Applied.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="d-deadline">Application deadline</Label>
                  <Input id="d-deadline" type="date" {...register("deadline")} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="d-followUpDate">Follow-up date</Label>
                  <div className="flex items-center gap-2">
                    <Input id="d-followUpDate" type="date" {...register("followUpDate")} className="flex-1" />
                    {job.follow_up_date && <FollowUpCheckmark job={job} />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {job.followed_up_at
                      ? `Marked complete ${formatDate(job.followed_up_at)}.`
                      : "Bloom schedules this automatically when you first apply. Change it here only if you want a different follow-up."}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="d-interviewDate">Interview date</Label>
                  <Input id="d-interviewDate" type="date" {...register("interviewDate")} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="d-offerDate">Offer date</Label>
                  <Input id="d-offerDate" type="date" {...register("offerDate")} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="d-rejectionDate">Rejection date</Label>
                  <Input id="d-rejectionDate" type="date" {...register("rejectionDate")} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Interview, offer, and rejection dates are stamped automatically the first time a job reaches that stage — edit them
                here if the actual date was different.
              </p>
              <div className="grid gap-1.5">
                <Label htmlFor="d-coverLetterUsed">Cover letter used</Label>
                <Input id="d-coverLetterUsed" {...register("coverLetterUsed")} />
              </div>
            </TabsContent>

            <TabsContent value="recruiter" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="d-recruiterName">Name</Label>
                <Input id="d-recruiterName" {...register("recruiterName")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="d-recruiterEmail">Email</Label>
                <Input id="d-recruiterEmail" type="email" {...register("recruiterEmail")} aria-invalid={!!errors.recruiterEmail} />
                {errors.recruiterEmail && <p className="text-xs text-destructive">{errors.recruiterEmail.message}</p>}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="d-recruiterLinkedin">LinkedIn</Label>
                <Input id="d-recruiterLinkedin" {...register("recruiterLinkedin")} />
              </div>
            </TabsContent>

            <TabsContent value="ai" className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-card/50 p-3">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-primary" />
                    AI Coach
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
                    {analyzingHint ?? "Re-import and analyze this job from the saved URL or description to see how it fits your resume."}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleAnalyze} disabled={analyzeJob.isPending}>
                  {analyzeJob.isPending ? "Analyzing…" : "Run analysis"}
                </Button>
              </div>

              {analysisState ? (
                <AnalysisSummary
                  analysis={analysisState}
                  selectedResumeId={watch("resumeId") || null}
                  onApplyRecommendation={(resumeId) => setValue("resumeId", resumeId, { shouldDirty: true })}
                  onRequestResumeEvidence={focusResumeSelection}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                  Fit not assessed yet — run analysis once you've saved a job link or description.
                </div>
              )}
            </TabsContent>

            <TabsContent value="cover-letter" className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-card/50 p-3">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <FileText className="h-4 w-4 text-primary" />
                    Cover letter
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
                    {generatingCoverLetterHint ?? "Draws only on your selected resume, this job's saved text, and your career goal — nothing is invented."}
                  </p>
                </div>
                <Button type="button" size="sm" onClick={handleGenerateCoverLetter} disabled={generateCoverLetter.isPending}>
                  {generateCoverLetter.isPending ? "Generating…" : job.ai_cover_letter ? "Regenerate" : "Generate cover letter"}
                </Button>
              </div>

              {!job.ai_cover_letter && !coverLetter ? (
                <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center">
                  <p className="text-sm font-medium">No cover letter yet</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                    Choose the resume you want to use on the Evaluation tab, then generate one — it takes a few seconds.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {watch("resumeId") && resumes.find((r) => r.id === watch("resumeId"))
                        ? `Using ${resumes.find((r) => r.id === watch("resumeId"))?.name}`
                        : "Resume not set"}
                      {job.ai_cover_letter_updated_at && ` · Last updated ${formatDateTime(job.ai_cover_letter_updated_at)}`}
                    </span>
                    <div className="flex gap-1.5">
                      <Button type="button" variant="ghost" size="sm" onClick={handleCopyCoverLetter} className="h-7 gap-1 px-2 text-xs">
                        <Copy className="h-3 w-3" /> Copy
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={handleDownloadCoverLetter} className="h-7 gap-1 px-2 text-xs">
                        <Download className="h-3 w-3" /> Download
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    id="d-aiCoverLetter"
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    rows={14}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">Review this carefully before sending.</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleSaveCoverLetterEdit}
                      disabled={!coverLetterDirty || saveCoverLetter.isPending}
                    >
                      {saveCoverLetter.isPending ? "Saving…" : coverLetterDirty ? "Save edits" : "Saved"}
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="history">
              {history.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No status changes recorded yet.</p>
              ) : (
                <ol className="grid gap-2.5">
                  {history.map((h) => (
                    <li key={h.id} className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-sm">
                      <span>
                        {h.from_status ? (
                          <>
                            {STATUS_META[h.from_status].label} <span className="text-muted-foreground">→</span> {STATUS_META[h.to_status].label}
                          </>
                        ) : (
                          <>Created as {STATUS_META[h.to_status].label}</>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(h.changed_at)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </TabsContent>
          </Tabs>

          <Separator className="my-4" />

          <DialogFooter className="flex-row items-center justify-between sm:justify-between">
            <Button type="button" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Delete job</span>
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !isDirty}>
                {isSubmitting ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </DialogFooter>
        </form>

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={`Remove ${job.title}?`}
          description={`This removes ${job.title} at ${job.company} and its history. This can't be undone.`}
          confirmLabel="Delete job"
          onConfirm={handleDelete}
        />
      </DialogContent>
    </Dialog>
  );
}
