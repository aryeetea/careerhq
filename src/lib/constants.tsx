import { Lock, Users2, UsersRound, Globe } from "lucide-react";
import type {
  AiJobVerdict,
  ApplicationRecommendation,
  EditableJobStatus,
  GapSeverity,
  JobStatus,
  JobVerdict,
  OpportunityAssessment,
  RecommendationPriority,
  WorkArrangement,
  EmploymentType,
  ReactionType,
  VisibilityLevel,
  CertificationStatus,
  JournalMood,
  JournalVisibility,
} from "@/types/database";

export const UNSET_SELECT_VALUE = "__unset__";

// "applying", "ghosted", "closed", and "archived" stay in this map (and in
// the JobStatus type) purely so any legacy row still renders a label
// instead of crashing — none of the four is selectable anywhere in the app
// anymore. New applications go straight from Saved to Applied (date_applied
// is the meaningful signal, not a separate in-progress status); "ghosted"
// was a guess dressed up as a fact, and Dashboard now shows a factual "no
// response in 14 days" count instead; "closed" and "archived" were both
// redundant with "Rejected" as a catch-all for "no longer active."
export const STATUS_META: Record<JobStatus, { label: string; dot: string; badge: string }> = {
  saved: { label: "Saved", dot: "bg-slate-400", badge: "bg-slate-400/15 text-slate-500" },
  applying: { label: "Applying", dot: "bg-sky", badge: "bg-sky/15 text-sky" },
  applied: { label: "Applied", dot: "bg-primary", badge: "bg-primary/15 text-primary" },
  assessment: { label: "Assessment", dot: "bg-gold", badge: "bg-gold/15 text-gold" },
  recruiter_contacted: { label: "Recruiter contacted", dot: "bg-peach", badge: "bg-peach/20 text-peach-foreground" },
  interview: { label: "Interview", dot: "bg-lavender", badge: "bg-lavender/20 text-lavender-foreground" },
  final_interview: { label: "Final interview", dot: "bg-lavender", badge: "bg-lavender/30 text-lavender-foreground" },
  offer: { label: "Offer", dot: "bg-success", badge: "bg-success/15 text-success" },
  rejected: { label: "Rejected", dot: "bg-destructive", badge: "bg-destructive/15 text-destructive" },
  ghosted: { label: "Ghosted", dot: "bg-zinc-400", badge: "bg-zinc-400/15 text-zinc-500" },
  closed: { label: "Closed", dot: "bg-neutral-400", badge: "bg-neutral-400/15 text-neutral-500" },
  archived: { label: "Archived", dot: "bg-neutral-300", badge: "bg-neutral-300/15 text-neutral-400" },
};

// The columns shown on the Kanban board by default.
export const DEFAULT_BOARD_COLUMNS: EditableJobStatus[] = [
  "saved",
  "applied",
  "interview",
  "offer",
  "rejected",
];

// The selectable status set everywhere in the app (board columns, status
// pickers, filters). Deliberately excludes "applying", "ghosted", "closed",
// and "archived" — see the note on STATUS_META above.
export const ALL_BOARD_COLUMNS: EditableJobStatus[] = [
  "saved",
  "applied",
  "assessment",
  "recruiter_contacted",
  "interview",
  "final_interview",
  "offer",
  "rejected",
];

export const JOB_STATUSES: { value: EditableJobStatus; label: string }[] = ALL_BOARD_COLUMNS.map((s) => ({
  value: s,
  label: STATUS_META[s].label,
}));

export function normalizeEditableJobStatus(status: JobStatus): EditableJobStatus {
  if (status === "applying") return "saved";
  if (status === "ghosted" || status === "closed" || status === "archived") return "rejected";
  return status;
}

// Verdict taxonomy, strongest to weakest fit: Strong Match → Worth Applying
// → Consider → Stretch → Not Recommended. excellent_match/high_risk are
// legacy-only — still rendered for old rows and still manually selectable,
// but the AI itself only produces the five active tiers now (see
// careerCoach.ts VERDICT RULES). stretch_opportunity ("Stretch") is active
// again as the tier between consider and not_recommended. Deliberately
// reuses only existing design tokens (success → sky → gold → peach →
// destructive) so no new colors were introduced for this.
export const VERDICT_META: Record<JobVerdict, { label: string; emoji: string; className: string }> = {
  excellent_match: { label: "Excellent Match", emoji: "🌟", className: "bg-success/20 text-success font-semibold" },
  strong_match: { label: "Strong Match", emoji: "🟢", className: "bg-success/15 text-success" },
  worth_applying: { label: "Worth Applying", emoji: "🔵", className: "bg-sky/15 text-sky" },
  consider: { label: "Consider", emoji: "🟡", className: "bg-gold/15 text-gold" },
  stretch_opportunity: { label: "Stretch", emoji: "🟠", className: "bg-peach/20 text-peach-foreground" },
  high_risk: { label: "High Risk", emoji: "🟠", className: "bg-peach/20 text-peach-foreground" },
  not_recommended: { label: "Not Recommended", emoji: "🔴", className: "bg-destructive/15 text-destructive" },
};

