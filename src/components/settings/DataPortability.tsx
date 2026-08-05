import * as React from "react";
import { FileJson, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useJobs, useCreateJob } from "@/hooks/queries/useJobs";
import { useCertifications, useCreateCertification } from "@/hooks/queries/useCertifications";
import { exportCsv, exportJson, parseBackupFile } from "@/lib/dataPortability";
import { useToast } from "@/components/shared/toast";
import type { BackupData } from "@/lib/validation";

export function DataPortability() {
  const { data: jobs = [] } = useJobs();
  const { data: certifications = [] } = useCertifications();
  const createJob = useCreateJob();
  const createCertification = useCreateCertification();
  const { push } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState<BackupData | null>(null);
  const [importing, setImporting] = React.useState(false);

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = await parseBackupFile(file);
      setPending(data);
    } catch (err) {
      push(err instanceof Error ? `That file doesn't look right: ${err.message}` : "Couldn't read that file.", "error");
    }
  }

  async function confirmImport() {
    if (!pending) return;
    setImporting(true);
    try {
      for (const j of pending.jobs) {
        await createJob.mutateAsync({
          company: j.company,
          title: j.title,
          location: j.location ?? null,
          salary: j.salary ?? null,
          work_arrangement: (j.work_arrangement ?? null) as never,
          employment_type: (j.employment_type ?? null) as never,
          source: j.source ?? null,
          job_url: j.job_url ?? null,
          job_description: j.job_description ?? null,
          status: (j.status ?? "saved") as never,
          verdict: (j.verdict ?? null) as never,
          fit_score: j.fit_score ?? null,
          priority: j.priority ?? 2,
          notes: j.notes ?? null,
          follow_up_date: j.follow_up_date ?? null,
          recruiter_name: j.recruiter_name ?? null,
          recruiter_email: j.recruiter_email ?? null,
          recruiter_linkedin: j.recruiter_linkedin ?? null,
          strengths: j.strengths ?? null,
          missing_qualifications: j.missing_qualifications ?? null,
        });
      }
      for (const c of pending.certifications) {
        await createCertification.mutateAsync({
          input: {
            name: c.name,
            provider: c.provider ?? null,
            status: (c.status ?? "not_started") as never,
            progress_percentage: c.progress_percentage ?? 0,
            start_date: c.start_date ?? null,
            target_completion_date: c.target_completion_date ?? null,
            completion_date: c.completion_date ?? null,
            expiration_date: c.expiration_date ?? null,
            course_link: c.course_link ?? null,
            notes: c.notes ?? null,
          },
        });
      }
      push(`Imported ${pending.jobs.length} job${pending.jobs.length === 1 ? "" : "s"} and ${pending.certifications.length} certification${pending.certifications.length === 1 ? "" : "s"}.`, "success");
      setPending(null);
    } catch (err) {
      push(err instanceof Error ? err.message : "Import failed partway through.", "error");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="grid gap-3">
      <Card className="border-border/60 bg-card/60">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium">Export everything</p>
            <p className="text-xs text-muted-foreground">A full JSON backup of your jobs and certifications.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => exportJson(jobs, certifications)}>
            <FileJson className="h-3.5 w-3.5" /> Export JSON
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/60">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium">Export jobs as CSV</p>
            <p className="text-xs text-muted-foreground">Good for spreadsheets, or sharing with a mentor.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => exportCsv(jobs)}>
            <FileSpreadsheet className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/60">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium">Import a JSON backup</p>
            <p className="text-xs text-muted-foreground">Adds to what's already here — it won't replace or delete anything.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Choose file
          </Button>
          <input ref={fileInputRef} type="file" accept="application/json" className="sr-only" onChange={onFileSelected} />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(open) => !open && setPending(null)}
        title="Import this backup?"
        description={
          pending
            ? `This will add ${pending.jobs.length} job${pending.jobs.length === 1 ? "" : "s"} and ${pending.certifications.length} certification${pending.certifications.length === 1 ? "" : "s"} to your account. Nothing existing will be changed or removed.`
            : ""
        }
        confirmLabel={importing ? "Importing…" : "Import"}
        onConfirm={confirmImport}
      />
    </div>
  );
}

