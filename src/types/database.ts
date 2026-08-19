// Hand-written types mirroring supabase/migrations/*.sql.
// Field names intentionally match Postgres column names (snake_case) so
// there is no mapping layer between the DB and the app — what you query
// is what you render.

export type WorkArrangement = "remote" | "hybrid" | "onsite";
export type EmploymentType = "full_time" | "part_time" | "contract" | "internship" | "temporary";

export const EDITABLE_JOB_STATUSES = [
  "saved",
  "applied",
  "assessment",
  "recruiter_contacted",
  "interview",
  "final_interview",
  "offer",
  "rejected",
] as const;

export type EditableJobStatus = (typeof EDITABLE_JOB_STATUSES)[number];

// "closed" retired alongside "applying"/"ghosted" — see STATUS_META in
// constants.tsx for why. "archived" retired the same way after it — an
// extra bucket for "no longer active" wasn't pulling its weight next to
// "Rejected," which already means that.
export type LegacyJobStatus = "applying" | "ghosted" | "closed" | "archived";

export type JobStatus = EditableJobStatus | LegacyJobStatus;

// excellent_match/stretch_opportunity/high_risk are legacy tiers: still
// valid on old rows and still manually selectable, but the AI itself only
// returns strong_match/worth_applying/consider/not_recommended going
// forward — see careerCoach.ts VERDICT RULES and migration 0040.
export type JobVerdict =
  | "excellent_match"
  | "strong_match"
  | "worth_applying"
  | "consider"
  | "stretch_opportunity"
  | "high_risk"
  | "not_recommended";
export type AiJobVerdict = JobVerdict | "not_yet_assessed";
// Who authored the job's current verdict/fit_score pair. null means never
// set. 'user' means a re-analysis must not silently overwrite them — see
// analyze-job/index.ts and JobDetailDialog/AddJobDialog's verdict-source
// derivation.
export type VerdictSource = "ai" | "user";
export type ConfidenceLevel = "low" | "medium" | "high";
export type OpportunityAssessment = "promising" | "neutral" | "risky" | "ineligible";
export type ApplicationRecommendation = "apply_now" | "tailor_first" | "consider" | "skip" | "upload_resume_first";
export type CertificationStatus = "not_started" | "in_progress" | "completed" | "expired";
export type VisibilityLevel = "private" | "friends_only" | "selected_friends" | "hidden";
export type FriendRequestStatus = "pending" | "accepted" | "declined" | "cancelled";
export type ReactionType = "proud" | "keep_going" | "you_got_this" | "congrats" | "cheering";
export type ReactionContext = "weekly_progress" | "goal" | "group" | "general";
export type ThemeName = "floral" | "neutral" | "sunrise" | "meadow" | "dark" | "midnight";

export interface JobAiExtraction {
  company: string | null;
  title: string | null;
  location: string | null;
  salary: string | null;
  work_arrangement: WorkArrangement | null;
  deadline: string | null;
  requirements: string[];
  required_qualifications: string[];
  preferred_qualifications: string[];
  skills: string[];
  education: string[];
  experience: string[];
  certifications: string[];
  responsibilities: string[];
  raw_job_text: string;
}

export interface JobAiDealBreaker {
  label: string;
  status: "confirmed" | "possible" | "insufficient_information";
}

// Logistics/lifestyle factors (relocation, travel, work arrangement,
// schedule, …) — kept separate from JobAiDealBreaker, which is scoped to
// genuine hard-eligibility issues only. preferenceMatch reflects the
// candidate's saved settings preferences (see Settings below); "unspecified"
// is the default and is never treated as a rejection.
export interface JobAiLogisticsConsideration {
  label: string;
  detail: string;
  preferenceMatch: "aligned" | "conflict" | "unspecified";
}

// Pattern-matching on the posting text for common job-scam indicators —
// not a verification the company actually exists. See SCAM RED FLAGS in
// careerCoach.ts.
export interface JobAiCompanyLegitimacy {
  riskLevel: "none" | "low" | "medium" | "high";
  redFlags: string[];
  note: string;
  // "not_checked" on analyses run before the real web-search check existed,
  // or when the search itself failed/wasn't configured — never treated as
  // a red flag on its own.
  webCheck: "confirmed_presence" | "no_presence_found" | "not_checked";
}

