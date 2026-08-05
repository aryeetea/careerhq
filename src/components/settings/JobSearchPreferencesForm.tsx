import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useSettings, useUpdateSettings } from "@/hooks/queries/useProfile";
import { useResumes } from "@/hooks/queries/useResumes";
import { useToast } from "@/components/shared/toast";

const FOLLOW_UP_OPTIONS = [
  { value: "3", label: "3 days" },
  { value: "5", label: "5 days" },
  { value: "7", label: "7 days" },
  { value: "10", label: "10 days" },
  { value: "14", label: "14 days" },
  { value: "none", label: "Do not schedule automatically" },
] as const;

export function JobSearchPreferencesForm() {
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
        <p className="mb-2 text-sm font-medium">Default application follow-up</p>
        <p className="mb-2 text-xs text-muted-foreground">
          When a job first moves to Applied, Bloom can schedule the first check-in for you. You can still override the date later
          from the job detail page.
        </p>
        <Select
          value={settings.default_application_follow_up_days === null ? "none" : String(settings.default_application_follow_up_days)}
          onValueChange={(value) =>
            save({
              default_application_follow_up_days: value === "none" ? null : (Number(value) as 3 | 5 | 7 | 10 | 14),
            })
          }
        >
          <SelectTrigger className="w-full sm:w-80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FOLLOW_UP_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Default resume</p>
        <p className="mb-2 text-xs text-muted-foreground">
          Pre-selected when you add a new job. Bloom&apos;s AI can still recommend a different one for a specific role.
        </p>
        {resumes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Upload a resume first to set a default.</p>
        ) : (
          <Select
            value={settings.default_resume_id ?? "none"}
            onValueChange={(value) => save({ default_resume_id: value === "none" ? null : value })}
          >
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No default — choose each time</SelectItem>
              {resumes.map((resume) => (
                <SelectItem key={resume.id} value={resume.id}>
                  {resume.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3.5 py-2.5">
        <div className="min-w-0 pr-2">
          <p className="text-sm">Show AI fit score</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Display Bloom&apos;s fit score and verdict on job cards. Turn this off for a quieter board — your saved analyses
            aren&apos;t deleted, just hidden.
          </p>
        </div>
        <Switch
          checked={settings.show_ai_fit_score}
          onCheckedChange={(value) => save({ show_ai_fit_score: value })}
          aria-label="Show AI fit score"
        />
      </div>
    </div>
  );
}
