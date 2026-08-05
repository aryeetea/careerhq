import * as React from "react";
import { FileText, ExternalLink, Trash2, Pencil, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useReplaceResumeFile, useDeleteResume } from "@/hooks/queries/useResumes";
import { useSignedUrl } from "@/hooks/useSignedAvatarUrl";
import { useToast } from "@/components/shared/toast";
import { formatDate } from "@/lib/utils";
import type { Resume } from "@/types/database";

interface ResumeStats {
  jobCount: number;
  interviewCount: number;
  responseCount: number;
}

export function ResumeCard({ resume, stats, onEdit }: { resume: Resume; stats: ResumeStats; onEdit: () => void }) {
  const replaceFile = useReplaceResumeFile();
  const deleteResume = useDeleteResume();
  const { push } = useToast();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const signedUrl = useSignedUrl("resumes", resume.file_path);

  async function handleReplace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await replaceFile.mutateAsync({ resume, file });
      push("File replaced", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't replace that file.", "error");
    } finally {
      e.target.value = "";
    }
  }

  async function handleDelete() {
    await deleteResume.mutateAsync(resume);
    push("Resume deleted", "info");
  }

  return (
    <Card className="hover-lift">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{resume.name}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {resume.target_role ? `${resume.target_role} · ` : ""}Updated {formatDate(resume.updated_at)}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-secondary/50 py-2.5 text-center">
          <div>
            <p className="text-sm font-semibold tabular-nums">{stats.jobCount}</p>
            <p className="text-[10px] text-muted-foreground">Used on</p>
          </div>
          <div>
            <p className="text-sm font-semibold tabular-nums">{stats.interviewCount}</p>
            <p className="text-[10px] text-muted-foreground">Interviews</p>
          </div>
          <div>
            <p className="text-sm font-semibold tabular-nums">{stats.responseCount}</p>
            <p className="text-[10px] text-muted-foreground">Responses</p>
          </div>
        </div>

        {resume.notes && <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{resume.notes}</p>}

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" disabled={!signedUrl} asChild={Boolean(signedUrl)} className="flex-1 min-w-[90px]">
            {signedUrl ? (
              <a href={signedUrl} target="_blank" rel="noreferrer noopener">
                <ExternalLink className="h-3.5 w-3.5" /> Open
              </a>
            ) : (
              <span>
                <ExternalLink className="h-3.5 w-3.5" /> No file
              </span>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="sr-only" onChange={handleReplace} />
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete "${resume.name}"?`}
        description={
          stats.jobCount > 0
            ? `It's linked to ${stats.jobCount} job${stats.jobCount === 1 ? "" : "s"}, which will be unlinked. This can't be undone.`
            : "This can't be undone."
        }
        confirmLabel="Delete resume"
        onConfirm={handleDelete}
      />
    </Card>
  );
}
