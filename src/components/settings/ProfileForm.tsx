import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, LoaderCircle, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { TagInput } from "@/components/ui/tag-input";
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
import { EdgeFunctionError } from "@/lib/edgeFunctions";

// Maps the Edge Function's error code to copy specific to this feature.
// invokeEdgeFunction() already guarantees the message it attaches is
// generic/safe by default, but this feature has its own exact wording per
// failure mode, so we switch on `.code` rather than trusting `.message`.
function describeSuggestError(err: unknown): string {
  if (err instanceof EdgeFunctionError) {
    switch (err.code) {
      case "unauthenticated":
        return "Your session expired. Please sign in again.";
      case "rate_limited":
        return "You've requested several suggestions. Try again in a moment.";
      case "insufficient_context":
        return "Add a little more to your profile before asking Bloom for a suggestion.";
      case "validation_error":
        return "We couldn't create a suggestion from the current profile information.";
      case "not_configured":
        return "AI suggestions haven't been configured yet.";
      default:
        return "AI suggestions aren't available right now. Please try again shortly.";
    }
  }
  return "AI suggestions aren't available right now. Please try again shortly.";
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
  // Tracks which field is generating, for the per-button "Thinking…" state.
  const [pendingField, setPendingField] = React.useState<"bio" | "career_status" | null>(null);
  // suggestProfileCopy.isPending only reflects reality after React commits the
  // next render, which leaves a window where a fast double-click (or two
  // triggers of the same handler) can both slip through before the button's
  // `disabled` attribute updates. This ref is checked synchronously so a
  // second click inside that window is a no-op instead of a second request —
  // and a second toast if it fails.
  const suggestGuardRef = React.useRef(false);

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
      push("Your profile has been saved.", "success");
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
      push("Your photo has been updated.", "success");
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
    push("Your photo has been removed.", "info");
  }

  async function handleSuggest(field: "bio" | "career_status") {
    if (suggestGuardRef.current) return;
    suggestGuardRef.current = true;
    setPendingField(field);
    try {
      const suggestion = await suggestProfileCopy.mutateAsync({ field });
      setDraftSuggestion(suggestion);
    } catch (err) {
      push(describeSuggestError(err), "error");
    } finally {
      suggestGuardRef.current = false;
      setPendingField(null);
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
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-900">Make this feel like you.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">A few thoughtful details can help people understand who you are and what matters to you.</p>
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
            <Button type="button" variant="ghost" size="sm" onClick={onRemoveAvatar} className="text-slate-700 hover:text-slate-900">
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
          <h3 className="mt-2 font-display text-xl font-semibold tracking-tight">A little more about you.</h3>
        </div>

        <ProfileFieldCard
          label="About you"
          fieldId="p-bio"
          helperText="Share a little about yourself, your interests, and what you're passionate about."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSuggest("bio")}
              disabled={pendingField !== null}
            >
              {pendingField === "bio" ? (
                <>
                  <LoaderCircle className="animate-spin" /> Thinking…
                </>
              ) : (
                <>
                  <Sparkles /> AI Suggest
                </>
              )}
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
          helperText="What you're focused on in your career right now."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSuggest("career_status")}
              disabled={pendingField !== null}
            >
              {pendingField === "career_status" ? (
                <>
                  <LoaderCircle className="animate-spin" /> Thinking…
                </>
              ) : (
                <>
                  <Sparkles /> AI Suggest
                </>
              )}
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
          helperText="Share what's on your mind today."
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
          <div className="rounded-[1.6rem] border border-primary/20 bg-primary/5 p-4" aria-live="polite" role="status">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  Suggested {draftSuggestion.field === "bio" ? "About you" : "Career status"}
                </p>
                <p className="mt-1 text-sm leading-6 text-foreground/82">{draftSuggestion.suggestion}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{draftSuggestion.reason}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Built from what you've already shared in Bloom, including your goals and {resumes.length > 0 ? "resume experience" : "profile details"}.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setDraftSuggestion(null)} disabled={pendingField !== null}>
                  Keep my original
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSuggest(draftSuggestion.field)}
                  disabled={pendingField !== null}
                >
                  {pendingField === draftSuggestion.field ? (
                    <>
                      <LoaderCircle className="animate-spin" /> Thinking…
                    </>
                  ) : (
                    "Try another"
                  )}
                </Button>
                <Button type="button" size="sm" onClick={applySuggestion} disabled={pendingField !== null}>
                  Use suggestion
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="p-careerGoal">Career goal</Label>
        <AutoResizeTextarea
          id="p-careerGoal"
          minRows={2}
          maxHeight={180}
          value={watch("careerGoal") ?? ""}
          onChange={(event) => setValue("careerGoal", event.target.value, { shouldDirty: true, shouldValidate: true })}
          placeholder="The kind of work you're growing toward."
          error={!!errors.careerGoal}
          aria-describedby={errors.careerGoal ? "p-career-goal-error" : undefined}
        />
        {errors.careerGoal && <p id="p-career-goal-error" className="text-xs text-destructive">{errors.careerGoal.message}</p>}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="p-skills">Skills</Label>
        <TagInput
          value={watch("skills") ?? []}
          onChange={(next) => setValue("skills", next, { shouldDirty: true, shouldValidate: true })}
          placeholder="Type a skill and press Enter"
          ariaLabel="Skills"
          maxItems={20}
        />
        <p className="text-xs text-muted-foreground">Press Enter or comma to add each one.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="p-jobTitles">Roles you're targeting</Label>
          <TagInput
            value={watch("primaryJobTitles") ?? []}
            onChange={(next) => setValue("primaryJobTitles", next, { shouldDirty: true, shouldValidate: true })}
            placeholder="Type a role and press Enter"
            ariaLabel="Roles you're targeting"
            maxItems={10}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="p-locations">Preferred locations</Label>
          <TagInput
            value={watch("preferredLocations") ?? []}
            onChange={(next) => setValue("preferredLocations", next, { shouldDirty: true, shouldValidate: true })}
            placeholder="Type a location and press Enter"
            ariaLabel="Preferred locations"
            maxItems={10}
          />
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