export const ANALYSIS_VERDICT_META: Record<AiJobVerdict, { label: string; emoji: string; className: string }> = {
  ...VERDICT_META,
  not_yet_assessed: { label: "Not Yet Assessed", emoji: "⏳", className: "bg-muted text-muted-foreground" },
};

// Single source for every verdict <Select> in the app (JobDetailDialog,
// AddJobDialog, FiltersBar) so the option list is never hand-duplicated.
export const VERDICT_OPTIONS: { value: JobVerdict; label: string; emoji: string }[] = (
  Object.keys(VERDICT_META) as JobVerdict[]
).map((value) => ({ value, label: VERDICT_META[value].label, emoji: VERDICT_META[value].emoji }));

export const CONFIDENCE_META: Record<"low" | "medium" | "high", { label: string; className: string }> = {
  low: { label: "Low confidence", className: "text-muted-foreground" },
  medium: { label: "Medium confidence", className: "text-foreground/80" },
  high: { label: "High confidence", className: "text-foreground" },
};

export const ANALYSIS_SOURCE_META: Record<"url" | "manual" | "url_plus_manual", string> = {
  url: "URL",
  manual: "pasted description",
  url_plus_manual: "URL + pasted description",
};

export const IMPORT_STATUS_META: Record<"success" | "manual_fallback", { label: string; className: string }> = {
  success: { label: "Imported successfully", className: "text-success" },
  manual_fallback: { label: "Used pasted fallback", className: "text-gold" },
};

export const APPLICATION_PRIORITY_META: Record<
  ApplicationRecommendation,
  { label: string; className: string }
> = {
  apply_now: { label: "Apply now", className: "bg-success/15 text-success" },
  tailor_first: { label: "Tailor first", className: "bg-sky/15 text-sky" },
  consider: { label: "Consider carefully", className: "bg-gold/15 text-gold" },
  skip: { label: "Skip for now", className: "bg-destructive/15 text-destructive" },
  upload_resume_first: { label: "Upload résumé first", className: "bg-muted text-muted-foreground" },
};

export const OPPORTUNITY_ASSESSMENT_META: Record<OpportunityAssessment, { label: string; className: string }> = {
  promising: { label: "Promising", className: "bg-success/15 text-success" },
  neutral: { label: "Neutral", className: "bg-sky/15 text-sky" },
  risky: { label: "Risky", className: "bg-gold/15 text-gold" },
  ineligible: { label: "Ineligible", className: "bg-destructive/15 text-destructive" },
};

export const DEAL_BREAKER_STATUS_META: Record<
  "confirmed" | "possible" | "insufficient_information",
  { label: string; className: string }
> = {
  confirmed: { label: "Confirmed", className: "bg-success/15 text-success" },
  possible: { label: "Possible", className: "bg-gold/15 text-gold" },
  insufficient_information: { label: "Needs confirmation", className: "bg-destructive/15 text-destructive" },
};

// See SCAM RED FLAGS in careerCoach.ts. "none" is the common case; it's
// rendered in AnalysisSummary as a green "checked, nothing found" state
// rather than omitted, so a clean posting isn't mistaken for "not checked."
export const COMPANY_LEGITIMACY_META: Record<"none" | "low" | "medium" | "high", { label: string; className: string }> = {
  none: { label: "No red flags found", className: "bg-success/15 text-success" },
  low: { label: "Minor red flag", className: "bg-gold/15 text-gold" },
  medium: { label: "Worth a closer look", className: "bg-peach/20 text-peach-foreground" },
  high: { label: "Serious red flags", className: "bg-destructive/15 text-destructive" },
};

// How a logistics/lifestyle factor (relocation, travel, work arrangement…)
// compares to the candidate's saved settings preferences. "unspecified" is
// the common case — the candidate hasn't said either way — and is
// deliberately neutral, never framed as a warning.
export const LOGISTICS_MATCH_META: Record<"aligned" | "conflict" | "unspecified", { label: string; className: string }> = {
  aligned: { label: "Matches your preference", className: "bg-success/15 text-success" },
  conflict: { label: "Conflicts with your preference", className: "bg-destructive/15 text-destructive" },
  unspecified: { label: "Worth weighing", className: "bg-muted text-muted-foreground" },
};

// How seriously the single most significant missing qualification weighs
// on the verdict — see [GAP SEVERITY] in AnalysisSummary. Only "hard"
// pushes toward Not Recommended; minor/moderate/major never do on their own.
export const GAP_SEVERITY_META: Record<GapSeverity, { label: string; className: string }> = {
  none: { label: "No meaningful gap", className: "bg-success/15 text-success" },
  minor: { label: "Minor", className: "bg-sky/15 text-sky" },
  moderate: { label: "Moderate", className: "bg-gold/15 text-gold" },
  major: { label: "Major", className: "bg-peach/20 text-peach-foreground" },
  hard: { label: "Hard", className: "bg-destructive/15 text-destructive" },
};

