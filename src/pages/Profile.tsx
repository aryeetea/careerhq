import { Link } from "react-router-dom";
import { CalendarDays, MapPin, Pencil, Shield, Sparkles, Target, UserRound, Users2 } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/EmptyState";
import { useProfile, usePrivacySettings } from "@/hooks/queries/useProfile";
import { useSignedAvatarUrl } from "@/hooks/useSignedAvatarUrl";
import { initials, timeAgo } from "@/lib/utils";
import type { Profile } from "@/types/database";

function completionPercent(profile: Profile) {
  const checks = [
    Boolean(profile.avatar_url),
    Boolean(profile.display_name),
    Boolean(profile.username),
    Boolean(profile.career_goal),
    profile.primary_job_titles.length > 0,
    profile.preferred_locations.length > 0,
    profile.weekly_application_goal > 0,
    Boolean(profile.status_message),
    Boolean(profile.onboarded_at),
  ];

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

export default function ProfilePage() {
  const { data: profile } = useProfile();
  const { data: privacy } = usePrivacySettings();
  const avatarUrl = useSignedAvatarUrl(profile?.avatar_url ?? null);

  if (!profile) {
    return (
      <div className="flex flex-1 flex-col">
        <TopBar title="Profile" subtitle="How Bloom knows and represents you" />
        <div className="flex-1 overflow-y-auto px-4 pb-10 sm:px-8">
          <EmptyState
            icon={<UserRound className="h-5 w-5" />}
            title="Your profile is still taking shape"
            description="Finish onboarding first, then your profile will live here with your preferences, sharing settings, and account snapshot."
            action={
              <Button asChild>
                <Link to="/onboarding">Finish onboarding</Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const percent = completionPercent(profile);
  const visibilityLabel =
    privacy?.profile_visibility === "friends_only"
      ? "Friends only"
      : privacy?.profile_visibility === "selected_friends"
        ? "Selected friends"
        : privacy?.profile_visibility === "hidden"
          ? "Hidden"
          : "Private";

  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        title="Profile"
        subtitle="A warm, private snapshot of you and your search"
        action={
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/app/settings">
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Edit profile</span>
            </Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 pb-10 sm:px-8">
        <div className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
          <Card className="glass-subtle border-border/60">
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20 border border-border/80 shadow-soft">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                    <AvatarFallback className="text-lg">{initials(profile.display_name || "You")}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-2xl font-semibold">{profile.display_name}</h2>
                    <p className="truncate text-sm text-foreground/68">@{profile.username}</p>
                    {profile.status_message ? (
                      <p className="mt-2 max-w-lg text-sm leading-6 text-foreground/78">{profile.status_message}</p>
                    ) : (
                      <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                        Add a short status message in Settings if you want friends to see how you&apos;re feeling this week.
                      </p>
                    )}
                  </div>
                </div>

                <div className="min-w-[12rem] rounded-2xl border border-border/70 bg-card/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Profile completion</p>
                    <span className="text-sm font-semibold text-primary">{percent}%</span>
                  </div>
                  <Progress value={percent} className="mt-3" />
                  <p className="mt-3 text-xs leading-5 text-foreground/65">
                    A fuller profile makes Bloom&apos;s dashboard and social features feel more personal.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <InfoCard
                  icon={<Target className="h-4 w-4 text-primary" />}
                  label="Career goal"
                  value={profile.career_goal || "Not added yet"}
                />
                <InfoCard
                  icon={<CalendarDays className="h-4 w-4 text-gold" />}
                  label="Weekly application goal"
                  value={profile.weekly_application_goal > 0 ? `${profile.weekly_application_goal} applications` : "No goal set yet"}
                />
                <InfoCard
                  icon={<Sparkles className="h-4 w-4 text-sage" />}
                  label="Target roles"
                  value={profile.primary_job_titles.length > 0 ? profile.primary_job_titles.join(", ") : "No target roles yet"}
                />
                <InfoCard
                  icon={<MapPin className="h-4 w-4 text-lavender" />}
                  label="Preferred locations"
                  value={profile.preferred_locations.length > 0 ? profile.preferred_locations.join(", ") : "No preferred locations yet"}
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card className="glass-subtle border-border/60">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Users2 className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Friend preview</h3>
                </div>
                <div className="rounded-[1.75rem] border border-border/70 bg-card/80 p-4 shadow-soft">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border border-border">
                      {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                      <AvatarFallback>{initials(profile.display_name || "You")}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{profile.display_name}</p>
                      <p className="truncate text-xs text-foreground/65">@{profile.username}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-foreground/78">
                    {profile.status_message || "No status message yet."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
                      Goal: {profile.weekly_application_goal || 0}/week
                    </span>
                    <span className="rounded-full bg-accent px-2.5 py-1 text-accent-foreground">
                      Sharing {profile.sharing_enabled ? "enabled" : "off"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-subtle border-border/60">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-gold" />
                  <h3 className="font-semibold">Privacy and account overview</h3>
                </div>
                <dl className="grid gap-3 text-sm">
                  <MetaRow label="Profile visibility" value={visibilityLabel} />
                  <MetaRow label="Sharing features" value={profile.sharing_enabled ? "Enabled" : "Off by default"} />
                  <MetaRow label="Onboarding" value={profile.onboarded_at ? "Complete" : "Still in progress"} />
                  <MetaRow label="Joined" value={timeAgo(profile.created_at)} />
                </dl>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/app/settings">Open settings</Link>
                  </Button>
                  {!profile.onboarded_at && (
                    <Button asChild size="sm">
                      <Link to="/onboarding">Finish onboarding</Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {label}
      </div>
      <p className="text-sm leading-6 text-foreground/78">{value}</p>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl bg-card/60 px-3 py-2.5">
      <dt className="text-foreground/65">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