export interface JobAiJobExtraction {
  company: string | null;
  jobTitle: string | null;
  location: string | null;
  salary: string | null;
  employmentType: string | null;
  workArrangement: WorkArrangement | null;
  requiredQualifications: string[];
  preferredQualifications: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  educationRequirements: string[];
  experienceRequirements: string[];
  certifications: string[];
  dealBreakers: JobAiDealBreaker[];
  // Every fresh analysis includes this, but analyses saved before this
  // field existed won't have it in their stored JSONB — this interface is
  // a TS-only cast over that data, so always read with `?? []` rather than
  // trusting the type at runtime for old rows.
  logisticsConsiderations: JobAiLogisticsConsideration[];
  // Same caveat as logisticsConsiderations above — absent on analyses run
  // before this field existed. Read with `?? { riskLevel: "none", ... }`.
  companyLegitimacy: JobAiCompanyLegitimacy;
  applicationDeadline: string | null;
  rawJobText: string;
}

// Five sub-scores backing the single 0-10 fitScore — see JobAiAnalysisResult
// and AnalysisSummary's "detailed scoring" section. null = no usable
// evidence for that dimension (never a guessed number).
export interface JobAiScoringDimensions {
  qualificationFit: number | null;
  transferableSkillsFit: number | null;
  careerDirectionFit: number | null;
  experienceSeniorityFit: number | null;
  locationWorkArrangementFit: number | null;
}

// How seriously the most significant missing qualification should weigh on
// the verdict. Only "hard" should push toward not_recommended — see
// careerCoach.ts SPECIALIZED EXPERIENCE GAPS.
export type GapSeverity = "none" | "minor" | "moderate" | "major" | "hard";

// Advisory only — separate from both jobs.priority (the user's own manual
// 1-3 ranking) and applicationRecommendation. Reflects overall application
// strength, not career-direction fit.
export type RecommendationPriority = "high" | "normal" | "backup";

export interface JobAiAnalysisResult {
  opportunityAssessment: OpportunityAssessment;
  candidateFit: {
    fitScore: number | null;
    confidence: ConfidenceLevel;
    explanation: string;
    strongMatches: string[];
    transferableStrengths: string[];
    criticalGaps: string[];
    preferredGaps: string[];
    unknowns: string[];
  };
  // Every fresh analysis includes these, but analyses saved before this
  // field set existed won't have them in their stored JSONB — always read
  // with a fallback (`?? null`/`?? []`) rather than trusting the type at
  // runtime for old rows, same as JobAiJobExtraction.logisticsConsiderations.
  scoringDimensions: JobAiScoringDimensions;
  careerDirectionNote: string;
  gapSeverity: GapSeverity;
  recommendationPriority: RecommendationPriority;
  applicationRecommendation: ApplicationRecommendation;
  shouldApply: string;
  verdict: AiJobVerdict;
  nextStep: string;
}

export interface JobAiResumeRecommendation {
  resumeId: string;
  resumeName: string;
  compatibilityScore: number;
  strengths: string[];
  gaps: string[];
  recommendationReason: string;
}

export interface JobAiResumeSuggestion {
  type: "safe_wording" | "reorder" | "confirm_with_user" | "genuine_gap";
  suggestion: string;
  reason: string;
}

export interface JobAiAnalysis {
  importStatus: "success" | "manual_fallback";
  source: "url" | "manual" | "url_plus_manual";
  fetchedUrl: string | null;
  jobExtraction: JobAiJobExtraction;
  analysis: JobAiAnalysisResult;
  resumeRanking: JobAiResumeRecommendation[];
  recommendedResumeId: string | null;
  resumeSuggestions: JobAiResumeSuggestion[];
  promptVersion: string;
}

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  career_goal: string | null;
  career_status: string | null;
  skills: string[];
  primary_job_titles: string[];
  preferred_locations: string[];
  weekly_application_goal: number;
  sharing_enabled: boolean;
  status_message: string | null;
  onboarded_at: string | null;
  tour_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  user_id: string;
  theme: ThemeName;
  hidden_statuses: JobStatus[];
  default_resume_id: string | null;
  default_application_follow_up_days: 3 | 5 | 7 | 10 | 14 | null;
  show_ai_fit_score: boolean;
  muted_notification_types: string[];
  // Logistics preferences the AI evaluator uses to judge whether a job's
  // relocation/travel/work-arrangement requirements are worth flagging as
  // a conflict — null means not specified, which is always treated as a
  // consideration, never an automatic rejection. See migration 0040.
  relocation_preference: "open" | "not_open" | null;
  travel_preference: "comfortable" | "limited" | "not_comfortable" | null;
  work_arrangement_preference: "remote_only" | "hybrid_ok" | "onsite_ok" | "flexible" | null;
  created_at: string;
  updated_at: string;
}

