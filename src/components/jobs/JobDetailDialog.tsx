import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Check, Copy, Download, ExternalLink, FileText, Pencil, ScanSearch, Sparkles, Trash2, X } from "lucide-react";
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
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { AnalysisSummary } from "@/components/jobs/AnalysisSummary";
import { StatusBadge } from "@/components/jobs/StatusBadge";
import { FollowUpCheckmark } from "@/components/jobs/FollowUpCheckmark";
import { ResumeScoreGauge } from "@/components/jobs/ResumeScoreGauge";
import { TailoredResumePreview } from "@/components/jobs/TailoredResumePreview";
import { RESUME_TEMPLATE_IDS, RESUME_TEMPLATE_META, type ResumeTemplateId } from "@/lib/resumeTemplates";
import type { Job, JobAiResumeClaimCategory, JobAiResumeFix, JobAiResumeTailoring, Resume } from "@/types/database";
import { jobFormSchema, type JobFormValues } from "@/lib/validation";
import { useDeleteJob, useJobStatusHistory, useSaveCoverLetter, useSaveResumeTailoring, useUpdateJob } from "@/hooks/queries/useJobs";
import { useSettings } from "@/hooks/queries/useProfile";
import { useAnalyzeJob, useGenerateCoverLetter, useTailorResume } from "@/hooks/queries/useJobAi";
import { useToast } from "@/components/shared/toast";
import { useCelebration } from "@/components/ambient/Celebration";
import {
  getResumeScoreBand,
  JOB_STATUSES,
  RESUME_SUGGESTION_TYPE_META,
  STATUS_META,
  UNSET_SELECT_VALUE,
  VERDICT_META,
  VERDICT_OPTIONS,
  normalizeEditableJobStatus,
} from "@/lib/constants";
import { dateInputToISO, deriveVerdictSource, formatDate, formatDateTime, toDateInputValue } from "@/lib/utils";
import type { JobAnalysisPayload } from "@/lib/ai";
import { ANALYSIS_PROGRESS_STEPS, COVER_LETTER_PROGRESS_STEPS, TAILOR_RESUME_PROGRESS_STEPS, useProgressHint } from "@/hooks/useProgressHint";

