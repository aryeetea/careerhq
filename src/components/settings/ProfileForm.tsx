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
          careerGoal: profile.career_goal ?? "",
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
        career_goal: values.careerGoal?.trim() || null,
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
        <Label htmlFor="p-statusMessage">Status message</Label>
        <Input id="p-statusMessage" placeholder="A short note friends can see" {...register("statusMessage")} maxLength={140} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="p-careerGoal">Career goal</Label>
        <Textarea id="p-careerGoal" rows={2} {...register("careerGoal")} />
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
