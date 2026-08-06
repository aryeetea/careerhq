import { Link } from "react-router-dom";
import { Check, HeartPulse } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getMyActiveGoals } from "@/lib/goals";
import type { GoalWithMembers } from "@/services/goals";
import type { Job, Profile, Resume } from "@/types/database";

function profileComplete(profile: Profile): boolean {
  const checks = [
    Boolean(profile.avatar_url),
    Boolean(profile.display_name),
    Boolean(profile.bio),
    Boolean(profile.career_goal),
    profile.primary_job_titles.length > 0,
    profile.preferred_locations.length > 0,
    profile.weekly_application_goal > 0,
  ];
  return checks.every(Boolean);
}

interface HealthCheck {
  label: string;
  met: boolean;
  actionLabel: string;
  actionTo: string;
}

export function SearchHealthCard({
  profile,
  resumes,
  jobs,
  goals,
}: {
  profile: Profile;
  resumes: Resume[];
  jobs: Job[];
  goals: GoalWithMembers[];
}) {
  const checks: HealthCheck[] = [
    { label: "Resume uploaded", met: resumes.length > 0, actionLabel: "Upload a resume", actionTo: "/app/resumes" },
    { label: "AI analyzed", met: jobs.some((j) => j.ai_last_analyzed_at), actionLabel: "Analyze a job", actionTo: "/app/applications" },
    { label: "Applications tracked", met: jobs.length > 0, actionLabel: "Add a job", actionTo: "/app/applications" },
    { label: "Goals active", met: getMyActiveGoals(goals, profile.id).length > 0, actionLabel: "Set a goal", actionTo: "/app/goals" },
    { label: "Profile complete", met: profileComplete(profile), actionLabel: "Finish your profile", actionTo: "/app/settings" },
  ];

  const score = Math.round((checks.filter((c) => c.met).length / checks.length) * 100);

  return (
    <Card className="glass-subtle border-border/60">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-rose" />
            <h3 className="font-semibold">Search health</h3>
          </div>
          <span className="text-sm font-semibold text-primary">{score}%</span>
        </div>

        <ul className="grid gap-2">
          {checks.map((check) => (
            <li key={check.label} className="flex items-center justify-between gap-3 rounded-xl bg-card/60 px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border",
                    check.met ? "border-success/40 bg-success/15 text-success" : "border-border/70 text-transparent"
                  )}
                >
                  <Check className="h-3 w-3" />
                </span>
                <span className={check.met ? "text-foreground" : "text-muted-foreground"}>{check.label}</span>
              </span>
              {!check.met && (
                <Link to={check.actionTo} className="shrink-0 text-xs font-medium text-primary hover:underline">
                  {check.actionLabel}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
