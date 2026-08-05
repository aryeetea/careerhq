import * as React from "react";
import { FileText, Plus } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { ResumeCard } from "@/components/resumes/ResumeCard";
import { ResumeFormDialog } from "@/components/resumes/ResumeFormDialog";
import { useResumes } from "@/hooks/queries/useResumes";
import { useJobs } from "@/hooks/queries/useJobs";
import { ENCOURAGING_EMPTY_MESSAGES } from "@/lib/constants";
import type { Resume } from "@/types/database";

export default function Resumes() {
  const { data: resumes = [], isLoading, isError, refetch } = useResumes();
  const { data: jobs = [] } = useJobs();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Resume | null>(null);

  const statsByResume = React.useMemo(() => {
    const map = new Map<string, { jobCount: number; interviewCount: number; responseCount: number }>();
    for (const job of jobs) {
      if (!job.resume_id) continue;
      const s = map.get(job.resume_id) ?? { jobCount: 0, interviewCount: 0, responseCount: 0 };
      s.jobCount += 1;
      if (job.status === "interview" || job.status === "final_interview") s.interviewCount += 1;
      if (["interview", "final_interview", "offer", "rejected"].includes(job.status)) s.responseCount += 1;
      map.set(job.resume_id, s);
    }
    return map;
  }, [jobs]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(resume: Resume) {
    setEditing(resume);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        title="Resumes"
        subtitle="The versions you apply with"
        action={
          resumes.length > 0 && (
            <Button onClick={openCreate} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add resume</span>
            </Button>
          )
        }
      />

      <div className="flex-1 overflow-y-auto px-4 pb-10 sm:px-8">
        {isError ? (
          <ErrorState description="Your resumes couldn't load. Your files are safe — try again." onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        ) : resumes.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="No resumes yet"
            description={ENCOURAGING_EMPTY_MESSAGES.noResumes}
            action={
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Upload your first resume
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {resumes.map((r) => (
              <ResumeCard
                key={r.id}
                resume={r}
                stats={statsByResume.get(r.id) ?? { jobCount: 0, interviewCount: 0, responseCount: 0 }}
                onEdit={() => openEdit(r)}
              />
            ))}
          </div>
        )}
      </div>

      <ResumeFormDialog open={formOpen} onOpenChange={setFormOpen} resume={editing} />
    </div>
  );
}
