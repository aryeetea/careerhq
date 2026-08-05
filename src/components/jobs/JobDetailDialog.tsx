import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, Sparkles, Trash2 } from "lucide-react";
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
import type { Job, Resume } from "@/types/database";
import { jobFormSchema, type JobFormValues } from "@/lib/validation";
import { useDeleteJob, useJobStatusHistory, useUpdateJob } from "@/hooks/queries/useJobs";
import { useAnalyzeJob, useGenerateCoverLetter } from "@/hooks/queries/useJobAi";
import { useToast } from "@/components/shared/toast";
import { useCelebration } from "@/components/ambient/Celebration";
import { JOB_STATUSES, STATUS_META, UNSET_SELECT_VALUE, VERDICT_OPTIONS } from "@/lib/constants";
import { dateInputToISO, formatDate, formatDateTime, toDateInputValue } from "@/lib/utils";
import type { JobAnalysisPayload } from "@/lib/ai";

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
    status: job.status,
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
  const { data: history = [] } = useJobStatusHistory(job?.id ?? null);
  const { push } = useToast();
  const { celebrate } = useCelebration();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [analysisState, setAnalysisState] = React.useState<JobAnalysisPayload | null>(job?.ai_analysis ?? null);
  const [coverLetter, setCoverLetter] = React.useState(job?.ai_cover_letter ?? "");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<JobFormValues>({ resolver: zodResolver(jobFormSchema) });

  React.useEffect(() => {
    if (job) reset(jobToFormValues(job));
  }, [job, reset]);

  React.useEffect(() => {
    setAnalysisState(job?.ai_analysis ?? null);
    setCoverLetter(job?.ai_cover_letter ?? "");
  }, [job]);

  if (!job) return null;

  async function onSubmit(values: JobFormValues) {
    if (!job) return;
    const wasOffer = job.status === "offer";
    try {
      await updateJob.mutateAsync({
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
          ai_cover_letter: coverLetter.trim() || null,
        },
      });
      push("Job updated", "success");
      if (values.status === "offer" && !wasOffer) celebrate("An offer! Take a moment — this is worth celebrating. 🎉");
      onOpenChange(false);
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't save your changes.", "error");
    }
  }

  async function handleDelete() {
    if (!job) return;
    await deleteJob.mutateAsync(job.id);
    push("Job removed", "info");
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
      setValue("fitScore", result.analysis.analysis.fitScore, { shouldDirty: true });
      setValue("verdict", result.analysis.analysis.verdict, { shouldDirty: true });
      setValue("strengths", result.analysis.analysis.strongMatches.join("\n"), { shouldDirty: true });
      setValue(
        "missingQualifications",
        [
          ...result.analysis.analysis.criticalGaps.map((item) => `Critical: ${item}`),
          ...result.analysis.analysis.preferredGaps.map((item) => `Preferred: ${item}`),
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
      setCoverLetter(response.cover_letter);
      if (response.resume_id) {
        setValue("resumeId", response.resume_id, { shouldDirty: true });
      }
      push("Cover letter draft generated.", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't generate a cover letter yet.", "error");
    }
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
          <Tabs defaultValue="overview">
            <TabsList className="flex-wrap">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="evaluation">Evaluation</TabsTrigger>
              <TabsTrigger value="tracking">Tracking</TabsTrigger>
              <TabsTrigger value="recruiter">Recruiter</TabsTrigger>
              <TabsTrigger value="ai">AI</TabsTrigger>
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
                  <Label>Verdict</Label>
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
                  <SelectTrigger><SelectValue placeholder="Not set" /></SelectTrigger>
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
                  <Input id="d-followUpDate" type="date" {...register("followUpDate")} />
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
                    AI tools
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Re-import and analyze this job from the saved URL or description, then generate a cover letter from the selected resume.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleAnalyze} disabled={analyzeJob.isPending}>
                    {analyzeJob.isPending ? "Analyzing…" : "Run analysis"}
                  </Button>
                  <Button type="button" size="sm" onClick={handleGenerateCoverLetter} disabled={generateCoverLetter.isPending}>
                    {generateCoverLetter.isPending ? "Generating…" : "Generate cover letter"}
                  </Button>
                </div>
              </div>

              {analysisState ? (
                <AnalysisSummary
                  analysis={analysisState}
                  selectedResumeId={watch("resumeId") || null}
                  onApplyRecommendation={(resumeId) => setValue("resumeId", resumeId, { shouldDirty: true })}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                  No AI analysis has been saved for this job yet.
                </div>
              )}

              <div className="grid gap-1.5">
                <Label htmlFor="d-aiCoverLetter">Cover letter draft</Label>
                <Textarea
                  id="d-aiCoverLetter"
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  rows={12}
                  placeholder="Generate a draft after choosing the resume you want to use."
                />
                <p className="text-xs text-muted-foreground">
                  Review this carefully before sending. It draws only on your selected resume, the saved job text, and your career
                  goal from your profile — nothing is invented.
                </p>
              </div>
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