export interface Resume {
  id: string;
  user_id: string;
  name: string;
  target_role: string | null;
  file_path: string | null;
  file_name: string | null;
  file_type: string | null;
  extracted_text: string | null;
  extracted_text_updated_at: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  user_id: string;
  company: string;
  company_logo_url: string | null;
  title: string;
  location: string | null;
  salary: string | null;
  work_arrangement: WorkArrangement | null;
  employment_type: EmploymentType | null;
  source: string | null;
  job_url: string | null;
  job_description: string | null;
  date_found: string;
  date_applied: string | null;
  deadline: string | null;
  status: JobStatus;
  verdict: JobVerdict | null;
  // Whether `verdict`/`fit_score` came from the AI or a manual edit — see
  // VerdictSource above and analyze-job/index.ts's verdictLocked check.
  verdict_source: VerdictSource | null;
  fit_score: number | null;
  resume_id: string | null;
  cover_letter_used: string | null;
  priority: number;
  follow_up_date: string | null;
  followed_up_at: string | null;
  follow_up_round: number;
  interview_date: string | null;
  offer_date: string | null;
  rejection_date: string | null;
  recruiter_name: string | null;
  recruiter_email: string | null;
  recruiter_linkedin: string | null;
  strengths: string | null;
  missing_qualifications: string | null;
  notes: string | null;
  ai_extracted_data: JobAiJobExtraction | null;
  ai_analysis: JobAiAnalysis | null;
  ai_recommended_resume_id: string | null;
  ai_cover_letter: string | null;
  ai_cover_letter_updated_at: string | null;
  ai_last_analyzed_at: string | null;
  ai_prompt_version: string | null;
  ai_rubric_version: string | null;
  created_at: string;
  updated_at: string;
}

export type NewJob = Pick<Job, "company" | "title"> & Partial<Omit<Job, "id" | "user_id" | "company" | "title" | "created_at" | "updated_at">>;

export interface JobStatusHistoryEntry {
  id: string;
  job_id: string;
  user_id: string;
  from_status: JobStatus | null;
  to_status: JobStatus;
  changed_at: string;
}