// Advisory application-strength signal — see [PRIORITY] in AnalysisSummary.
// Deliberately distinct from jobs.priority (the user's own manual 1-3
// ranking, still overridable in the Evaluation tab) and from career
// direction fit: a role outside someone's ideal direction can still be a
// normal or even high-priority application.
export const RECOMMENDATION_PRIORITY_META: Record<RecommendationPriority, { label: string; emoji: string; className: string }> = {
  high: { label: "High Priority", emoji: "🔥", className: "bg-success/15 text-success" },
  normal: { label: "Normal", emoji: "⭐", className: "bg-sky/15 text-sky" },
  backup: { label: "Backup", emoji: "🌱", className: "bg-muted text-muted-foreground" },
};

export const RESUME_SUGGESTION_TYPE_META: Record<
  "safe_wording" | "reorder" | "confirm_with_user" | "genuine_gap",
  string
> = {
  safe_wording: "Safe wording",
  reorder: "Reorder",
  confirm_with_user: "Confirm with you",
  genuine_gap: "Genuine gap",
};

export const WORK_ARRANGEMENT_META: Record<WorkArrangement, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "Onsite",
};

export const EMPLOYMENT_TYPE_META: Record<EmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
  temporary: "Temporary",
};

export const CERTIFICATION_STATUS_META: Record<CertificationStatus, { label: string; className: string }> = {
  not_started: { label: "Not started", className: "bg-muted text-muted-foreground" },
  in_progress: { label: "In progress", className: "bg-sky/15 text-sky" },
  completed: { label: "Completed", className: "bg-success/15 text-success" },
  expired: { label: "Expired", className: "bg-destructive/15 text-destructive" },
};

export const PRIORITY_META: Record<number, { label: string; className: string }> = {
  1: { label: "Low priority", className: "text-muted-foreground" },
  2: { label: "Normal priority", className: "text-foreground" },
  3: { label: "High priority", className: "text-gold" },
};

export const REACTION_META: Record<ReactionType, { label: string; emoji: string }> = {
  proud: { label: "Proud of you", emoji: "🌷" },
  keep_going: { label: "Keep going", emoji: "🌿" },
  you_got_this: { label: "You've got this", emoji: "✨" },
  congrats: { label: "Congratulations", emoji: "🎉" },
  cheering: { label: "Cheering for you", emoji: "🌸" },
};

export const VISIBILITY_META: Record<VisibilityLevel, { label: string; description: string }> = {
  private: { label: "Private", description: "Only you can see this" },
  friends_only: { label: "Friends", description: "Any accepted friend can see this" },
  selected_friends: { label: "Selected friends", description: "Only the friends you choose" },
  hidden: { label: "Hidden", description: "Never shown to anyone" },
};

export const ENCOURAGING_EMPTY_MESSAGES = {
  noJobs: "Nothing saved yet — when you find something worth a look, this is where it'll live.",
  noJobsBoard: "Your board is a blank page today. Save a role you found and it'll show up here.",
  noUpcoming: "Nothing on the horizon right now. Enjoy the quiet.",
  noResumes: "Upload the resume versions you're using so you can see what's working.",
  noCertifications: "Add a course or certification you're working toward — small steps count.",
  noFriends: "Job searching doesn't have to be lonely. Invite someone you trust or connect with someone already on Bloom.",
  noGoals: "Set a small, doable goal for this week. Progress over perfection.",
  noGroups: "Start or join a group with people who get what this season feels like.",
  noNotifications: "You're all caught up.",
  noPendingInvites: "Nothing waiting on anyone right now. When a request comes in, you'll see it here first.",
};

export const JOURNAL_MOOD_META: Record<JournalMood, { label: string; emoji: string }> = {
  excited: { label: "Excited", emoji: "✨" },
  hopeful: { label: "Hopeful", emoji: "🌱" },
  calm: { label: "Calm", emoji: "🌿" },
  proud: { label: "Proud", emoji: "🌷" },
  grateful: { label: "Grateful", emoji: "🌸" },
  tired: { label: "Tired", emoji: "🌙" },
  anxious: { label: "Anxious", emoji: "🍂" },
  discouraged: { label: "Discouraged", emoji: "🌧️" },
};

export const JOURNAL_VISIBILITY_META: Record<JournalVisibility, { label: string; description: string; icon: typeof Lock }> = {
  private: { label: "Private", description: "Only you can see this entry", icon: Lock },
  friends: { label: "Friends", description: "Any accepted friend can see this", icon: Users2 },
  group: { label: "One group", description: "Visible to members of a group you choose", icon: UsersRound },
  public: { label: "Public", description: "Any signed-in Bloom user can see this", icon: Globe },
};
