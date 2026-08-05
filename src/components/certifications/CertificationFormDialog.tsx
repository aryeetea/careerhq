import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UploadCloud } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { certificationFormSchema, type CertificationFormValues } from "@/lib/validation";
import { useCreateCertification, useUpdateCertification } from "@/hooks/queries/useCertifications";
import { useToast } from "@/components/shared/toast";
import { toDateInputValue } from "@/lib/utils";
import type { Certification } from "@/types/database";

const SUGGESTIONS = [
  "Google Cybersecurity Professional Certificate",
  "ISC2 Certified in Cybersecurity",
  "CompTIA Security+",
  "CAPM",
  "Google Project Management Certificate",
];

export function CertificationFormDialog({ open, onOpenChange, certification }: { open: boolean; onOpenChange: (open: boolean) => void; certification?: Certification | null }) {
  const create = useCreateCertification();
  const update = useUpdateCertification();
  const { push } = useToast();
  const [file, setFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const isEdit = Boolean(certification);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<CertificationFormValues>({
    resolver: zodResolver(certificationFormSchema),
    defaultValues: { name: "", provider: "", status: "not_started", progressPercentage: 0, startDate: "", targetCompletionDate: "", completionDate: "", expirationDate: "", courseLink: "", notes: "" },
  });

  React.useEffect(() => {
    if (open) {
      reset(
        certification
          ? {
              name: certification.name,
              provider: certification.provider ?? "",
              status: certification.status,
              progressPercentage: certification.progress_percentage,
              startDate: toDateInputValue(certification.start_date),
              targetCompletionDate: toDateInputValue(certification.target_completion_date),
              completionDate: toDateInputValue(certification.completion_date),
              expirationDate: toDateInputValue(certification.expiration_date),
              courseLink: certification.course_link ?? "",
              notes: certification.notes ?? "",
            }
          : { name: "", provider: "", status: "not_started", progressPercentage: 0, startDate: "", targetCompletionDate: "", completionDate: "", expirationDate: "", courseLink: "", notes: "" }
      );
      setFile(null);
    }
  }, [open, certification, reset]);

  async function onSubmit(values: CertificationFormValues) {
    const patch = {
      name: values.name.trim(),
      provider: values.provider?.trim() || null,
      status: values.status,
      progress_percentage: values.progressPercentage,
      start_date: values.startDate || null,
      target_completion_date: values.targetCompletionDate || null,
      completion_date: values.completionDate || null,
      expiration_date: values.expirationDate || null,
      course_link: values.courseLink?.trim() || null,
      notes: values.notes?.trim() || null,
    };
    try {
      if (isEdit && certification) {
        await update.mutateAsync({ id: certification.id, patch, file });
        push("Certification updated", "success");
      } else {
        await create.mutateAsync({ input: patch, file });
        push(`Added ${values.name}`, "success");
      }
      onOpenChange(false);
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't save that.", "error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit certification" : "Add a certification"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="c-name">Name *</Label>
            <Input id="c-name" list="cert-suggestions" {...register("name")} aria-invalid={!!errors.name} />
            <datalist id="cert-suggestions">
              {SUGGESTIONS.map((s) => <option key={s} value={s} />)}
            </datalist>
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="c-provider">Provider</Label>
              <Input id="c-provider" placeholder="Google, ISC2, CompTIA…" {...register("provider")} />
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={watch("status")} onValueChange={(v) => setValue("status", v as CertificationFormValues["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not started</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-progress">Progress ({watch("progressPercentage")}%)</Label>
            <input
              id="c-progress"
              type="range"
              min={0}
              max={100}
              step={5}
              {...register("progressPercentage")}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="c-startDate">Start date</Label>
              <Input id="c-startDate" type="date" {...register("startDate")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-targetCompletionDate">Target completion</Label>
              <Input id="c-targetCompletionDate" type="date" {...register("targetCompletionDate")} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="c-completionDate">Completion date</Label>
              <Input id="c-completionDate" type="date" {...register("completionDate")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-expirationDate">Expiration date</Label>
              <Input id="c-expirationDate" type="date" {...register("expirationDate")} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-courseLink">Course link</Label>
            <Input id="c-courseLink" placeholder="https://…" {...register("courseLink")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-certFile">Certificate file</Label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/60 px-4 py-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              <UploadCloud className="h-4 w-4" />
              {file ? file.name : certification?.certificate_file_path ? "Replace certificate file" : "Upload certificate (optional)"}
            </button>
            <input ref={fileInputRef} id="c-certFile" type="file" accept=".pdf,.png,.jpg,.jpeg" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-notes">Notes</Label>
            <Textarea id="c-notes" rows={2} {...register("notes")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
