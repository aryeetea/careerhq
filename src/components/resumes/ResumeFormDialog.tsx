import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UploadCloud } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { resumeFormSchema, type ResumeFormValues } from "@/lib/validation";
import { useCreateResume, useUpdateResume } from "@/hooks/queries/useResumes";
import { useToast } from "@/components/shared/toast";
import type { Resume } from "@/types/database";

const ACCEPTED = ".pdf,.doc,.docx";

export function ResumeFormDialog({ open, onOpenChange, resume }: { open: boolean; onOpenChange: (open: boolean) => void; resume?: Resume | null }) {
  const createResume = useCreateResume();
  const updateResume = useUpdateResume();
  const { push } = useToast();
  const [file, setFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const isEdit = Boolean(resume);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResumeFormValues>({ resolver: zodResolver(resumeFormSchema), defaultValues: { name: "", targetRole: "", notes: "" } });

  React.useEffect(() => {
    if (open) reset({ name: resume?.name ?? "", targetRole: resume?.target_role ?? "", notes: resume?.notes ?? "" });
  }, [open, resume, reset]);

  function close(next: boolean) {
    if (!next) setFile(null);
    onOpenChange(next);
  }

  async function onSubmit(values: ResumeFormValues) {
    try {
      if (isEdit && resume) {
        await updateResume.mutateAsync({
          id: resume.id,
          patch: { name: values.name.trim(), target_role: values.targetRole?.trim() || null, notes: values.notes?.trim() || null },
        });
        push("Resume updated", "success");
      } else {
        const created = await createResume.mutateAsync({
          name: values.name.trim(),
          targetRole: values.targetRole?.trim() || null,
          notes: values.notes?.trim() || null,
          file,
        });
        push(`Added ${created.name}`, "success");
      }
      close(false);
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't save that resume.", "error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit resume" : "Add a resume"}</DialogTitle>
          <DialogDescription>Give it a name you'll recognize later, like "Product Design — v3".</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="r-name">Name *</Label>
            <Input id="r-name" {...register("name")} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="r-targetRole">Target role</Label>
            <Input id="r-targetRole" placeholder="e.g. Product Designer" {...register("targetRole")} />
          </div>
          {!isEdit && (
            <div className="grid gap-1.5">
              <Label htmlFor="r-file">File</Label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/60 px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                <UploadCloud className="h-4 w-4" />
                {file ? file.name : "Choose a PDF or Word file"}
              </button>
              <input ref={fileInputRef} id="r-file" type="file" accept={ACCEPTED} className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="r-notes">Notes</Label>
            <Textarea id="r-notes" rows={3} placeholder="What's different about this version?" {...register("notes")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save resume"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
