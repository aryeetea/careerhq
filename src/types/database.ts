// Hand-written types mirroring supabase/migrations/*.sql.
// Field names intentionally match Postgres column names (snake_case) so
// there is no mapping layer between the DB and the app — what you query
// is what you render.

export type WorkArrangement = "remote" | "hybrid" | "onsite";
export type EmploymentType = "full_time" | "part_time" | "contract" | "internship" | "temporary";

export type JobStatus =
  | "saved"
  | "applying"
  | "applied"
  | "assessment"
  | "recruiter_contacted"
  | "interview"
  | "final_interview"
  | "offer"
  | "rejected"
  | "ghosted"
  | "closed"
  | "archived";

export type JobVerdict = "apply" | "maybe" | "skip";
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

export interface ResumeRecommendation {
  resume_id: string;
  resume_name: string;
  score: number;
  explanation: string;
  matching_strengths: string[];
  gaps: string[];
}

export interface JobAiAnalysis {
  import_status: "success" | "manual_fallback";
  source: "url" | "manual" | "url_plus_manual";
  fetched_url: string | null;
  extracted_job: JobAiExtraction;
  fit_score: number;
  verdict: JobVerdict;
  priority: 1 | 2 | 3;
  recommended_resume_id: string | null;
  recommended_resume_reason: string | null;
  deal_breakers: string[];
  matching_strengths: string[];
  missing_required_qualifications: string[];
  missing_preferred_qualifications: string[];
  resume_rankings: ResumeRecommendation[];
  resume_improvement_suggestions: string[];
}

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  career_goal: string | null;
  primary_job_titles: string[];
  preferred_locations: string[];
  weekly_application_goal: number;
  sharing_enabled: boolean;
  status_message: string | null;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  user_id: string;
  theme: ThemeName;
  hidden_statuses: JobStatus[];
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
  fit_score: number | null;
  resume_id: string | null;
  cover_letter_used: string | null;
  priority: number;
  follow_up_date: string | null;
  interview_date: string | null;
  offer_date: string | null;
  rejection_date: string | null;
  recruiter_name: string | null;
  recruiter_email: string | null;
  recruiter_linkedin: string | null;
  strengths: string | null;
  missing_qualifications: string | null;
  notes: string | null;
  ai_extracted_data: JobAiExtraction;
  ai_analysis: JobAiAnalysis | null;
  ai_recommended_resume_id: string | null;
  ai_cover_letter: string | null;
  ai_last_analyzed_at: string | null;
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
  applications_this_week: number | null;
  applications_this_month: number | null;
  weekly_goal: number | null;
  interviews_count: number | null;
  offers_count: number | null;
  current_streak: number | null;
  certification_name: string | null;
  certification_percentage: number | null;
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
