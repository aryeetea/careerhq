import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings, useUpdateSettings } from "@/hooks/queries/useProfile";
import { useResumes } from "@/hooks/queries/useResumes";
import { useToast } from "@/components/shared/toast";

export function AiResumeForm() {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const { data: resumes = [] } = useResumes();
  const { push } = useToast();

  if (!settings) return null;

  async function save(patch: Parameters<typeof updateSettings.mutateAsync>[0]) {
    try {
      await updateSettings.mutateAsync(patch);
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't save that.", "error");
    }
  }

  return (
    <div className="grid gap-5">
      <div>
        <p className="mb-2 text-sm font-medium">Default resume</p>
        <p className="mb-2 text-xs text-muted-foreground">
          Pre-selected when you add a new job. Bloom's AI can still recommend a different one for a specific role.
        </p>
        {resumes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Upload a resume first to set a default.</p>
        ) : (
          <Select
            value={settings.default_resume_id ?? "none"}
            onValueChange={(v) => save({ default_resume_id: v === "none" ? null : v })}
          >
            <SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No default — choose each time</SelectItem>
              {resumes.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3.5 py-2.5">
        <div className="min-w-0 pr-2">
          <p className="text-sm">Show AI fit score</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Display Bloom's fit score and verdict on job cards. Turn this off for a quieter board — your saved analyses aren't
            deleted, just hidden.
          </p>
        </div>
        <Switch
          checked={settings.show_ai_fit_score}
          onCheckedChange={(v) => save({ show_ai_fit_score: v })}
          aria-label="Show AI fit score"
        />
      </div>
    </div>
  );
}
