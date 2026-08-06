import type {
  AiJobVerdict,
  ApplicationRecommendation,
  JobStatus,
  JobVerdict,
  OpportunityAssessment,
  WorkArrangement,
  EmploymentType,
  ReactionType,
  VisibilityLevel,
  CertificationStatus,
} from "@/types/database";

export const UNSET_SELECT_VALUE = "__unset__";

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

// The columns shown on the Kanban board by default. "closed" and
// "archived" are real statuses (selectable everywhere else) but are
// hidden from the board by default to avoid nine near-empty columns —
// users can re-enable them from the column-visibility menu.
export const DEFAULT_BOARD_COLUMNS: JobStatus[] = [
  "saved",
  "applying",
  "applied",
  "interview",
  "offer",
  "rejected",
];

export const ALL_BOARD_COLUMNS: JobStatus[] = [
  "saved",
  "applying",
  "applied",
  "assessment",
  "recruiter_contacted",
  "interview",
  "final_interview",
  "offer",
  "rejected",
  "ghosted",
  "closed",
  "archived",
];

export const JOB_STATUSES: { value: JobStatus; label: string }[] = ALL_BOARD_COLUMNS.map((s) => ({
  value: s,
  label: STATUS_META[s].label,
}));

// Six-tier verdict, from strongest to weakest fit. Deliberately reuses only
// existing design tokens (success → sky → gold → peach → destructive) so no
// new colors were introduced for this.
export const VERDICT_META: Record<JobVerdict, { label: string; emoji: string; className: string }> = {
  excellent_match: { label: "Excellent Match", emoji: "🌟", className: "bg-success/20 text-success font-semibold" },
  strong_match: { label: "Strong Match", emoji: "🟢", className: "bg-success/15 text-success" },
  worth_applying: { label: "Worth Applying", emoji: "🔵", className: "bg-sky/15 text-sky" },
  stretch_opportunity: { label: "Stretch Opportunity", emoji: "🌱", className: "bg-gold/15 text-gold" },
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
  confirmed: { label: "Confirmed", className: "bg-destructive/15 text-destructive" },
  possible: { label: "Possible", className: "bg-gold/15 text-gold" },
  insufficient_information: { label: "Needs confirmation", className: "bg-muted text-muted-foreground" },
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