export interface Certification {
  id: string;
  user_id: string;
  name: string;
  provider: string | null;
  status: CertificationStatus;
  progress_percentage: number;
  start_date: string | null;
  target_completion_date: string | null;
  completion_date: string | null;
  expiration_date: string | null;
  certificate_file_path: string | null;
  course_link: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrivacySettings {
  user_id: string;
  profile_visibility: VisibilityLevel;
  weekly_count_visibility: VisibilityLevel;
  monthly_count_visibility: VisibilityLevel;
  interview_count_visibility: VisibilityLevel;
  offer_count_visibility: VisibilityLevel;
  goal_progress_visibility: VisibilityLevel;
  certification_visibility: VisibilityLevel;
  streak_visibility: VisibilityLevel;
  status_message_visibility: VisibilityLevel;
  career_status_visibility: VisibilityLevel;
  created_at: string;
  updated_at: string;
}

export interface FriendRequest {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: FriendRequestStatus;
  created_at: string;
  updated_at: string;
}

export interface WeeklyProgress {
  user_id: string;
  week_start: string;
  applications_count: number;
  interviews_count: number;
  offers_count: number;
  rejections_count: number;
  weekly_goal: number;
  current_streak: number;
  created_at: string;
  updated_at: string;
}

export interface FriendCard {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  status_message: string | null;
  career_status: string | null;
  applications_this_week: number | null;
  applications_this_month: number | null;
  weekly_goal: number | null;
  interviews_count: number | null;
  offers_count: number | null;
  current_streak: number | null;
  certification_name: string | null;
  certification_percentage: number | null;
}

export type PeopleProfileRelationship =
  | "self"
  | "friend"
  | "friend_preview"
  | "non_friend_preview"
  | "incoming_request"
  | "outgoing_request"
  | "group_member";

// Why get_people_profile declined to return a viewable profile. Deliberately
// coarse — it should never tell a viewer more than they could already infer
// (a blocked viewer just sees "not available", same as a made-up user id).
export type PeopleProfileDenyReason = "not_found" | "blocked" | "no_access";

export interface PeopleProfileGoalSummary {
  id: string;
  name: string;
  description: string | null;
  target_count: number;
  unit: string;
  deadline: string | null;
}

export interface PeopleProfileSimpleGroup {
  id: string;
  name: string;
}

export interface PeopleProfileView {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  career_goal: string | null;
  career_status: string | null;
  status_message: string | null;
  relationship: PeopleProfileRelationship;
  applications_this_week: number | null;
  applications_this_month: number | null;
  weekly_goal: number | null;
  interviews_count: number | null;
  offers_count: number | null;
  current_streak: number | null;
  certification_name: string | null;
  certification_percentage: number | null;
  shared_goals: PeopleProfileGoalSummary[];
  mutual_groups: PeopleProfileSimpleGroup[];
  mutual_goals: PeopleProfileSimpleGroup[];
  /** Present, with everything else null, when the profile isn't viewable. */
  deny_reason: PeopleProfileDenyReason | null;
}

export interface Goal {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  target_count: number;
  unit: string;
  deadline: string | null;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface GoalMember {
  id: string;
  goal_id: string;
  user_id: string;
  progress_count: number;
  joined_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  weekly_goal_target: number | null;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
}

export interface GroupInvite {
  id: string;
  group_id: string;
  inviter_id: string;
  invitee_id: string;
  status: FriendRequestStatus;
  created_at: string;
  updated_at: string;
}

export interface GroupJoinLink {
  id: string;
  group_id: string;
  created_by: string;
  token: string;
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroupJoinLinkPreview {
  group_id: string;
  group_name: string;
  group_description: string | null;
  member_count: number;
  is_active: boolean;
  expires_at: string | null;
}

export interface FriendCode {
  id: string;
  created_by: string;
  code_plaintext: string | null;
  code_hint: string;
  is_active: boolean;
  expires_at: string | null;
  use_count: number;
  created_at: string;
  updated_at: string;
}

// Returned once, only by create/regenerate — the plaintext code is never
// persisted, so this is the only shape that ever carries it.
export interface FriendCodeCreated {
  code: string;
  id: string;
}

export interface FriendCodePreview {
  owner_id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  career_goal: string | null;
  mutual_groups: string[];
}

export interface MutualConnections {
  mutual_groups: string[];
  mutual_goals: string[];
}

export interface SuggestedFriend {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  mutual_group_count: number;
}

export interface EncouragementReaction {
  id: string;
  sender_id: string;
  recipient_id: string;
  context_type: ReactionContext;
  context_id: string | null;
  reaction_type: ReactionType;
  created_at: string;
}

export interface ActivityEvent {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

// Powers the Profile page's "Recent Activity" feed. Deliberately separate
// from ActivityEvent/activity_events, which backs the social notification
// bell — see profile_activity's migration comment for why.
export type ProfileActivityType =
  | "job_saved"
  | "job_applied"
  | "interview_scheduled"
  | "offer_received"
  | "ai_analysis_run"
  | "resume_uploaded"
  | "certification_added"
  | "certification_completed"
  | "goal_created"
  | "onboarding_completed";

export interface ProfileActivity {
  id: string;
  user_id: string;
  type: ProfileActivityType;
  title: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type JournalMood = "excited" | "hopeful" | "calm" | "proud" | "grateful" | "tired" | "anxious" | "discouraged";

// Who besides the author can read an entry. "group" always carries a
// group_id (enforced in the DB, not just the app); the other three don't.
export type JournalVisibility = "private" | "friends" | "group" | "public";

export interface JournalEntry {
  id: string;
  user_id: string;
  title: string | null;
  body: string;
  mood: JournalMood | null;
  visibility: JournalVisibility;
  group_id: string | null;
  entry_date: string;
  created_at: string;
  updated_at: string;
}
