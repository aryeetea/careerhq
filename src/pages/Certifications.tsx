import * as React from "react";
import { GraduationCap, Plus } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { PageContent, PageContainer } from "@/components/layout/PageContent";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { CertificationCard } from "@/components/certifications/CertificationCard";
import { CertificationFormDialog } from "@/components/certifications/CertificationFormDialog";
import { useCertifications } from "@/hooks/queries/useCertifications";
import { ENCOURAGING_EMPTY_MESSAGES } from "@/lib/constants";
import type { Certification } from "@/types/database";

export default function Certifications() {
  const { data: certifications = [], isLoading, isError, refetch } = useCertifications();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Certification | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(cert: Certification) {
    setEditing(cert);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        title="Certifications"
        subtitle="Courses and credentials you're building"
        action={
          certifications.length > 0 && (
            <Button onClick={openCreate} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add certification</span>
            </Button>
          )
        }
      />
      <PageContent>
        <PageContainer>
        {isError ? (
          <ErrorState description="Your certifications couldn't load. Your data is safe — try again." onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
          </div>
        ) : certifications.length === 0 ? (
          <EmptyState
            icon={<GraduationCap className="h-5 w-5" />}
            title="Nothing tracked yet"
            description={ENCOURAGING_EMPTY_MESSAGES.noCertifications}
            action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add a certification</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {certifications.map((c) => (
              <CertificationCard key={c.id} certification={c} onEdit={() => openEdit(c)} />
            ))}
          </div>
        )}
        </PageContainer>
      </PageContent>
      <CertificationFormDialog open={formOpen} onOpenChange={setFormOpen} certification={editing} />
    </div>
  );
}
