import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { profileFormSchema, type ProfileFormValues } from "@/lib/validation";
import { useProfile, useUpdateAvatar, useUpdateProfile } from "@/hooks/queries/useProfile";
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
  const updateProfile = useUpdateProfile();
  const updateAvatar = useUpdateAvatar();
  const avatarUrl = useSignedAvatarUrl(profile?.avatar_url);
  const { push } = useToast();
  const qc = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  if (!profile) return null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
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

      <div className="grid gap-1.5">
        <Label htmlFor="p-bio">Professional bio</Label>
        <Input id="p-bio" placeholder="Product Designer passionate about thoughtful digital experiences" {...register("bio")} maxLength={160} />
        <p className="text-xs text-muted-foreground">A one-line intro. This stays stable — it's how you introduce yourself, not how you feel today.</p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="p-careerStatus">Career status</Label>
        <Input id="p-careerStatus" placeholder="Open to Product Design opportunities" {...register("careerStatus")} maxLength={120} />
        <p className="text-xs text-muted-foreground">Your current focus — changes every so often, not daily. Different from the quick thought below.</p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="p-statusMessage">Today's thought</Label>
        <Input id="p-statusMessage" placeholder="Preparing for tomorrow's interview" {...register("statusMessage")} maxLength={140} />
        <p className="text-xs text-muted-foreground">
          A quick, temporary note — friends who follow your progress can see this. You can also update just this from your Profile
          page without opening Settings.
        </p>
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
        <Button type="submit" disabled={isSubmitting || !isDirty}>{isSubmitting ? "Saving…" : "Save profile"}</Button>
      </div>
    </form>
  );
}
