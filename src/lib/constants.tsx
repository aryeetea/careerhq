import type {
  JobStatus,
  JobVerdict,
  WorkArrangement,
  EmploymentType,
  ReactionType,
  VisibilityLevel,
  CertificationStatus,
} from "@/types/database";

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

export const VERDICT_META: Record<JobVerdict, { label: string; emoji: string; className: string }> = {
  apply: { label: "Apply", emoji: "🟢", className: "bg-success/15 text-success" },
  maybe: { label: "Maybe", emoji: "🟡", className: "bg-gold/15 text-gold" },
  skip: { label: "Skip", emoji: "🔴", className: "bg-destructive/15 text-destructive" },
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
  noResumes: "Upload the resume versions you're using so you can track what worked.",
  noCertifications: "Add a course or certification you're working toward — small steps count.",
  noFriends: "Invite a friend to search alongside you. You don't have to do this alone.",
  noGoals: "Set a small, doable goal for this week. Progress over perfection.",
  noGroups: "Start or join a group with people who get what this season feels like.",
  noNotifications: "You're all caught up.",
};
