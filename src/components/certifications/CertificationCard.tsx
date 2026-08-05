import * as React from "react";
import { Award, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { CERTIFICATION_STATUS_META } from "@/lib/constants";
import { useDeleteCertification } from "@/hooks/queries/useCertifications";
import { useToast } from "@/components/shared/toast";
import { formatDate } from "@/lib/utils";
import type { Certification } from "@/types/database";

export function CertificationCard({ certification, onEdit }: { certification: Certification; onEdit: () => void }) {
  const deleteCert = useDeleteCertification();
  const { push } = useToast();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const meta = CERTIFICATION_STATUS_META[certification.status];

  async function handleDelete() {
    await deleteCert.mutateAsync(certification);
    push("Certification removed", "info");
  }

  return (
    <Card className="hover-lift">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage/15 text-sage">
            <Award className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{certification.name}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{certification.provider || "Self-paced"}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>{meta.label}</span>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span className="font-medium text-foreground">{certification.progress_percentage}%</span>
          </div>
          <Progress value={certification.progress_percentage} className="mt-1.5" />
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
          {certification.target_completion_date && <span>Target {formatDate(certification.target_completion_date)}</span>}
          {certification.completion_date && <span>Completed {formatDate(certification.completion_date)}</span>}
          {certification.expiration_date && <span>Expires {formatDate(certification.expiration_date)}</span>}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {certification.course_link && (
            <Button variant="outline" size="sm" asChild className="flex-1 min-w-[90px]">
              <a href={certification.course_link} target="_blank" rel="noreferrer noopener">
                <ExternalLink className="h-3.5 w-3.5" /> Course
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" aria-label={`Edit ${certification.name}`} onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Delete ${certification.name}`}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Remove "${certification.name}"?`}
        description="This can't be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </Card>
  );
}