interface JobDetailDialogProps {
  job: Job | null;
  resumes: Resume[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STRETCH_LEVEL_META: Record<JobAiResumeFix["stretch_level"], { label: string; badgeVariant: "success" | "warning" | "destructive" }> = {
  safe: { label: "Safe", badgeVariant: "success" },
  reasonable_stretch: { label: "Reasonable stretch", badgeVariant: "warning" },
  aggressive_stretch: { label: "Aggressive stretch", badgeVariant: "destructive" },
};

const CLAIM_CATEGORY_LABEL: Record<JobAiResumeClaimCategory["category"], string> = {
  summary: "Summary",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  skills: "Skills",
};

// Which suggested fixes are pre-checked when a fresh tailoring result
// arrives: safe/reasonable-stretch fixes that actually have text to swap
// in. Aggressive stretches start unchecked — the user should opt into
// those deliberately, not have them applied by default.
function defaultCheckedFixIndexes(fixes: JobAiResumeFix[]): Set<number> {
  const indexes = new Set<number>();
  fixes.forEach((fix, index) => {
    if (fix.original_text && fix.proposed_text && fix.stretch_level !== "aggressive_stretch") {
      indexes.add(index);
    }
  });
  return indexes;
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
  const tailorResume = useTailorResume();
  const saveResumeTailoring = useSaveResumeTailoring();
  const { data: history = [] } = useJobStatusHistory(job?.id ?? null);
  const { data: settings } = useSettings();
  const { push } = useToast();
  const { celebrate } = useCelebration();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [analysisState, setAnalysisState] = React.useState<JobAnalysisPayload | null>(job?.ai_analysis ?? null);
  const [coverLetter, setCoverLetter] = React.useState(job?.ai_cover_letter ?? "");
  const [tailoring, setTailoring] = React.useState<JobAiResumeTailoring | null>(job?.ai_resume_tailoring ?? null);
  const [tailoredResumeText, setTailoredResumeText] = React.useState(job?.ai_resume_tailoring?.tailored_resume ?? "");
  // Read-only rendered preview by default; the pencil icon switches to the
  // plain-text editor. Editing always happens on the underlying plain
  // text — see TailoredResumePreview's header note.
  const [editingTailoredResume, setEditingTailoredResume] = React.useState(false);
  // Which suggested_fixes are opted in for "Apply selected fixes" — see
  // defaultCheckedFixIndexes.
  const [checkedFixes, setCheckedFixes] = React.useState<Set<number>>(
    () => new Set(job?.ai_resume_tailoring ? defaultCheckedFixIndexes(job.ai_resume_tailoring.suggested_fixes) : []),
  );
  // Client-only visual choice for the rendered preview/PDF export — see
  // resumeTemplates.ts. Persisted onto the saved tailoring blob, but never
  // sent to or validated against the AI response schema.
  const [resumeTemplate, setResumeTemplate] = React.useState<ResumeTemplateId>(job?.ai_resume_tailoring?.template ?? "classic");
  const [activeTab, setActiveTab] = React.useState("overview");
  const coverLetterDirty = coverLetter !== (job?.ai_cover_letter ?? "");
  const tailoredResumeDirty = tailoredResumeText !== (job?.ai_resume_tailoring?.tailored_resume ?? "");
  const analyzingHint = useProgressHint(analyzeJob.isPending, ANALYSIS_PROGRESS_STEPS);
  const generatingCoverLetterHint = useProgressHint(generateCoverLetter.isPending, COVER_LETTER_PROGRESS_STEPS);
  const tailoringResumeHint = useProgressHint(tailorResume.isPending, TAILOR_RESUME_PROGRESS_STEPS);

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
    setTailoring(job?.ai_resume_tailoring ?? null);
    setTailoredResumeText(job?.ai_resume_tailoring?.tailored_resume ?? "");
    setEditingTailoredResume(false);
    setCheckedFixes(new Set(job?.ai_resume_tailoring ? defaultCheckedFixIndexes(job.ai_resume_tailoring.suggested_fixes) : []));
    setResumeTemplate(job?.ai_resume_tailoring?.template ?? "classic");
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

  // Status saves immediately on selection rather than waiting for the
  // form's own "Save changes" button — every other field in this dialog is
  // still staged-then-saved, but a status change is a discrete action
  // (like moving a card on a board) that people expect to take effect the
  // moment they pick it, not after a second, easy-to-miss click. Mirrors
  // the special-cased toasts/celebration onSubmit already does for a
  // status change, since a full-form save can also carry a status change.
  async function handleStatusChange(newStatus: JobFormValues["status"]) {
    if (!job) return;
    const previousStatus = watch("status");
    const wasOffer = job.status === "offer";
    // Optimistic, and shouldDirty: false so this alone doesn't enable the
    // Save button for the rest of the (unrelated, still-unsaved) form —
    // same pattern already used for resumeId after a cover letter save.
    setValue("status", newStatus, { shouldDirty: false });
    try {
      const updated = await updateJob.mutateAsync({ id: job.id, patch: { status: newStatus } });
      if (newStatus === "applied" && !job.date_applied && updated.follow_up_date) {
        push(`Application recorded. We'll remind you to follow up on ${formatDate(updated.follow_up_date)}.`, "success");
      } else if (settings?.hidden_statuses.includes(newStatus)) {
        // The status genuinely saved — but that board/list column is
        // hidden by default, so the job is about to disappear from view
        // with nothing else on screen explaining why. See Columns toggle.
        push(`Status updated to ${STATUS_META[newStatus].label} — that column is hidden on your board. Unhide it from Columns to see this job there.`, "info");
      } else {
        push("Status updated.", "success");
      }
      if (newStatus === "offer" && !wasOffer) celebrate("An offer! Take a moment — this is worth celebrating. 🎉");
      // Status is the one field that saves on pick rather than on a Save
      // button, so picking it is the whole interaction — close the dialog
      // the way a successful full-form save already does, instead of
      // leaving people to notice they still need to hit the X.
      onOpenChange(false);
    } catch (err) {
      setValue("status", previousStatus, { shouldDirty: false });
      push(err instanceof Error ? err.message : "Couldn't update the status.", "error");
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

  async function handleDownloadCoverLetter() {
    if (!job) return;
    const fileName = `${job.company} - ${job.title} - cover letter.pdf`.replace(/[/\\?%*:|"<>]/g, "-");
    try {
      // Dynamically imported: jsPDF pulls in its (unused, here) html2canvas
      // plugin at ~200KB, which would otherwise bloat this dialog's main
      // chunk for every user regardless of whether they ever click
      // Download. Loading it only on click keeps that cost off everyone
      // else's page weight.
      const { downloadCoverLetterPdf } = await import("@/lib/coverLetterPdf");
      downloadCoverLetterPdf(coverLetter, fileName);
    } catch {
      push("Couldn't create the PDF — try again in a moment.", "error");
    }
  }

  async function handleTailorResume() {
    if (!job) return;
    if (!watch("resumeId")) {
      push("Choose the resume you want to tailor on the Evaluation tab first.", "error");
      focusResumeSelection();
      return;
    }
    try {
      const response = await tailorResume.mutateAsync({
        jobId: job.id,
        selectedResumeId: watch("resumeId") || null,
      });
      // Persist the moment it's ready — same immediate-save pattern as the
      // cover letter, not gated on the form's separate "Save changes".
      // Carries the current template choice forward — a regenerate
      // shouldn't silently revert someone's chosen visual style.
      const tailoringToSave: JobAiResumeTailoring = { ...response, template: resumeTemplate };
      await saveResumeTailoring.mutateAsync({ id: job.id, tailoring: tailoringToSave, resumeId: response.resume_id });
      setTailoring(tailoringToSave);
      setTailoredResumeText(response.tailored_resume);
      setEditingTailoredResume(false);
      setCheckedFixes(defaultCheckedFixIndexes(response.suggested_fixes));
      if (response.resume_id) {
        setValue("resumeId", response.resume_id, { shouldDirty: false });
      }
      setActiveTab("tailor-resume");
      push("Your tailored resume is ready.", "success");
    } catch (err) {
      // Deliberately does not touch `tailoring`/`tailoredResumeText` — a
      // failed regeneration never clears or overwrites an existing draft.
      push(err instanceof Error ? err.message : "Couldn't tailor your resume yet.", "error");
    }
  }

  // Re-scores the user's own hand-edited draft without rewriting it — see
  // RESCORE MODE in careerCoach.ts. Distinct from handleTailorResume, which
  // always does a fresh rewrite from the original résumé.
  async function handleRecalculateScores() {
    if (!job || !tailoredResumeText.trim()) return;
    try {
      const response = await tailorResume.mutateAsync({
        jobId: job.id,
        selectedResumeId: watch("resumeId") || null,
        currentDraftText: tailoredResumeText,
      });
      const tailoringToSave: JobAiResumeTailoring = { ...response, template: resumeTemplate };
      await saveResumeTailoring.mutateAsync({ id: job.id, tailoring: tailoringToSave, resumeId: response.resume_id });
      setTailoring(tailoringToSave);
      setTailoredResumeText(response.tailored_resume);
      setCheckedFixes(defaultCheckedFixIndexes(response.suggested_fixes));
      push("Scores updated for your edited résumé.", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't recalculate scores.", "error");
    }
  }

  async function handleSaveTailoredResumeEdit() {
    if (!job || !tailoring) return;
    try {
      const updated = { ...tailoring, tailored_resume: tailoredResumeText };
      await saveResumeTailoring.mutateAsync({ id: job.id, tailoring: updated, resumeId: null });
      setTailoring(updated);
      push("Tailored resume saved.", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't save your edits.", "error");
    }
  }

  // Applies checked suggested_fixes as plain substring swaps against the
  // current draft — the safest general approach without a rich/structured
  // editor. Silently skips a fix whose original_text no longer appears
  // (e.g. already applied, or the user edited that spot manually).
  function handleApplySuggestedFixes() {
    if (!tailoring) return;
    let updated = tailoredResumeText;
    let appliedCount = 0;
    tailoring.suggested_fixes.forEach((fix, index) => {
      if (!checkedFixes.has(index) || !fix.original_text || !fix.proposed_text) return;
      if (updated.includes(fix.original_text)) {
        updated = updated.replace(fix.original_text, fix.proposed_text);
        appliedCount += 1;
      }
    });
    if (appliedCount === 0) {
      push("Couldn't find that exact text to replace — it may have already changed. Try editing manually instead.", "error");
      return;
    }
    setTailoredResumeText(updated);
    setEditingTailoredResume(true);
    setCheckedFixes(new Set());
    push(`Applied ${appliedCount} fix${appliedCount === 1 ? "" : "es"} — review, then save your edits.`, "success");
  }

  async function handleCopyTailoredResume() {
    try {
      await navigator.clipboard.writeText(tailoredResumeText);
      push("Copied to your clipboard.", "success");
    } catch {
      push("Couldn't copy — try selecting the text instead.", "error");
    }
  }

  async function handleDownloadTailoredResume() {
    if (!job) return;
    const fileName = `${job.company} - ${job.title} - tailored resume.pdf`.replace(/[/\\?%*:|"<>]/g, "-");
    try {
      // Dynamically imported for the same reason as coverLetterPdf (jsPDF's
      // html2canvas plugin) — template-aware, matching whatever the
      // rendered preview is currently showing (see resumeTemplates.ts).
      const { downloadTailoredResumePdf } = await import("@/lib/tailoredResumePdf");
      downloadTailoredResumePdf(tailoredResumeText, fileName, resumeTemplate);
    } catch {
      push("Couldn't create the PDF — try again in a moment.", "error");
    }
  }

  async function handleChangeTemplate(template: ResumeTemplateId) {
    setResumeTemplate(template);
    if (!job || !tailoring) return;
    try {
      const updated = { ...tailoring, template };
      await saveResumeTailoring.mutateAsync({ id: job.id, tailoring: updated, resumeId: null });
      setTailoring(updated);
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't save your template choice.", "error");
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
              <TabsTrigger value="tailor-resume" className="gap-1.5">
                Tailor Resume
                {job.ai_resume_tailoring && <Check className="h-3 w-3 text-success" aria-hidden="true" />}
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
                  <Select
                    value={watch("status")}
                    onValueChange={(v) => handleStatusChange(v as JobFormValues["status"])}
                    disabled={updateJob.isPending}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {JOB_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Saves immediately.</p>
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
                <AutoResizeTextarea
                  id="d-jobDescription"
                  minRows={6}
                  maxHeight={480}
                  value={watch("jobDescription") ?? ""}
                  onChange={(e) => setValue("jobDescription", e.target.value, { shouldDirty: true })}
                />
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
                <AutoResizeTextarea
                  id="d-strengths"
                  minRows={3}
                  maxHeight={320}
                  value={watch("strengths") ?? ""}
                  onChange={(e) => setValue("strengths", e.target.value, { shouldDirty: true })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="d-missingQualifications">Missing qualifications</Label>
                <AutoResizeTextarea
                  id="d-missingQualifications"
                  minRows={3}
                  maxHeight={320}
                  value={watch("missingQualifications") ?? ""}
                  onChange={(e) => setValue("missingQualifications", e.target.value, { shouldDirty: true })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="d-notes">Personal notes</Label>
                <AutoResizeTextarea
                  id="d-notes"
                  minRows={3}
                  maxHeight={320}
                  value={watch("notes") ?? ""}
                  onChange={(e) => setValue("notes", e.target.value, { shouldDirty: true })}
                />
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

              {/* Cover letters stay available at every verdict — Bloom advises,
                  it doesn't gate — but Stretch/Not Recommended roles get a
                  clear reminder of that recommendation before generating. */}
              {(job.verdict === "stretch_opportunity" || job.verdict === "not_recommended") && (
                <div className="flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2.5 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  <p className="text-foreground/85">
                    Bloom's current read on this role is{" "}
                    <span className="font-medium">
                      {VERDICT_META[job.verdict].emoji} {VERDICT_META[job.verdict].label}
                    </span>
                    . You can still generate a cover letter — this is advisory, and the decision is yours.
                  </p>
                </div>
              )}

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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleDownloadCoverLetter}
                        className="h-7 gap-1 px-2 text-xs"
                        title="Download as PDF"
                      >
                        <Download className="h-3 w-3" /> Download PDF
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

            <TabsContent value="tailor-resume" className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-card/50 p-3">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <ScanSearch className="h-4 w-4 text-primary" />
                    Tailor resume
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
                    {tailoringResumeHint ??
                      "Scores your selected resume against this posting's keywords, then rewrites it to a one-page version in your resume's own format — without inventing experience."}
                  </p>
                </div>
                <Button type="button" size="sm" onClick={handleTailorResume} disabled={tailorResume.isPending}>
                  {tailorResume.isPending ? "Tailoring…" : tailoring ? "Regenerate" : "Tailor resume"}
                </Button>
              </div>

              {!tailoring ? (
                <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center">
                  <p className="text-sm font-medium">No tailored resume yet</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                    Choose the resume you want to tailor on the Evaluation tab, then generate one — it takes up to a minute.
                  </p>
                </div>
              ) : (
                <>
                  {(() => {
                    // Explicit class maps, not `text-${variant}` string
                    // interpolation — Tailwind's build-time scanner only
                    // picks up class names that appear as literal strings
                    // in source, so a dynamically-built class name would
                    // silently produce no styling at all.
                    const overallBand = getResumeScoreBand(tailoring.overall_score);
                    const bannerCopy: Record<typeof overallBand.badgeVariant, string> = {
                      success: "Strong match — ready to send.",
                      default: "Good match — a few tweaks would strengthen it.",
                      warning: "Needs some work before sending.",
                      destructive: "Needs meaningful work before sending.",
                    };
                    const bannerClass: Record<typeof overallBand.badgeVariant, string> = {
                      success: "border-success/30 bg-success/10 text-success",
                      default: "border-primary/30 bg-primary/10 text-primary",
                      warning: "border-warning/30 bg-warning/10 text-warning",
                      destructive: "border-destructive/30 bg-destructive/10 text-destructive",
                    };
                    const labelClass: Record<typeof overallBand.badgeVariant, string> = {
                      success: "text-success",
                      default: "text-primary",
                      warning: "text-warning",
                      destructive: "text-destructive",
                    };
                    return (
                      <>
                        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium ${bannerClass[overallBand.badgeVariant]}`}>
                          {overallBand.badgeVariant === "success" ? <Check className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                          {bannerCopy[overallBand.badgeVariant]}
                        </div>

                        {tailoredResumeDirty && (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning">
                            <span className="flex items-center gap-1.5">
                              <AlertTriangle className="h-4 w-4 shrink-0" />
                              These scores predate your latest edit.
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleRecalculateScores}
                              disabled={tailorResume.isPending}
                              className="h-7 px-2 text-xs text-warning underline hover:bg-warning/15 hover:text-warning"
                            >
                              {tailorResume.isPending ? "Recalculating…" : "Recalculate"}
                            </Button>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border/60 bg-card/50 px-4 py-4">
                          <ResumeScoreGauge score={tailoring.overall_score} />
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overall</p>
                            <p className={`text-lg font-semibold ${labelClass[overallBand.badgeVariant]}`}>{overallBand.label}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Weighted read across all dimensions.
                              {watch("resumeId") && resumes.find((r) => r.id === watch("resumeId")) && ` Tailored from ${resumes.find((r) => r.id === watch("resumeId"))?.name}.`}
                              {job.ai_resume_tailoring_updated_at && ` Last updated ${formatDateTime(job.ai_resume_tailoring_updated_at)}.`}
                            </p>
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  <div className="grid gap-3">
                    {(
                      [
                        ["Job Match", tailoring.job_match],
                        ["ATS Readability", tailoring.ats_readability],
                        ["Evidence Strength", tailoring.evidence_strength],
                        ["Truthfulness", tailoring.truthfulness],
                      ] as const
                    ).map(([label, dimension]) => {
                      const band = getResumeScoreBand(dimension.score);
                      return (
                        <div key={label}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">{label}</p>
                            <div className="flex items-center gap-1.5 text-sm">
                              <Badge variant={band.badgeVariant}>{band.label}</Badge>
                              <span className="text-muted-foreground">{dimension.score}/100</span>
                            </div>
                          </div>
                          <Progress value={dimension.score} className="mt-1.5" />
                          <p className="mt-1 text-xs text-muted-foreground">{dimension.description}</p>
                        </div>
                      );
                    })}
                  </div>

                  {tailoring.claim_audit.length > 0 && (
                    <div className="rounded-xl border border-border/60 bg-card/50 px-4 py-4">
                      <p className="text-sm font-semibold">Risks</p>
                      <p className="text-xs text-muted-foreground">Claims that need evidence, and anything the record contradicts.</p>
                      <p className="mt-2 text-sm">
                        <span className="font-medium">{tailoring.missing_keywords.length}</span> requirement
                        {tailoring.missing_keywords.length === 1 ? "" : "s"} unaddressed
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {tailoring.claim_audit.map((group) => {
                          const supportedCount = group.claims.filter((c) => c.status === "supported").length;
                          const hasContradiction = group.claims.some((c) => c.status === "contradicted");
                          const hasNeedsEvidence = group.claims.some((c) => c.status === "needs_evidence");
                          const Icon = hasContradiction ? X : hasNeedsEvidence ? AlertTriangle : Check;
                          const colorClass = hasContradiction ? "text-destructive" : hasNeedsEvidence ? "text-warning" : "text-success";
                          return (
                            <span
                              key={group.category}
                              className={`inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs ${colorClass}`}
                            >
                              <Icon className="h-3 w-3" />
                              {CLAIM_CATEGORY_LABEL[group.category]} · {supportedCount} supported
                            </span>
                          );
                        })}
                      </div>
                      <Accordion type="single" collapsible className="mt-2">
                        <AccordionItem value="claim-audit" className="border-b-0">
                          <AccordionTrigger className="text-xs font-medium">Across the document</AccordionTrigger>
                          <AccordionContent>
                            <div className="grid gap-3 pb-1">
                              {tailoring.claim_audit.map((group) => (
                                <div key={group.category}>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    {CLAIM_CATEGORY_LABEL[group.category]}
                                  </p>
                                  <ul className="mt-1 grid gap-1">
                                    {group.claims.map((claim, index) => (
                                      <li key={index} className="flex items-start gap-1.5 text-sm">
                                        {claim.status === "supported" ? (
                                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
                                        ) : claim.status === "needs_evidence" ? (
                                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                                        ) : (
                                          <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                                        )}
                                        <span>
                                          {claim.text}
                                          {claim.status !== "supported" && (
                                            <span className="ml-1 text-xs text-muted-foreground">— {claim.note}</span>
                                          )}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  )}

                  <div className="grid gap-4">
                    {tailoring.missing_keywords.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Missing</p>
                        <ul className="mt-1.5 grid gap-1.5">
                          {tailoring.missing_keywords.map((item) => (
                            <li key={item} className="flex items-start gap-1.5 text-sm">
                              <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                              <span>
                                {item} <span className="text-xs text-destructive">(missing)</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {tailoring.weak_keywords.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Weak</p>
                        <ul className="mt-1.5 grid gap-1.5">
                          {tailoring.weak_keywords.map((item) => (
                            <li key={item} className="flex items-start gap-1.5 text-sm">
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                              <span>
                                {item} <span className="text-xs text-warning">(weak)</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {tailoring.covered_keywords.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Covered</p>
                        <ul className="mt-1.5 grid gap-1.5">
                          {tailoring.covered_keywords.map((item) => (
                            <li key={item} className="flex items-start gap-1.5 text-sm">
                              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                              <span>
                                {item} <span className="text-xs text-success">(covered)</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {tailoring.suggested_fixes.length > 0 && (
                    <Accordion type="single" collapsible defaultValue="suggested-fixes">
                      <AccordionItem value="suggested-fixes" className="rounded-xl border border-border/60 bg-card/50 px-3">
                        <AccordionTrigger className="text-sm">
                          <span>
                            <Sparkles className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
                            See suggested fixes ({tailoring.suggested_fixes.length})
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="pb-2 text-xs text-muted-foreground">
                            These stretch a bit beyond what your résumé strictly proves — each is labeled with how far. Pick the ones you can stand behind in an interview.
                          </p>
                          <div className="grid gap-2.5 pb-1">
                            {tailoring.suggested_fixes.map((fix, index) => {
                              const stretchMeta = STRETCH_LEVEL_META[fix.stretch_level];
                              const canApply = Boolean(fix.original_text && fix.proposed_text);
                              return (
                                <div key={`${fix.type}-${index}`} className="rounded-xl border border-border/60 bg-background px-3 py-3">
                                  <div className="flex items-start gap-2.5">
                                    {canApply && (
                                      <input
                                        type="checkbox"
                                        checked={checkedFixes.has(index)}
                                        onChange={(e) => {
                                          setCheckedFixes((prev) => {
                                            const next = new Set(prev);
                                            if (e.target.checked) next.add(index);
                                            else next.delete(index);
                                            return next;
                                          });
                                        }}
                                        className="mt-1 h-4 w-4 shrink-0 rounded border-border accent-primary"
                                        aria-label={`Include fix: ${fix.proposed_text ?? fix.rationale}`}
                                      />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <Badge variant={stretchMeta.badgeVariant}>{stretchMeta.label}</Badge>
                                        <Badge variant="outline">{RESUME_SUGGESTION_TYPE_META[fix.type]}</Badge>
                                      </div>
                                      {fix.proposed_text ? (
                                        <p className="mt-2 text-sm text-foreground/90">{fix.proposed_text}</p>
                                      ) : null}
                                      <p className="mt-1 text-sm italic text-muted-foreground">{fix.rationale}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {checkedFixes.size > 0 && (
                            <Button type="button" size="sm" className="mt-1" onClick={handleApplySuggestedFixes}>
                              Apply {checkedFixes.size} selected fix{checkedFixes.size === 1 ? "" : "es"}
                            </Button>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}

                  {tailoring.summary_of_changes.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold">What changed</p>
                      <ul className="mt-1.5 grid gap-1 text-sm text-muted-foreground">
                        {tailoring.summary_of_changes.map((change, index) => (
                          <li key={index} className="flex gap-1.5">
                            <span aria-hidden="true">•</span>
                            <span>{change}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">Tailored résumé</p>
                      <Select value={resumeTemplate} onValueChange={(v) => handleChangeTemplate(v as ResumeTemplateId)}>
                        <SelectTrigger className="h-7 w-[110px] text-xs" title="Template — visual style of the preview and PDF only, never the content">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RESUME_TEMPLATE_IDS.map((id) => (
                            <SelectItem key={id} value={id}>{RESUME_TEMPLATE_META[id].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingTailoredResume((v) => !v)}
                        className="h-7 gap-1 px-2 text-xs"
                        title={editingTailoredResume ? "Preview" : "Edit"}
                      >
                        <Pencil className="h-3 w-3" /> {editingTailoredResume ? "Preview" : "Edit"}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={handleCopyTailoredResume} className="h-7 gap-1 px-2 text-xs">
                        <Copy className="h-3 w-3" /> Copy
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleDownloadTailoredResume}
                        className="h-7 gap-1 px-2 text-xs"
                        title="Download as PDF"
                      >
                        <Download className="h-3 w-3" /> Download PDF
                      </Button>
                    </div>
                  </div>
                  {editingTailoredResume ? (
                    <Textarea
                      id="d-aiTailoredResume"
                      value={tailoredResumeText}
                      onChange={(e) => setTailoredResumeText(e.target.value)}
                      rows={18}
                    />
                  ) : (
                    <TailoredResumePreview text={tailoredResumeText} template={resumeTemplate} />
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">Review this carefully before submitting it anywhere.</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleSaveTailoredResumeEdit}
                      disabled={!tailoredResumeDirty || saveResumeTailoring.isPending}
                    >
                      {saveResumeTailoring.isPending ? "Saving…" : tailoredResumeDirty ? "Save edits" : "Saved"}
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
