import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Check, Sparkles } from "lucide-react";
import { AmbientBackground } from "@/components/ambient/AmbientBackground";
import { BotanicalAccent } from "@/components/ambient/BotanicalAccent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { onboardingSchema, type OnboardingValues } from "@/lib/validation";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, useCompleteOnboarding, useUpdateAvatar } from "@/hooks/queries/useProfile";
import { isUsernameAvailable } from "@/services/profiles";
import { useToast } from "@/components/shared/toast";
import { cn, initials } from "@/lib/utils";

const STEPS = ["Welcome", "About you", "Your goal", "Sharing"] as const;

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const completeOnboarding = useCompleteOnboarding();
  const updateAvatar = useUpdateAvatar();
  const { push } = useToast();
  const [step, setStep] = React.useState(0);
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = React.useState<"idle" | "checking" | "available" | "taken">("idle");
  const [jobTitlesInput, setJobTitlesInput] = React.useState("");
  const [locationsInput, setLocationsInput] = React.useState("");

  const {
    register,
    handleSubmit,
    reset,
    trigger,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      displayName: "",
      username: "",
      careerGoal: "",
      primaryJobTitles: [],
      preferredLocations: [],
      weeklyApplicationGoal: 5,
      sharingEnabled: false,
    },
  });

  const username = watch("username");
  const sharingEnabled = watch("sharingEnabled");
  const displayName = watch("displayName");

  React.useEffect(() => {
    if (!profile) return;
    const nextValues: OnboardingValues = {
      displayName: profile.display_name ?? "",
      username: profile.username ?? "",
      careerGoal: profile.career_goal ?? "",
      primaryJobTitles: profile.primary_job_titles ?? [],
      preferredLocations: profile.preferred_locations ?? [],
      weeklyApplicationGoal: profile.weekly_application_goal ?? 5,
      sharingEnabled: profile.sharing_enabled ?? false,
    };
    reset(nextValues);
    setJobTitlesInput(nextValues.primaryJobTitles.join(", "));
    setLocationsInput(nextValues.preferredLocations.join(", "));
  }, [profile, reset]);

  React.useEffect(() => {
    if (!username || username.length < 3) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    const t = setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(username, user?.id);
        setUsernameStatus(available ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [username, user?.id]);

  React.useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function goNext() {
    const fieldsByStep: (keyof OnboardingValues)[][] = [
      [],
      ["displayName", "username"],
      ["weeklyApplicationGoal"],
      [],
    ];
    const valid = await trigger(fieldsByStep[step]);
    if (!valid) return;
    if (step === 1 && (usernameStatus === "taken" || usernameStatus === "checking")) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function onSubmit(values: OnboardingValues) {
    try {
      await completeOnboarding.mutateAsync({
        display_name: values.displayName,
        username: values.username,
        career_goal: values.careerGoal || null,
        primary_job_titles: values.primaryJobTitles,
        preferred_locations: values.preferredLocations,
        weekly_application_goal: values.weeklyApplicationGoal,
        sharing_enabled: values.sharingEnabled,
      });
      if (avatarFile && user) {
        await updateAvatar.mutateAsync({ oldPath: profile?.avatar_url ?? null, file: avatarFile });
      }
      push("You're all set. Let's find you something great.", "success");
      navigate("/app", { replace: true });
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't save that — mind trying again?", "error");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <AmbientBackground />
      <div className="relative z-10 w-full max-w-lg">
        <div className="mb-5 flex items-center justify-center gap-1.5">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-1.5">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                  i < step ? "bg-success text-success-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                )}
              >
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={cn("h-px w-6", i < step ? "bg-success" : "bg-border")} />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="glass-strong relative overflow-hidden rounded-2xl p-7 sm:p-8" noValidate>
          <BotanicalAccent className="pointer-events-none absolute -right-6 -top-8 h-40 w-32 rotate-12" />

          {step === 0 && (
            <div className="relative flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-6 w-6" />
              </div>
              <h1 className="font-display text-2xl font-semibold text-balance">Welcome to Bloom</h1>
              <p className="max-w-sm text-sm text-muted-foreground">
                A calm place to keep track of everything — the roles you're weighing, the applications you've sent, and the people
                cheering you on. This takes about a minute.
              </p>
              <Button type="button" size="lg" className="mt-3 w-full" onClick={goNext}>
                Let's go
              </Button>
              {profile?.onboarded_at && (
                <Button type="button" variant="ghost" size="sm" onClick={() => navigate("/app", { replace: true })}>
                  I&apos;ve already done this
                </Button>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="relative grid gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold">A little about you</h2>
                <p className="text-sm text-muted-foreground">This is how friends will find and recognize you.</p>
              </div>

              <div className="flex items-center gap-4">
                <label htmlFor="avatar" className="group relative cursor-pointer">
                  <Avatar className="h-16 w-16 border-2 border-card shadow-soft">
                    {avatarPreview && <AvatarImage src={avatarPreview} alt="" />}
                    <AvatarFallback className="text-base">{initials(displayName || "You")}</AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft transition-transform group-hover:scale-105">
                    <Camera className="h-3 w-3" />
                  </span>
                  <input id="avatar" type="file" accept="image/*" className="sr-only" onChange={onAvatarChange} />
                </label>
                <p className="text-xs text-muted-foreground">Optional. You can add or change this anytime in Settings.</p>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="displayName">Display name</Label>
                <Input id="displayName" {...register("displayName")} aria-invalid={!!errors.displayName} />
                {errors.displayName && <p className="text-xs text-destructive">{errors.displayName.message}</p>}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="username">Username</Label>
                <Input id="username" placeholder="aileen_j" {...register("username")} aria-invalid={!!errors.username} />
                {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
                {!errors.username && usernameStatus === "checking" && <p className="text-xs text-muted-foreground">Checking…</p>}
                {!errors.username && usernameStatus === "available" && <p className="text-xs text-success">Available</p>}
                {!errors.username && usernameStatus === "taken" && <p className="text-xs text-destructive">That one's taken — try another</p>}
                <p className="text-xs text-muted-foreground">This is how friends search for you. It's never shown publicly.</p>
              </div>

              <StepButtons onBack={() => setStep(0)} onNext={goNext} />
            </div>
          )}

          {step === 2 && (
            <div className="relative grid gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold">What are you working toward?</h2>
                <p className="text-sm text-muted-foreground">Rough is fine — you can refine this later.</p>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="careerGoal">Career goal</Label>
                <Textarea id="careerGoal" rows={2} placeholder="e.g. Land a security analyst role at a mission-driven company" {...register("careerGoal")} />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="primaryJobTitles">Roles you're targeting</Label>
                <Input
                  id="primaryJobTitles"
                  placeholder="Product Designer, UX Researcher"
                  value={jobTitlesInput}
                  onChange={(e) => {
                    setJobTitlesInput(e.target.value);
                    setValue("primaryJobTitles", splitTags(e.target.value), { shouldDirty: true });
                  }}
                />
                <p className="text-xs text-muted-foreground">Separate with commas.</p>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="preferredLocations">Preferred locations</Label>
                <Input
                  id="preferredLocations"
                  placeholder="Remote, Chicago, IL"
                  value={locationsInput}
                  onChange={(e) => {
                    setLocationsInput(e.target.value);
                    setValue("preferredLocations", splitTags(e.target.value), { shouldDirty: true });
                  }}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="weeklyApplicationGoal">Weekly application goal</Label>
                <Input id="weeklyApplicationGoal" type="number" min={0} max={200} {...register("weeklyApplicationGoal")} />
                <p className="text-xs text-muted-foreground">A gentle target, not a quota. You can change this anytime.</p>
              </div>

              <StepButtons onBack={() => setStep(1)} onNext={goNext} />
            </div>
          )}

          {step === 3 && (
            <div className="relative grid gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold">Sharing progress</h2>
                <p className="text-sm text-muted-foreground">
                  Your applications, notes, and recruiter details are always private. If you turn this on, you can choose later
                  exactly what high-level progress friends can see — nothing is shared automatically.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-card/60 p-4">
                <div>
                  <p className="text-sm font-medium">Enable social features</p>
                  <p className="text-xs text-muted-foreground">Add friends and share progress later, from Settings → Privacy.</p>
                </div>
                <Switch checked={sharingEnabled} onCheckedChange={(v) => setValue("sharingEnabled", v)} />
              </div>

              <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button type="submit" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? "Setting things up…" : "Enter Bloom"}
                </Button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function splitTags(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function StepButtons({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="mt-1 flex justify-between">
      <Button type="button" variant="outline" onClick={onBack}>
        Back
      </Button>
      <Button type="button" onClick={onNext}>
        Continue
      </Button>
    </div>
  );
}
