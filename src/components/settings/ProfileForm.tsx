import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, LoaderCircle, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { profileFormSchema, type ProfileFormValues } from "@/lib/validation";
import { useProfile, useUpdateAvatar, useUpdateProfile } from "@/hooks/queries/useProfile";
import { useResumes } from "@/hooks/queries/useResumes";
import { useSuggestProfileCopy } from "@/hooks/queries/useJobAi";
import { useSignedAvatarUrl } from "@/hooks/useSignedAvatarUrl";
import { removeAvatar as removeAvatarService } from "@/services/profiles";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/shared/toast";
import { initials } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";

function splitTags(value: string): string[] {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

export function ProfileForm() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: resumes = [] } = useResumes();
  const updateProfile = useUpdateProfile();
  const updateAvatar = useUpdateAvatar();
  const suggestProfileCopy = useSuggestProfileCopy();
  const avatarUrl = useSignedAvatarUrl(profile?.avatar_url);
  const { push } = useToast();
  const qc = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [draftSuggestion, setDraftSuggestion] = React.useState<{ field: "bio" | "career_status"; suggestion: string; reason: string } | null>(null);
  const [saveState, setSaveState] = React.useState<"idle" | "saved">("idle");

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting, isDirty } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    values: profile
      ? {
          displayName: profile.display_name,
          bio: profile.bio ?? "",
          careerGoal: profile.career_goal ?? "",
          careerStatus: profile.career_status ?? "",
          skills: profile.skills,
          primaryJobTitles: profile.primary_job_titles,
          preferredLocations: profile.preferred_locations,
          weeklyApplicationGoal: profile.weekly_application_goal,
          statusMessage: profile.status_message ?? "",
        }
      : undefined,
  });

  async function onSubmit(values: ProfileFormValues) {
    try {
      await updateProfile.mutateAsync({
        display_name: values.displayName.trim(),
        bio: values.bio?.trim() || null,
        career_goal: values.careerGoal?.trim() || null,
        career_status: values.careerStatus?.trim() || null,
        skills: values.skills,
        primary_job_titles: values.primaryJobTitles,
        preferred_locations: values.preferredLocations,
        weekly_application_goal: values.weeklyApplicationGoal,
        status_message: values.statusMessage?.trim() || null,
      });
      push("Profile updated", "success");
      reset(values);
      setSaveState("saved");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't save your profile.", "error");
    }
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      await updateAvatar.mutateAsync({ oldPath: profile?.avatar_url ?? null, file });
      push("Photo updated", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't update your photo.", "error");
    } finally {
      e.target.value = "";
    }
  }

  async function onRemoveAvatar() {
    if (!user || !profile?.avatar_url) return;
    const updated = await removeAvatarService(user.id, profile.avatar_url);
    qc.setQueryData(queryKeys.profile(user.id), updated);
    push("Photo removed", "info");
  }

  async function handleSuggest(field: "bio" | "career_status") {
    try {
      const suggestion = await suggestProfileCopy.mutateAsync({ field });
      setDraftSuggestion(suggestion);
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't generate a suggestion right now.", "error");
    }
  }

  function applySuggestion() {
    if (!draftSuggestion) return;
    if (draftSuggestion.field === "bio") {
      setValue("bio", draftSuggestion.suggestion, { shouldDirty: true });
    } else {
      setValue("careerStatus", draftSuggestion.suggestion, { shouldDirty: true });
    }
    push("Suggestion added. You can still edit it before saving.", "success");
    setDraftSuggestion(null);
  }

  if (!profile) return null;

  const bioValue = watch("bio") ?? "";
  const careerStatusValue = watch("careerStatus") ?? "";
  const statusMessageValue = watch("statusMessage") ?? "";

  React.useEffect(() => {
    if (isDirty) setSaveState("idle");
  }, [isDirty]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6" noValidate>
      <div className="rounded-[2rem] border border-border/65 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,255,255,0.5))] p-5 shadow-soft sm:p-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/75">Your Profile</p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">A steady introduction, with room for today.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/72">Keep it brief, clear, and easy to revisit.</p>
        </div>

        <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar className="h-16 w-16 border border-border">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
            <AvatarFallback className="text-base">{initials(profile.display_name)}</AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft"
          >
            <Camera className="h-3 w-3" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={onAvatarChange} />
        </div>
        {profile.avatar_url && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemoveAvatar} className="text-muted-foreground">
            <X className="h-3.5 w-3.5" /> Remove photo
          </Button>
        )}
      </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="p-displayName">Display name</Label>
          <Input id="p-displayName" placeholder="Jane Doe" {...register("displayName")} aria-invalid={!!errors.displayName} />
          {errors.displayName && <p className="text-xs text-destructive">{errors.displayName.message}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="p-weeklyGoal">Weekly application goal</Label>
          <Input id="p-weeklyGoal" type="number" min={0} max={200} {...register("weeklyApplicationGoal")} />
        </div>
      </div>

      <div className="grid gap-4 rounded-[2rem] border border-border/65 bg-card/55 p-5 shadow-soft sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/75">Voice</p>
          <h3 className="mt-2 font-display text-xl font-semibold tracking-tight">Short, human profile details.</h3>
        </div>

        <ProfileFieldCard
          label="About you"
          fieldId="p-bio"
          helperText="A short introduction that rarely changes."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSuggest("bio")}
              disabled={suggestProfileCopy.isPending}
            >
              {suggestProfileCopy.isPending && draftSuggestion?.field !== "bio" ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
              AI Suggest
            </Button>
          }
        >
          <AutoResizeTextarea
            id="p-bio"
            minRows={1}
            maxHeight={144}
            value={bioValue}
            onChange={(event) => setValue("bio", event.target.value, { shouldDirty: true, shouldValidate: true })}
            placeholder="IT graduate building thoughtful digital products."
            error={!!errors.bio}
            aria-describedby={errors.bio ? "p-bio-error" : undefined}
          />
          {errors.bio && <p id="p-bio-error" className="text-xs text-destructive">{errors.bio.message}</p>}
        </ProfileFieldCard>

        <ProfileFieldCard
          label="Career status"
          fieldId="p-careerStatus"
          helperText="What you're focused on right now."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSuggest("career_status")}
              disabled={suggestProfileCopy.isPending}
            >
              {suggestProfileCopy.isPending && draftSuggestion?.field !== "career_status" ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
              AI Suggest
            </Button>
          }
        >
          <AutoResizeTextarea
            id="p-careerStatus"
            minRows={1}
            maxHeight={128}
            value={careerStatusValue}
            onChange={(event) => setValue("careerStatus", event.target.value, { shouldDirty: true, shouldValidate: true })}
            placeholder="Seeking entry-level product and project roles."
            error={!!errors.careerStatus}
            aria-describedby={errors.careerStatus ? "p-career-status-error" : undefined}
          />
          {errors.careerStatus && <p id="p-career-status-error" className="text-xs text-destructive">{errors.careerStatus.message}</p>}
        </ProfileFieldCard>

        <ProfileFieldCard
          label="Today's thought"
          fieldId="p-statusMessage"
          helperText="What's on your mind today?"
        >
          <AutoResizeTextarea
            id="p-statusMessage"
            minRows={1}
            maxHeight={128}
            value={statusMessageValue}
            onChange={(event) => setValue("statusMessage", event.target.value, { shouldDirty: true, shouldValidate: true })}
            placeholder="Staying consistent and trusting the process."
            error={!!errors.statusMessage}
            aria-describedby={errors.statusMessage ? "p-status-message-error" : undefined}
          />
          {errors.statusMessage && <p id="p-status-message-error" className="text-xs text-destructive">{errors.statusMessage.message}</p>}
        </ProfileFieldCard>

        {draftSuggestion && (
          <div className="rounded-[1.6rem] border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  Suggested {draftSuggestion.field === "bio" ? "About you" : "Career status"}
                </p>
                <p className="mt-1 text-sm leading-6 text-foreground/82">{draftSuggestion.suggestion}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{draftSuggestion.reason}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Built from the profile, goals, and {resumes.length > 0 ? "resume evidence" : "current Bloom details"} you already have in Bloom.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setDraftSuggestion(null)}>
                  Keep mine
                </Button>
                <Button type="button" size="sm" onClick={applySuggestion}>
                  Use suggestion
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="p-careerGoal">Career goal</Label>
        <Textarea id="p-careerGoal" rows={2} {...register("careerGoal")} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="p-skills">Skills</Label>
        <Input id="p-skills" placeholder="Figma, User Research, SQL" defaultValue={watch("skills")?.join(", ")} onChange={(e) => setValue("skills", splitTags(e.target.value), { shouldDirty: true })} />
        <p className="text-xs text-muted-foreground">Comma-separated. Shown as chips on your profile.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="p-jobTitles">Roles you're targeting</Label>
          <Input id="p-jobTitles" defaultValue={watch("primaryJobTitles")?.join(", ")} onChange={(e) => setValue("primaryJobTitles", splitTags(e.target.value), { shouldDirty: true })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="p-locations">Preferred locations</Label>
          <Input id="p-locations" defaultValue={watch("preferredLocations")?.join(", ")} onChange={(e) => setValue("preferredLocations", splitTags(e.target.value), { shouldDirty: true })} />
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          {isDirty && (
            <>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save profile"}
              </Button>
              <p className="text-sm text-muted-foreground">Unsaved changes</p>
            </>
          )}
          {!isDirty && saveState === "saved" && <p className="text-sm text-success">Saved</p>}
        </div>
      </div>
    </form>
  );
}

function ProfileFieldCard({
  label,
  fieldId,
  helperText,
  action,
  children,
}: {
  label: string;
  fieldId: string;
  helperText: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.6rem] border border-border/60 bg-background/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Label htmlFor={fieldId} className="text-sm font-semibold">
            {label}
          </Label>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{helperText}</p>
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
      <div className="mt-3 grid gap-2">{children}</div>
    </div>
  );
}
