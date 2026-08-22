import { createClient } from "npm:@supabase/supabase-js@2";
import { ZodError } from "npm:zod";
import { analysisResponseSchema, coverLetterResponseSchema, tailorResumeResponseSchema, type AnalysisResponse } from "./schemas.ts";
import { buildAnalysisPrompt, buildCoverLetterPrompt, buildTailorResumePrompt, CAREER_COACH_PROMPT_VERSION } from "./prompts/careerCoach.ts";

const ANALYSIS_MODEL = "gpt-5.6-terra";
const EXTRACTION_MODEL = "gpt-5.6-luna";
const COVER_LETTER_MODEL = "gpt-5.6-terra";
// Rewriting a full résumé against a job's keyword set is a comparably
// heavy reasoning task to analyze-job, not the lighter single-letter
// draft cover-letter generation is — same model/timeout as ANALYSIS_MODEL.
const TAILOR_RESUME_MODEL = "gpt-5.6-terra";
const MAX_RESUMES_PER_REQUEST = 10;

const ANALYSIS_TIMEOUT_MS = 120_000;
const EXTRACTION_TIMEOUT_MS = 45_000;
const COVER_LETTER_TIMEOUT_MS = 60_000;
const TAILOR_RESUME_TIMEOUT_MS = 120_000;
// Maximum 5xx retries; 4xx and auth errors are never retried.
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = [1_000, 2_000];
const POSITIVE_VERDICTS = new Set(["excellent_match", "strong_match", "worth_applying"]);
const HIGH_MATCH_VERDICTS = new Set(["excellent_match", "strong_match"]);
// Confirmed dealBreakers (hard-requirement issues only, post redesign) block
// a positive verdict. Logistics/lifestyle labels — relocation, travel,
// on-site/hybrid, geography, schedule — must never land in dealBreakers;
// this is the code-level backstop for that, on top of the prompt telling
// the model to put them in logisticsConsiderations instead. This is what
// used to make relocation/travel alone force a "Not Recommended" verdict.
const LOGISTICS_KEYWORD_PATTERN =
  /\b(relocat|travel|on-?site|onsite|hybrid|remote|commut|time ?zone|geographic|shift|schedule)\b/i;

export interface ResumeRow {
  id: string;
  name: string;
  target_role: string | null;
  file_path: string | null;
  file_name: string | null;
  file_type: string | null;
  extracted_text: string | null;
  extracted_text_updated_at: string | null;
  is_active: boolean;
  notes: string | null;
}

export interface JobRow {
  id: string;
  user_id: string;
  company: string;
  title: string;
  location: string | null;
  salary: string | null;
  work_arrangement: "remote" | "hybrid" | "onsite" | null;
  job_url: string | null;
  job_description: string | null;
  deadline: string | null;
  resume_id: string | null;
  ai_extracted_data: Record<string, unknown> | null;
  verdict: string | null;
  fit_score: number | null;
  // 'user' means the verdict/fit_score were set (or kept) by hand — see
  // migration 0040. analyze-job must never overwrite them in that case.
  verdict_source: "ai" | "user" | null;
}

export type AppErrorCode =
  | "validation_error"
  | "unauthenticated"
  | "not_found"
  | "rate_limited"
  | "upstream_error"
  | "internal_error"
  | "not_configured"
  | "insufficient_context";

export class AppError extends Error {
  status: number;
  code: AppErrorCode;

  constructor(message: string, status = 400, code: AppErrorCode = "validation_error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new AppError(`Missing required environment variable: ${name}`, 500, "internal_error");
  return value;
}

export function createSupabaseClients(authHeader: string | null) {
  const supabaseUrl = getEnv("SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  void authHeader;
  return { adminClient };
}

export async function requireUser(authHeader: string | null) {
  if (!authHeader) throw new AppError("Authentication required.", 401, "unauthenticated");
  const { adminClient } = createSupabaseClients(authHeader);
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new AppError("Authentication required.", 401, "unauthenticated");
  const {
    data: { user },
    error,
  } = await adminClient.auth.getUser(token);
  if (error || !user) throw new AppError("Authentication required.", 401, "unauthenticated");
  return { user, adminClient };
}

export async function enforceRateLimit(
  adminClient: any,
  userId: string,
  action: string,
  windowMs: number,
  maxRequests: number,
) {
  const threshold = new Date(Date.now() - windowMs).toISOString();
  const { count, error } = await adminClient
    .from("ai_request_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action", action)
    .gte("created_at", threshold);
  if (error) throw new AppError("Couldn't verify your rate limit right now.", 500, "internal_error");
  if ((count ?? 0) >= maxRequests) {
    throw new AppError("You've hit the limit for AI requests. Please wait a bit and try again.", 429, "rate_limited");
  }

  const { error: insertError } = await adminClient.from("ai_request_logs").insert({ user_id: userId, action });
  if (insertError) throw new AppError("Couldn't verify your rate limit right now.", 500, "internal_error");
}

// Deliberately does not reuse getEnv() here: getEnv()'s message includes the
// literal variable name, which is an implementation detail we don't want
// reaching the browser. A missing key is also a distinct, actionable state
// for the client (config not done yet) rather than a generic 500.
export function getOpenAIClient() {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new AppError("AI suggestions haven't been configured yet.", 500, "not_configured");
  }
  return { apiKey };
}

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
}

// Shared Tavily call behind both real-world checks below (company
// presence/scam-pattern, and job-posting location consistency).
// Deliberately returns null rather than throwing on any failure — missing
// key, network error, non-200 response, unexpected body — both checks are
// enhancements layered on top of an analysis that's already useful
// without them, and neither may ever be the reason a job analysis fails.
async function tavilySearch(query: string, action: string): Promise<TavilySearchResult[] | null> {
  const apiKey = Deno.env.get("TAVILY_API_KEY");
  if (!apiKey) return null;
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, query, search_depth: "basic", max_results: 5 }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      console.error(`Tavily search failed (${action})`, response.status, await response.text().catch(() => ""));
      return null;
    }
    const data = await response.json();
    if (!Array.isArray(data?.results)) return null;
    return data.results.map((r: Record<string, unknown>) => ({
      title: typeof r.title === "string" ? r.title : "",
      url: typeof r.url === "string" ? r.url : "",
      content: typeof r.content === "string" ? r.content : "",
    }));
  } catch (error) {
    console.error(`Tavily search error (${action})`, error);
    return null;
  }
}

// Backs companyLegitimacy.webCheck (see SCAM RED FLAGS in careerCoach.ts
// for the text-pattern side of this).
function searchCompanyWeb(companyName: string): Promise<TavilySearchResult[] | null> {
  // Deliberately hiring/job-scam-focused, not a generic "company reviews"
  // search — see evaluateCompanyPresence below for why: broad review
  // queries surface ordinary product/billing complaints (every company
  // with any online presence has some), which is a completely different
  // concern from "is this JOB POSTING a scam."
  return tavilySearch(`"${companyName}" hiring scam OR "job scam" OR "fake job posting" OR careers reviews`, "company_presence");
}

// Backs companyLegitimacy.locationConfidence — see LOCATION VERIFICATION
// below. Exact title + company (rather than company alone) is the point:
// the goal is finding this SAME listing mirrored elsewhere, not general
// company chatter.
function searchJobPostingWeb(jobTitle: string, companyName: string): Promise<TavilySearchResult[] | null> {
  return tavilySearch(`"${jobTitle}" "${companyName}"`, "location_consistency");
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Trusted third-party listings that count as a real, independent presence
// even when the company doesn't have (or the search didn't surface) its
// own website.
const TRUSTED_PRESENCE_DOMAINS = ["linkedin.com/company", "glassdoor.com", "indeed.com/cmp", "crunchbase.com/organization", "bbb.org"];

// A listing hosted on a real job board is itself evidence of a genuine
// posted job, not a scam signal — even when the listing's own title
// happens to contain a scam-adjacent word (verified directly: a real
// company's own "Fraud & Scams Policy Analyst" job posting, hosted here,
// otherwise false-flagged purely for its job title).
const JOB_BOARD_DOMAINS = [
  "greenhouse.io",
  "lever.co",
  "myworkdayjobs.com",
  "ashbyhq.com",
  "generalcatalyst.com",
  "wellfound.com",
  "ziprecruiter.com",
  "smartrecruiters.com",
  "jobvite.com",
  "icims.com",
];

// Deliberately code, not a second AI call: matching a normalized company
// name against result hostnames and a short scam-keyword check is
// something regex/string-matching does reliably and cheaply — an LLM call
// here would add cost and a second chance to hallucinate over the same
// handful of search snippets.
//
// Verified directly against real searches, twice:
// 1. A generic "reviews scam complaints" query surfaced Trustpilot/
//    consumer-complaint results for a well-known, entirely legitimate
//    company — ordinary product/billing complaints, which practically
//    every company with any online footprint accumulates. Narrowed the
//    query to hiring/job-scam language specifically, and require the
//    same snippet to also mention hiring/job context, not just "scam."
// 2. Even the narrowed query still produced two false positives against
//    the same real company: a LinkedIn post warning people to watch out
//    for *impersonators* of it (it's the victim, not the perpetrator),
//    and one of its own real job postings for a "Fraud & Scams" policy
//    role, flagged purely for having "scam" in the job title. Neither
//    keyword-matching nor this heuristic can reliably tell an accusation
//    from a company's own unrelated content or a warning about someone
//    impersonating it — so two backstops: skip the company's own
//    materials entirely (its official site or a trusted listing is
//    evidence FOR it, never against it), and require at least two
//    independent hits before treating it as a real pattern rather than
//    one ambiguous snippet.
const SCAM_KEYWORDS = ["scam", "fraud", "fake job", "not legit", "job scam"];
const HIRING_CONTEXT_KEYWORDS = ["job", "hiring", "position", "interview", "recruiter", "applicant", "candidate", "employment"];
const MIN_SCAM_MENTIONS_TO_FLAG = 2;

function evaluateCompanyPresence(
  companyName: string,
  results: TavilySearchResult[],
): { presenceConfirmed: boolean; scamMentions: string[]; source: TavilySearchResult | null } {
  const normalizedCompany = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const companyKeyword = companyName.toLowerCase().slice(0, 8);
  let presenceConfirmed = false;
  // The confirming result stands in as "information about the company" in
  // the UI — a link the user can actually open, not just a yes/no verdict.
  // Tracked separately from job-board mirrors: the company's own site or a
  // trusted listing (LinkedIn, Glassdoor, ...) is always the more useful
  // thing to show, so it wins even if a job-board result was seen first.
  let ownSiteOrTrustedSource: TavilySearchResult | null = null;
  let jobBoardSource: TavilySearchResult | null = null;
  const candidateMentions: string[] = [];

  for (const result of results) {
    const hostname = safeHostname(result.url).replace(/[^a-z0-9.]/g, "");
    const isOwnSiteOrTrustedListing =
      (normalizedCompany.length >= 4 && hostname.includes(normalizedCompany.slice(0, Math.min(normalizedCompany.length, 12)))) ||
      TRUSTED_PRESENCE_DOMAINS.some((domain) => result.url.toLowerCase().includes(domain));
    const isJobBoardListing = JOB_BOARD_DOMAINS.some((domain) => hostname.includes(domain));
    if (isOwnSiteOrTrustedListing || isJobBoardListing) {
      presenceConfirmed = true;
      if (isOwnSiteOrTrustedListing) ownSiteOrTrustedSource ??= result;
      else jobBoardSource ??= result;
      continue; // never a scam signal — this is the company's own footprint, not a report about it
    }

    const text = `${result.title} ${result.content}`.toLowerCase();
    const mentionsScamLanguage = SCAM_KEYWORDS.some((term) => text.includes(term));
    const mentionsHiringContext = HIRING_CONTEXT_KEYWORDS.some((term) => text.includes(term));
    if (mentionsScamLanguage && mentionsHiringContext && companyKeyword && text.includes(companyKeyword)) {
      candidateMentions.push(`A search result ("${result.title || result.url}") describes hiring/job-scam reports associated with this company name.`);
    }
  }

  // One ambiguous snippet isn't a pattern; two independent ones are much
  // harder to explain away as coincidence or unrelated content.
  const scamMentions = candidateMentions.length >= MIN_SCAM_MENTIONS_TO_FLAG ? candidateMentions.slice(0, 2) : [];
  return { presenceConfirmed, scamMentions, source: ownSiteOrTrustedSource ?? jobBoardSource };
}

const RISK_LEVEL_ORDER = ["none", "low", "medium", "high"] as const;
function atLeastRiskLevel(current: AnalysisResponse["jobExtraction"]["companyLegitimacy"]["riskLevel"], floor: (typeof RISK_LEVEL_ORDER)[number]) {
  return RISK_LEVEL_ORDER[Math.max(RISK_LEVEL_ORDER.indexOf(current), RISK_LEVEL_ORDER.indexOf(floor))];
}

// LOCATION VERIFICATION — a separate concern from scam-pattern red flags
// above: a posting can be a completely genuine listing and still be
// mislabeled or defaulted to the wrong country on the job board that
// surfaced it (e.g. an India-based, rupee-denominated role showing a US
// city because of a platform default). Skills-match scoring stays
// accurate either way — this only checks whether the candidate could
// actually take the role as displayed. Deliberately code, not a second AI
// call, same philosophy as evaluateCompanyPresence above: cheap, regex
// pattern-matching over a handful of search snippets, not a geocoder or a
// full duplicate-listing diff. Never claim or imply a mismatch when the
// claimed location can't be confidently classified — a false "mismatch"
// here caps the verdict, so it must never fire on a guess.
const CURRENCY_REGION_SIGNALS: { region: string; pattern: RegExp }[] = [
  { region: "India", pattern: /₹|\bINR\b|\brupees?\b|\blakh(?:s)?\b/i },
  { region: "United Kingdom", pattern: /£|\bGBP\b/i },
  { region: "European Union", pattern: /€|\bEUR\b/i },
  { region: "Philippines", pattern: /₱|\bPHP\b/i },
  { region: "Pakistan", pattern: /\bPKR\b/i },
];

function detectRegionSignal(text: string): string | null {
  for (const { region, pattern } of CURRENCY_REGION_SIGNALS) {
    if (pattern.test(text)) return region;
  }
  return null;
}

// A rough claimed-location -> expected-region read, only confident enough
// to say "this is plausibly India" or "this is plausibly the US" — not a
// full geocoder. Unclassifiable/ambiguous locations (including "Remote"
// with no country, or an empty location) return null, and the caller must
// never flag a mismatch without a claimed region to compare against.
function claimedRegionFromLocation(location: string | null): string | null {
  if (!location) return null;
  if (/\bIndia\b/i.test(location)) return "India";
  if (/\bUnited Kingdom\b|\bU\.?K\.?\b/i.test(location)) return "United Kingdom";
  if (/\b(?:United States|USA|U\.S\.)\b/i.test(location) || /,\s*[A-Z]{2}\b/.test(location)) return "United States";
  return null;
}

function evaluateLocationConsistency(
  claimedLocation: string | null,
  results: TavilySearchResult[],
): { mismatchDetected: boolean; mismatchNote: string | null } {
  const claimedRegion = claimedRegionFromLocation(claimedLocation);
  if (!claimedRegion) return { mismatchDetected: false, mismatchNote: null };

  for (const result of results) {
    const foundRegion = detectRegionSignal(`${result.title} ${result.content}`);
    if (foundRegion && foundRegion !== claimedRegion) {
      return {
        mismatchDetected: true,
        mismatchNote: `A search for this exact job title and company found the same posting text associated with ${foundRegion} pay/location, while this listing displays ${claimedRegion} — the displayed location could not be confirmed.`,
      };
    }
  }
  return { mismatchDetected: false, mismatchNote: null };
}

// A confirmed location/currency mismatch, or a "high" scam-risk read,
// pulls fitScore itself down — not just the verdict tier. This is the fix
// for a real observed bug: a posting scored 8.2/10 "Worth Applying" purely
// on skills match while the identical listing text existed elsewhere with
// a different country and currency; the legitimacy layer only ever
// touched a verdict label a user could skim past, never the number.
//
// Both triggers only resolve from a real search the model can't run
// itself (see LOCATION VERIFICATION above and SCAM RED FLAGS in
// careerCoach.ts), so — like the verdict cap this replaces — this is a
// direct code-level override, not a normalizeAndValidateAnalysis-style
// throw-and-repair rule: locationConfidence/the final riskLevel simply
// aren't known yet when the model produces its own fitScore/
// legitimacyConfidence guess.
//
// Deliberately narrow, per the same reasoning documented in LOCATION
// VERIFICATION: only "mismatch_detected" location and "high" risk apply a
// penalty. Sparse reviews, an unfamiliar/new/small company, or "medium"/
// "low" risk must NEVER trigger this — those aren't identified problems,
// just an absence of information, and penalizing them would make Bloom
// unhelpfully conservative on completely ordinary postings.
const LOCATION_MISMATCH_PENALTY = 2.5;
const HIGH_RISK_PENALTY = 2.0;
const MAX_LEGITIMACY_PENALTY = 3.5; // combined ceiling even when both trigger

function applyLegitimacyAdjustments(analysis: AnalysisResponse): AnalysisResponse {
  const { riskLevel, locationConfidence } = analysis.jobExtraction.companyLegitimacy;
  const locationMismatch = locationConfidence === "mismatch_detected";
  const highRisk = riskLevel === "high";
  if (!locationMismatch && !highRisk) return analysis;

  const penalty = Math.min(MAX_LEGITIMACY_PENALTY, (locationMismatch ? LOCATION_MISMATCH_PENALTY : 0) + (highRisk ? HIGH_RISK_PENALTY : 0));

  const { fitScore } = analysis.analysis.candidateFit;
  const newFitScore = fitScore === null ? null : Math.max(0, Math.round((fitScore - penalty) * 10) / 10);

  // legitimacyConfidence only ever moves DOWN here, never up — a model
  // that already flagged something lower for its own separate reasons
  // keeps that lower read rather than being overridden toward this floor.
  const legitimacyCeiling = locationMismatch ? 2 : 3;
  const existingLegitimacy = analysis.analysis.scoringDimensions.legitimacyConfidence;
  const newLegitimacyConfidence = existingLegitimacy === null ? legitimacyCeiling : Math.min(existingLegitimacy, legitimacyCeiling);

  // Point 4 of the request this implements: never let a strong
  // qualification match silently outweigh a real legitimacy/location
  // concern in the text a user actually reads.
  const reasons: string[] = [];
  if (locationMismatch) {
    reasons.push("the posting's displayed location could not be confirmed — the same listing appears elsewhere tied to a different country and pay range");
  }
  if (highRisk) {
    reasons.push("a web search surfaced signals suggesting this posting may not be a legitimate opportunity as displayed");
  }
  const reasonNote = `This score was reduced because ${reasons.join(" and ")}.`;
  const explanation = analysis.analysis.candidateFit.explanation ? `${analysis.analysis.candidateFit.explanation} ${reasonNote}` : reasonNote;

  return {
    ...analysis,
    analysis: {
      ...analysis.analysis,
      candidateFit: { ...analysis.analysis.candidateFit, fitScore: newFitScore, explanation },
      scoringDimensions: { ...analysis.analysis.scoringDimensions, legitimacyConfidence: newLegitimacyConfidence },
      // Ceiling, not a forced fixed value: never allow better than
      // "consider" here, but a verdict already at or below that (e.g.
      // stretch_opportunity from a genuine skills gap) is left as-is
      // rather than being pulled back up to "consider".
      verdict: POSITIVE_VERDICTS.has(analysis.analysis.verdict) ? "consider" : analysis.analysis.verdict,
      recommendationPriority: analysis.analysis.recommendationPriority === "high" ? "normal" : analysis.analysis.recommendationPriority,
      applicationRecommendation: analysis.analysis.applicationRecommendation === "apply_now" ? "consider" : analysis.analysis.applicationRecommendation,
      shouldApply:
        "Your skills line up well with this posting, but a legitimacy or location concern pulled the score down — verify the role's real location, terms, and legitimacy directly on the employer's own site before applying.",
      nextStep:
        "Confirm this role's actual location, terms, and legitimacy on the employer's own careers page before applying — this listing raised a concern that couldn't be fully resolved.",
    },
  };
}

// Runs after analyzeJobAndResumes — the model can't search the web itself,
// so this layers two real lookups on top of its text-pattern read of the
// posting: company presence/scam-pattern (see SCAM RED FLAGS in
// careerCoach.ts) and, separately, whether this exact job posting is
// mirrored elsewhere under a different location/currency (see LOCATION
// VERIFICATION above). Never throws: a missing company name/job title, a
// missing/misconfigured API key, or any search failure just leaves that
// part of the analysis exactly as the model produced it (webCheck/
// locationConfidence stay "not_checked") rather than failing or blocking
// the whole request.
export async function enrichCompanyLegitimacyWithWebCheck(analysis: AnalysisResponse): Promise<AnalysisResponse> {
  const companyName = analysis.jobExtraction.company?.trim();
  const jobTitle = analysis.jobExtraction.jobTitle?.trim();
  const base = analysis.jobExtraction.companyLegitimacy;

  let webCheck: AnalysisResponse["jobExtraction"]["companyLegitimacy"]["webCheck"] = "not_checked";
  let source: AnalysisResponse["jobExtraction"]["companyLegitimacy"]["source"] = null;
  let riskLevel = base.riskLevel;
  let redFlags = base.redFlags;
  let note = base.note;

  if (companyName) {
    const presenceResults = await searchCompanyWeb(companyName);
    if (presenceResults) {
      const { presenceConfirmed, scamMentions, source: presenceSource } = evaluateCompanyPresence(companyName, presenceResults);
      webCheck = presenceConfirmed ? "confirmed_presence" : "no_presence_found";
      // Full Tavily snippet, untruncated — this is the actual evidence
      // behind "confirmed_presence" and the user should be able to read
      // all of it in AnalysisSummary, with the link there for anyone who
      // wants the source page itself rather than a fragment of it.
      source = presenceSource
        ? { title: presenceSource.title || safeHostname(presenceSource.url) || presenceSource.url, url: presenceSource.url, snippet: presenceSource.content }
        : null;

      const extraFlags: string[] = [...scamMentions];
      if (!presenceConfirmed) {
        extraFlags.push(
          "A web search did not surface an independent company website, LinkedIn page, or other professional listing for this company name.",
        );
      }

      if (extraFlags.length > 0) {
        riskLevel = atLeastRiskLevel(base.riskLevel, scamMentions.length > 0 ? "high" : "low");
        redFlags = [...base.redFlags, ...extraFlags];
        const webNote =
          scamMentions.length > 0
            ? "A web search surfaced results describing this company or posting as a scam — verify carefully before sharing any personal information."
            : "A web search didn't turn up an independent website or professional listing for this company — that alone isn't proof of a scam, but it's worth double-checking before you share any personal information.";
        note = base.riskLevel === "none" ? webNote : `${base.note} ${webNote}`;
      }
    }
  }

  let locationConfidence: AnalysisResponse["jobExtraction"]["companyLegitimacy"]["locationConfidence"] = "not_checked";
  if (companyName && jobTitle) {
    const postingResults = await searchJobPostingWeb(jobTitle, companyName);
    if (postingResults) {
      const { mismatchDetected, mismatchNote } = evaluateLocationConsistency(analysis.jobExtraction.location, postingResults);
      locationConfidence = mismatchDetected ? "mismatch_detected" : "confirmed";
      if (mismatchDetected && mismatchNote) {
        redFlags = [...redFlags, mismatchNote];
        note = note ? `${note} ${mismatchNote}` : mismatchNote;
      }
    }
  }

  const updated: AnalysisResponse = {
    ...analysis,
    jobExtraction: {
      ...analysis.jobExtraction,
      companyLegitimacy: { riskLevel, redFlags, note, webCheck, source, locationConfidence },
    },
  };

  // Reads the final riskLevel/locationConfidence off `updated` itself, so
  // this also fires correctly when the real web checks above never ran
  // (e.g. no TAVILY_API_KEY) but the model's OWN text-pattern read already
  // landed on riskLevel "high" — that case shouldn't wait on a search that
  // isn't configured.
  return applyLegitimacyAdjustments(updated);
}

export interface CandidateEvidenceContext {
  hasResumeEvidence: boolean;
  hasProfileEvidence: boolean;
}

// Mirrors settings.relocation_preference / travel_preference /
// work_arrangement_preference (see migration 0040). Null = not specified.
export interface CandidatePreferences {
  relocationPreference: "open" | "not_open" | null;
  travelPreference: "comfortable" | "limited" | "not_comfortable" | null;
  workArrangementPreference: "remote_only" | "hybrid_ok" | "onsite_ok" | "flexible" | null;
}

// Mirrors profiles.career_goal / primary_job_titles — the candidate's own
// stated target career direction, fed to scoringDimensions.careerDirectionFit
// (see CAREER DIRECTION FIT in careerCoach.ts). Never invented from job
// history or resume content; only what the candidate explicitly set.
export interface CandidateCareerDirection {
  careerGoal: string | null;
  targetJobTitles: string[];
}

// Mirrors candidate_hard_requirement_facts (migration 0044) — answers the
// candidate has explicitly confirmed to hard-requirement questions raised
// by a PAST analysis (see HARD REQUIREMENTS / requirementKey in
// careerCoach.ts). Ground truth, not evidence to weigh against the
// résumé: this is what turns the "Hard requirements to confirm" card from
// a dead-end badge into something that actually improves future analyses,
// for this job and every other posting with a matching requirementKey.
export interface ConfirmedHardRequirementFact {
  requirementKey: string;
  label: string;
  answer: "yes" | "no" | "partial";
  detail: string | null;
}

function withMissingEvidenceUnknowns(existing: string[], context: CandidateEvidenceContext): string[] {
  const unknowns = [...existing];
  if (!context.hasResumeEvidence) unknowns.push("No resume evidence was available to assess your fit.");
  if (!context.hasProfileEvidence) unknowns.push("No profile evidence was available to assess your fit.");
  return Array.from(new Set(unknowns));
}

export function normalizeAndValidateAnalysis(response: AnalysisResponse, context: CandidateEvidenceContext): AnalysisResponse {
  const hasCandidateEvidence = context.hasResumeEvidence || context.hasProfileEvidence;
  const normalized = structuredClone(response) as AnalysisResponse;
  const verdict = normalized.analysis.verdict;
  const confirmedDealBreakers = response.jobExtraction.dealBreakers.filter((item) => item.status === "confirmed");
  const criticalGapCount = normalized.analysis.candidateFit.criticalGaps.length;
  const issues: string[] = [];

  // Code-level backstop for the Epic Entry-Level PM bug: relocation/travel/
  // on-site-type labels must be reported as logisticsConsiderations, never
  // as dealBreakers — dealBreakers alone gate a positive verdict below, and
  // logistics should never be able to force "Not Recommended" on their own.
  const misclassifiedLogistics = normalized.jobExtraction.dealBreakers.filter(
    (item) => LOGISTICS_KEYWORD_PATTERN.test(item.label)
  );
  if (misclassifiedLogistics.length > 0) {
    issues.push(
      `logistics/lifestyle items belong in logisticsConsiderations, not dealBreakers: ${misclassifiedLogistics.map((item) => item.label).join(", ")}`,
    );
  }

  if (!hasCandidateEvidence) {
    normalized.analysis.candidateFit.fitScore = null;
    normalized.analysis.candidateFit.confidence = "low";
    normalized.analysis.candidateFit.explanation =
      "Fit not assessed yet because no resume or profile evidence was available. Upload or select a resume to assess your fit against this role.";
    normalized.analysis.candidateFit.strongMatches = [];
    normalized.analysis.candidateFit.transferableStrengths = [];
    normalized.analysis.candidateFit.criticalGaps = [];
    normalized.analysis.candidateFit.preferredGaps = [];
    normalized.analysis.candidateFit.unknowns = withMissingEvidenceUnknowns(normalized.analysis.candidateFit.unknowns, context);
    normalized.analysis.scoringDimensions = {
      qualificationFit: null,
      transferableSkillsFit: null,
      careerDirectionFit: null,
      experienceSeniorityFit: null,
      locationWorkArrangementFit: null,
      legitimacyConfidence: null,
    };
    normalized.analysis.careerDirectionNote = "Career direction fit isn't assessed yet — upload or select a resume first.";
    normalized.analysis.gapSeverity = "none";
    normalized.analysis.recommendationPriority = "backup";
    normalized.analysis.shouldApply = "Upload or select a resume to see whether this role is worth applying to.";
    normalized.analysis.verdict = "not_yet_assessed";
    normalized.analysis.applicationRecommendation = "upload_resume_first";
  }

  if (normalized.analysis.candidateFit.fitScore === null) {
    normalized.analysis.verdict = "not_yet_assessed";
    if (!hasCandidateEvidence) normalized.analysis.applicationRecommendation = "upload_resume_first";
  }

  if (normalized.analysis.verdict === "excellent_match" && criticalGapCount > 0) {
    issues.push("excellent_match cannot include criticalGaps because the prompt defines it as meeting nearly all required qualifications");
  }

  if (POSITIVE_VERDICTS.has(normalized.analysis.verdict) && confirmedDealBreakers.length > 0) {
    issues.push(
      `positive verdict "${normalized.analysis.verdict}" conflicts with confirmed deal breakers: ${confirmedDealBreakers.map((item) => item.label).join(", ")}`,
    );
  }

  if (HIGH_MATCH_VERDICTS.has(normalized.analysis.verdict) && !hasCandidateEvidence) {
    issues.push(`${normalized.analysis.verdict} requires actual resume or profile evidence`);
  }

  // Only a confirmed hard requirement issue or gapSeverity "hard" may
  // justify not_recommended — critical gaps alone (minor/moderate/major)
  // are exactly what consider/stretch_opportunity are for. See SPECIALIZED
  // EXPERIENCE GAPS: "Only HARD GAP situations should strongly push the
  // recommendation toward NOT RECOMMENDED."
  if (
    normalized.analysis.verdict === "not_recommended" &&
    confirmedDealBreakers.length === 0 &&
    normalized.analysis.gapSeverity !== "hard"
  ) {
    issues.push(
      `not_recommended requires a confirmed hard requirement issue or gapSeverity "hard" — found ${criticalGapCount} critical gap(s) and gapSeverity "${normalized.analysis.gapSeverity}", which belongs at consider or stretch_opportunity instead`,
    );
  }

  // stretch_opportunity ("Stretch") is for significant-but-bridgeable gaps —
  // not a synonym for an ordinary good application (that's worth_applying
  // or consider).
  if (
    normalized.analysis.verdict === "stretch_opportunity" &&
    normalized.analysis.gapSeverity !== "major" &&
    normalized.analysis.gapSeverity !== "hard"
  ) {
    issues.push("stretch_opportunity requires gapSeverity major or hard");
  }

  // recommendationPriority reflects overall application strength — it can't
  // be "high" for a role Bloom just told the candidate not to pursue.
  if (normalized.analysis.recommendationPriority === "high" && normalized.analysis.verdict === "not_recommended") {
    issues.push("recommendationPriority high cannot coexist with verdict not_recommended");
  }

  // Career direction fit is explicitly NOT allowed to be the sole reason a
  // verdict goes past consider — see CAREER DIRECTION FIT / VERDICT RULES.
  // A low careerDirectionFit alongside solid qualification/transferable fit
  // and no hard requirement issue must not land on stretch_opportunity or
  // not_recommended.
  const { qualificationFit, transferableSkillsFit, careerDirectionFit } = normalized.analysis.scoringDimensions;
  if (
    (normalized.analysis.verdict === "stretch_opportunity" || normalized.analysis.verdict === "not_recommended") &&
    careerDirectionFit !== null &&
    careerDirectionFit <= 6 &&
    qualificationFit !== null &&
    qualificationFit >= 7 &&
    transferableSkillsFit !== null &&
    transferableSkillsFit >= 7 &&
    confirmedDealBreakers.length === 0 &&
    normalized.analysis.gapSeverity !== "hard"
  ) {
    issues.push(
      `verdict "${normalized.analysis.verdict}" appears driven by low careerDirectionFit alone despite strong qualificationFit/transferableSkillsFit and no hard requirement issue — that combination belongs at consider`,
    );
  }

  if (
    normalized.analysis.applicationRecommendation === "skip" &&
    confirmedDealBreakers.length === 0 &&
    normalized.analysis.opportunityAssessment !== "ineligible" &&
    criticalGapCount === 0
  ) {
    issues.push("skip recommendation requires confirmed ineligibility or critical gaps");
  }

  if (normalized.analysis.applicationRecommendation === "apply_now" && confirmedDealBreakers.length > 0) {
    issues.push("apply_now cannot coexist with confirmed ineligibility");
  }

  if (
    normalized.analysis.verdict === "worth_applying" &&
    normalized.analysis.candidateFit.fitScore !== null &&
    normalized.analysis.candidateFit.fitScore <= 0
  ) {
    issues.push("worth_applying cannot appear with a 0/10 score");
  }

  if (normalized.analysis.candidateFit.fitScore === 0 && normalized.analysis.candidateFit.unknowns.length > 0 && criticalGapCount === 0) {
    issues.push("unknowns must reduce confidence, not collapse fit to zero");
  }

  if (issues.length > 0) {
    throw new Error(`Verdict does not follow prompt instructions: ${issues.join("; ")}`);
  }

  return normalized;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\r/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function htmlToText(html: string): string {
  return normalizeWhitespace(
    decodeHtml(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    )
  );
}

function matchMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1].trim());
  }
  return null;
}

// Indeed, LinkedIn, and Glassdoor all run bot-detection (Akamai/PerimeterX-
// style) that returns a 403/challenge page to any non-browser fetch —
// verified directly against a real Indeed job URL, which came back 403
// regardless of User-Agent. There's no header tweak that reliably gets
// through this from a server-side fetch, and a headless-browser workaround
// would be a fragile, ToS-adjacent arms race, not a real fix. The one
// honest fix is telling the user immediately which site did this and that
// pasting the description is the reliable path, instead of a generic
// "couldn't import" message that reads like Bloom's own bug.
export function knownBlockingSiteName(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  if (host === "indeed.com" || host.endsWith(".indeed.com")) return "Indeed";
  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return "LinkedIn";
  if (host === "glassdoor.com" || host.endsWith(".glassdoor.com")) return "Glassdoor";
  return null;
}

export async function fetchJobSource(jobUrl: string | undefined, manualJobDescription: string | undefined) {
  let fetchedText = "";
  let importStatus: "success" | "manual_fallback" = "success";
  let source: "url" | "manual" | "url_plus_manual" = "manual";

  if (jobUrl) {
    try {
      const response = await fetch(jobUrl, {
        headers: {
          "User-Agent": "BloomBot/1.0 (+https://bloomcircle.vercel.app)",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      });
      if (!response.ok) throw new Error(`fetch failed: ${response.status}`);
      const html = await response.text();
      const text = htmlToText(html).slice(0, 24000);
      const metaTitle = matchMeta(html, "og:title") ?? matchMeta(html, "twitter:title");
      const metaDescription = matchMeta(html, "description") ?? matchMeta(html, "og:description");
      const pageTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
      fetchedText = normalizeWhitespace(
        [metaTitle, pageTitle, metaDescription, text]
          .filter(Boolean)
          .join("\n\n")
      );
      source = manualJobDescription ? "url_plus_manual" : "url";
    } catch {
      if (!manualJobDescription) {
        const blockingSite = knownBlockingSiteName(jobUrl);
        throw new AppError(
          blockingSite
            ? `${blockingSite} blocks automated imports, so Bloom can't fetch this link directly. Paste the job description below and run the analysis again.`
            : "We couldn't import that URL. Paste the job description to continue.",
          422,
          "validation_error",
        );
      }
      importStatus = "manual_fallback";
      source = "manual";
    }
  }

  const combined = normalizeWhitespace(
    [fetchedText, manualJobDescription?.trim() ?? ""]
      .filter(Boolean)
      .join("\n\n")
  );

  if (!combined) throw new AppError("Provide a job URL or paste the job description.", 422, "validation_error");

  return {
    rawText: combined.slice(0, 32000),
    importStatus,
    source,
    fetchedUrl: jobUrl ?? null,
  };
}

// Capped at MAX_RESUMES_PER_REQUEST so a single request's prompt size (and
// OpenAI cost) stays bounded regardless of how many resumes a user has
// saved — most recently updated resumes win.
export async function getUserResumes(adminClient: any, userId: string): Promise<ResumeRow[]> {
  const { data, error } = await adminClient
    .from("resumes")
    .select("id,name,target_role,file_path,file_name,file_type,extracted_text,extracted_text_updated_at,is_active,notes")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(MAX_RESUMES_PER_REQUEST);
  if (error) throw new AppError("Couldn't load your resumes right now.", 500, "internal_error");
  return (data ?? []) as ResumeRow[];
}

// Best-effort only: a missing/unreadable profile should never block cover
// letter generation, so this returns nulls on any error instead of
// throwing. displayName feeds the letter's sign-off (see LETTER FORMAT in
// careerCoach.ts) — null when unset, never guessed or fabricated.
export async function getApplicantProfileBasics(adminClient: any, userId: string): Promise<{ careerGoal: string | null; displayName: string | null }> {
  const { data, error } = await adminClient.from("profiles").select("career_goal,display_name").eq("id", userId).single();
  if (error || !data) return { careerGoal: null, displayName: null };
  return {
    careerGoal: (data.career_goal as string | null) ?? null,
    displayName: (data.display_name as string | null)?.trim() || null,
  };
}

// Best-effort, same as getProfileCareerGoal — a missing settings row (or a
// user who hasn't set these yet) must never block analysis. Unset fields
// come back null, which the prompt is instructed to treat as "not
// specified," never as an automatic rejection.
export async function getCandidatePreferences(adminClient: any, userId: string): Promise<CandidatePreferences> {
  const { data } = await adminClient
    .from("settings")
    .select("relocation_preference,travel_preference,work_arrangement_preference")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    relocationPreference: data?.relocation_preference ?? null,
    travelPreference: data?.travel_preference ?? null,
    workArrangementPreference: data?.work_arrangement_preference ?? null,
  };
}

// Best-effort, same pattern — feeds scoringDimensions.careerDirectionFit
// (see CAREER DIRECTION FIT in careerCoach.ts). Empty/missing on both
// fields means the candidate hasn't stated a direction; the prompt is
// instructed to return careerDirectionFit null in that case, never a
// guessed low score.
export async function getCandidateCareerDirection(adminClient: any, userId: string): Promise<CandidateCareerDirection> {
  const { data } = await adminClient.from("profiles").select("career_goal,primary_job_titles").eq("id", userId).maybeSingle();
  return {
    careerGoal: (data?.career_goal as string | null) ?? null,
    targetJobTitles: (data?.primary_job_titles as string[] | null) ?? [],
  };
}

// Best-effort, same pattern as getCandidatePreferences/getCandidateCareer
// Direction — a missing/unreadable row must never block analysis, so this
// returns an empty array on error rather than throwing.
export async function getConfirmedHardRequirementFacts(adminClient: any, userId: string): Promise<ConfirmedHardRequirementFact[]> {
  const { data, error } = await adminClient
    .from("candidate_hard_requirement_facts")
    .select("requirement_key,label,answer,detail")
    .eq("user_id", userId);
  if (error || !data) return [];
  return (data as Array<{ requirement_key: string; label: string; answer: "yes" | "no" | "partial"; detail: string | null }>).map((row) => ({
    requirementKey: row.requirement_key,
    label: row.label,
    answer: row.answer,
    detail: row.detail,
  }));
}

export async function getJobForUser(adminClient: any, userId: string, jobId: string): Promise<JobRow> {
  const { data, error } = await adminClient
    .from("jobs")
    .select(
      "id,user_id,company,title,location,salary,work_arrangement,job_url,job_description,deadline,resume_id,ai_extracted_data,verdict,fit_score,verdict_source",
    )
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new AppError("Job not found.", 404, "not_found");
  return data as JobRow;
}

/** Logs request metadata (model, action, latency, outcome) without exposing private content. */
function logAiMeta(meta: {
  model: string;
  action: string;
  latencyMs: number;
  success: boolean;
  attempt: number;
  inputTokens?: number;
  outputTokens?: number;
}) {
  console.log(
    JSON.stringify({
      event: "ai_request",
      model: meta.model,
      action: meta.action,
      latency_ms: meta.latencyMs,
      success: meta.success,
      attempt: meta.attempt,
      input_tokens: meta.inputTokens ?? null,
      output_tokens: meta.outputTokens ?? null,
    }),
  );
}

async function createOpenAIResponse(
  client: ReturnType<typeof getOpenAIClient>,
  body: Record<string, unknown>,
  options: { timeoutMs?: number; action?: string } = {},
) {
  const { timeoutMs = ANALYSIS_TIMEOUT_MS, action = "openai_request" } = options;
  const model = typeof body.model === "string" ? body.model : "unknown";
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS[attempt - 1] ?? 2_000));
    }

    const start = Date.now();
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${client.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (fetchError) {
      // Network-level failure (timeout, DNS, etc.) — always retryable.
      logAiMeta({ model, action, latencyMs: Date.now() - start, success: false, attempt });
      lastError = fetchError;
      continue;
    }

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      // Never forward the raw upstream error body to the browser — it can
      // contain implementation details. Log server-side only.
      console.error("OpenAI request failed", response.status, errorText || response.statusText);
      logAiMeta({ model, action, latencyMs, success: false, attempt });

      // 4xx errors (auth, quota, bad request) are not transient — do not retry.
      if (response.status < 500) {
        if (response.status === 429) {
          throw new AppError("AI quota reached. Please try again later.", 429, "rate_limited");
        }
        throw new AppError("The AI service is temporarily unavailable. Please try again in a moment.", 502, "upstream_error");
      }

      lastError = new AppError("The AI service is temporarily unavailable. Please try again in a moment.", 502, "upstream_error");
      continue;
    }

    const json = await response.json();
    const inputTokens = json?.usage?.input_tokens as number | undefined;
    const outputTokens = json?.usage?.output_tokens as number | undefined;
    logAiMeta({ model, action, latencyMs, success: true, attempt, inputTokens, outputTokens });
    return json;
  }

  throw lastError ?? new AppError("The AI service is temporarily unavailable. Please try again in a moment.", 502, "upstream_error");
}

function extractResponseText(response: { output_text?: string; output?: Array<Record<string, unknown>> }): string {
  if (typeof response.output_text === "string" && response.output_text) return response.output_text;
  for (const item of response.output ?? []) {
    if ("content" in item && Array.isArray(item.content)) {
      const textItem = item.content.find((content) => typeof content === "object" && content !== null && "type" in content && content.type === "output_text");
      if (textItem && typeof textItem === "object" && textItem !== null && "text" in textItem && typeof textItem.text === "string") {
        return textItem.text;
      }
    }
  }
  return "";
}

export async function extractResumeText(client: ReturnType<typeof getOpenAIClient>, adminClient: any, resume: ResumeRow): Promise<string | null> {
  if (resume.extracted_text?.trim()) return resume.extracted_text.trim();
  if (!resume.file_path) return null;

  const { data: signed, error } = await adminClient.storage.from("resumes").createSignedUrl(resume.file_path, 60 * 10);
  if (error || !signed?.signedUrl) throw new AppError(`Couldn't access ${resume.name} for analysis.`, 500, "internal_error");

  const response = await createOpenAIResponse(client, {
    model: EXTRACTION_MODEL,
    reasoning: { effort: "low" },
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              "Extract the plain text from this resume. Return only the resume text with headings and bullets preserved when possible. Do not summarize, infer, or add content.",
          },
          {
            type: "input_file",
            file_url: signed.signedUrl,
          },
        ],
      },
    ],
  }, { timeoutMs: EXTRACTION_TIMEOUT_MS, action: "extract_resume_text" });

  const extractedText = normalizeWhitespace(extractResponseText(response)).slice(0, 24000);
  if (!extractedText) return null;

  const { error: updateError } = await adminClient
    .from("resumes")
    .update({
      extracted_text: extractedText,
      extracted_text_updated_at: new Date().toISOString(),
    })
    .eq("id", resume.id);
  if (updateError) throw new AppError("Couldn't cache extracted resume text.", 500, "internal_error");

  return extractedText;
}

const dealBreakerJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "status", "requirementKey"],
  properties: {
    label: { type: "string" },
    status: { type: "string", enum: ["confirmed", "possible", "insufficient_information"] },
    // See requirementKey in schemas.ts and HARD REQUIREMENTS in
    // careerCoach.ts — a stable snake_case category slug, not the exact
    // wording of this posting's requirement.
    requirementKey: { type: "string" },
  },
} as const;

const logisticsConsiderationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "detail", "preferenceMatch"],
  properties: {
    label: { type: "string" },
    detail: { type: "string" },
    preferenceMatch: { type: "string", enum: ["aligned", "conflict", "unspecified"] },
  },
} as const;

const companyLegitimacyJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["riskLevel", "redFlags", "note"],
  properties: {
    riskLevel: { type: "string", enum: ["none", "low", "medium", "high"] },
    redFlags: { type: "array", items: { type: "string" } },
    note: { type: "string" },
  },
} as const;

const jobExtractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "company",
    "jobTitle",
    "location",
    "salary",
    "employmentType",
    "workArrangement",
    "requiredQualifications",
    "preferredQualifications",
    "requiredSkills",
    "preferredSkills",
    "responsibilities",
    "educationRequirements",
    "experienceRequirements",
    "certifications",
    "dealBreakers",
    "logisticsConsiderations",
    "companyLegitimacy",
    "applicationDeadline",
    "rawJobText",
  ],
  properties: {
    company: { type: ["string", "null"] },
    jobTitle: { type: ["string", "null"] },
    location: { type: ["string", "null"] },
    salary: { type: ["string", "null"] },
    employmentType: { type: ["string", "null"] },
    workArrangement: { type: ["string", "null"], enum: ["remote", "hybrid", "onsite", null] },
    requiredQualifications: { type: "array", items: { type: "string" } },
    preferredQualifications: { type: "array", items: { type: "string" } },
    requiredSkills: { type: "array", items: { type: "string" } },
    preferredSkills: { type: "array", items: { type: "string" } },
    responsibilities: { type: "array", items: { type: "string" } },
    educationRequirements: { type: "array", items: { type: "string" } },
    experienceRequirements: { type: "array", items: { type: "string" } },
    certifications: { type: "array", items: { type: "string" } },
    dealBreakers: { type: "array", items: dealBreakerJsonSchema },
    logisticsConsiderations: { type: "array", items: logisticsConsiderationJsonSchema },
    companyLegitimacy: companyLegitimacyJsonSchema,
    applicationDeadline: { type: ["string", "null"] },
    rawJobText: { type: "string" },
  },
} as const;

const scoringDimensionsJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "qualificationFit",
    "transferableSkillsFit",
    "careerDirectionFit",
    "experienceSeniorityFit",
    "locationWorkArrangementFit",
    "legitimacyConfidence",
  ],
  properties: {
    qualificationFit: { type: ["number", "null"], minimum: 0, maximum: 10 },
    transferableSkillsFit: { type: ["number", "null"], minimum: 0, maximum: 10 },
    careerDirectionFit: { type: ["number", "null"], minimum: 0, maximum: 10 },
    experienceSeniorityFit: { type: ["number", "null"], minimum: 0, maximum: 10 },
    locationWorkArrangementFit: { type: ["number", "null"], minimum: 0, maximum: 10 },
    // The model's own text-only estimate — see the comment on
    // scoringDimensionsSchema in schemas.ts for why this can still be
    // overridden downward after the fact.
    legitimacyConfidence: { type: ["number", "null"], minimum: 0, maximum: 10 },
  },
} as const;

const analysisResultJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "opportunityAssessment",
    "candidateFit",
    "scoringDimensions",
    "careerDirectionNote",
    "gapSeverity",
    "recommendationPriority",
    "applicationRecommendation",
    "shouldApply",
    "verdict",
    "nextStep",
  ],
  properties: {
    opportunityAssessment: { type: "string", enum: ["promising", "neutral", "risky", "ineligible"] },
    candidateFit: {
      type: "object",
      additionalProperties: false,
      required: [
        "fitScore",
        "confidence",
        "explanation",
        "strongMatches",
        "transferableStrengths",
        "criticalGaps",
        "preferredGaps",
        "unknowns",
      ],
      properties: {
        fitScore: { type: ["number", "null"], minimum: 0, maximum: 10 },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        explanation: { type: "string" },
        strongMatches: { type: "array", items: { type: "string" } },
        transferableStrengths: { type: "array", items: { type: "string" } },
        criticalGaps: { type: "array", items: { type: "string" } },
        preferredGaps: { type: "array", items: { type: "string" } },
        unknowns: { type: "array", items: { type: "string" } },
      },
    },
    scoringDimensions: scoringDimensionsJsonSchema,
    careerDirectionNote: { type: "string" },
    gapSeverity: { type: "string", enum: ["none", "minor", "moderate", "major", "hard"] },
    recommendationPriority: { type: "string", enum: ["high", "normal", "backup"] },
    applicationRecommendation: { type: "string", enum: ["apply_now", "tailor_first", "consider", "skip", "upload_resume_first"] },
    shouldApply: { type: "string" },
    // Tighter than the DB/zod verdict enum on purpose: excellent_match and
    // high_risk stay valid for old rows and manual selection (see
    // schemas.ts), but the model itself only chooses among these six —
    // see VERDICT RULES in careerCoach.ts. stretch_opportunity ("Stretch")
    // is active again as the tier between consider and not_recommended.
    verdict: {
      type: "string",
      enum: ["strong_match", "worth_applying", "consider", "stretch_opportunity", "not_recommended", "not_yet_assessed"],
    },
    nextStep: { type: "string" },
  },
} as const;

const resumeRankingJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["resumeId", "resumeName", "compatibilityScore", "strengths", "gaps", "recommendationReason"],
  properties: {
    resumeId: { type: "string" },
    resumeName: { type: "string" },
    compatibilityScore: { type: "integer", minimum: 0, maximum: 100 },
    strengths: { type: "array", items: { type: "string" } },
    gaps: { type: "array", items: { type: "string" } },
    recommendationReason: { type: "string" },
  },
} as const;

const resumeSuggestionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "suggestion", "reason"],
  properties: {
    type: { type: "string", enum: ["safe_wording", "reorder", "confirm_with_user", "genuine_gap"] },
    suggestion: { type: "string" },
    reason: { type: "string" },
  },
} as const;

// What we ask the model for. importStatus/source/fetchedUrl/promptVersion
// are NOT requested here — those are computed by us (from jobSource and
// CAREER_COACH_PROMPT_VERSION) and merged in after parsing, not asked of
// the model.
const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["jobExtraction", "analysis", "resumeRanking", "recommendedResumeId", "resumeSuggestions"],
  properties: {
    jobExtraction: jobExtractionJsonSchema,
    analysis: analysisResultJsonSchema,
    resumeRanking: { type: "array", items: resumeRankingJsonSchema },
    recommendedResumeId: { type: ["string", "null"] },
    resumeSuggestions: { type: "array", items: resumeSuggestionJsonSchema },
  },
} as const;

export async function analyzeJobAndResumes(
  client: ReturnType<typeof getOpenAIClient>,
  jobSource: { rawText: string; importStatus: "success" | "manual_fallback"; source: "url" | "manual" | "url_plus_manual"; fetchedUrl: string | null },
  resumes: Array<{ id: string; name: string; target_role: string | null; extracted_text: string }>,
  candidateEvidence: CandidateEvidenceContext,
  candidatePreferences: CandidatePreferences,
  candidateCareerDirection: CandidateCareerDirection,
  confirmedFacts: ConfirmedHardRequirementFact[] = [],
) {
  const resumePayload = resumes.map((resume) => ({
    resume_id: resume.id,
    resume_name: resume.name,
    target_role: resume.target_role,
    extracted_text: resume.extracted_text.slice(0, 12000),
  }));

  const systemInput = [
    {
      role: "developer",
      content: [{ type: "input_text", text: buildAnalysisPrompt() }],
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: JSON.stringify(
            {
              job_source: jobSource,
              candidate_evidence: {
                resume_evidence_available: candidateEvidence.hasResumeEvidence,
                profile_evidence_available: candidateEvidence.hasProfileEvidence,
              },
              // Null in any of these three means the candidate hasn't said
              // — see CANDIDATE PREFERENCES in the prompt: unspecified must
              // be treated as "flag it as a consideration," never a
              // rejection. Only an explicit stated preference (e.g.
              // remote_only, not_open) may justify a "conflict" match.
              candidate_preferences: {
                relocation: candidatePreferences.relocationPreference,
                travel: candidatePreferences.travelPreference,
                work_arrangement: candidatePreferences.workArrangementPreference,
              },
              // Empty/null means the candidate hasn't stated a direction —
              // see CAREER DIRECTION FIT: careerDirectionFit must be null,
              // never a guessed low score, when this is empty.
              candidate_career_direction: {
                career_goal: candidateCareerDirection.careerGoal,
                target_job_titles: candidateCareerDirection.targetJobTitles,
              },
              // Answers the candidate has already explicitly confirmed to
              // hard-requirement questions raised by a past analysis (see
              // CONFIRMED CANDIDATE FACTS in the prompt) — ground truth,
              // not résumé-derived evidence. Empty array means nothing
              // has been confirmed yet.
              confirmed_candidate_facts: confirmedFacts.map((fact) => ({
                requirement_key: fact.requirementKey,
                label: fact.label,
                answer: fact.answer,
                detail: fact.detail,
              })),
              resumes: resumePayload,
            },
            null,
            2,
          ),
        },
      ],
    },
  ];

  const modelParams = {
    model: ANALYSIS_MODEL,
    reasoning: { effort: "medium" },
    text: {
      format: {
        type: "json_schema",
        name: "bloom_career_coach_analysis",
        strict: true,
        schema: analysisSchema,
      },
    },
  };

  const response = await createOpenAIResponse(
    client,
    { ...modelParams, input: systemInput },
    { timeoutMs: ANALYSIS_TIMEOUT_MS, action: "analyze_job" },
  );

  const rawText = extractResponseText(response);

  function mergeWithMeta(parsed: unknown) {
    const p = parsed as Record<string, unknown>;
    const response = analysisResponseSchema.parse({
      ...p,
      importStatus: jobSource.importStatus,
      source: jobSource.source,
      fetchedUrl: jobSource.fetchedUrl,
      promptVersion: CAREER_COACH_PROMPT_VERSION,
    });
    return normalizeAndValidateAnalysis(response, candidateEvidence);
  }

  try {
    return mergeWithMeta(JSON.parse(rawText));
  } catch (firstError) {
    // Log the validation failure without including résumé or job content.
    const errorSummary =
      firstError instanceof ZodError
        ? firstError.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
        : firstError instanceof Error
        ? firstError.message
        : "Invalid JSON or unexpected structure";
    console.error("Analysis validation failed on first attempt:", errorSummary);

    // Controlled repair: re-send the conversation with the bad output and a
    // targeted correction instruction. The repair message never includes
    // résumé text — only the model's own prior output and what was wrong.
    const repairInput = [
      ...systemInput,
      {
        role: "assistant",
        content: [{ type: "output_text", text: rawText }],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `The previous response failed schema validation. Issues: ${errorSummary}. Return a corrected JSON object that fixes only the invalid fields while keeping all valid data unchanged.`,
          },
        ],
      },
    ];

    const repairResponse = await createOpenAIResponse(
      client,
      { ...modelParams, input: repairInput },
      { timeoutMs: ANALYSIS_TIMEOUT_MS, action: "analyze_job_repair" },
    );

    // If repair also fails, the ZodError propagates — errorResponse handles it
    // as a validation_error and never saves malformed output.
    return mergeWithMeta(JSON.parse(extractResponseText(repairResponse)));
  }
}

const coverLetterSchema = {
  type: "object",
  additionalProperties: false,
  required: ["cover_letter", "resume_id", "resume_name"],
  properties: {
    cover_letter: { type: "string" },
    resume_id: { type: ["string", "null"] },
    resume_name: { type: ["string", "null"] },
  },
} as const;

export async function generateCoverLetterText(
  client: ReturnType<typeof getOpenAIClient>,
  params: {
    job: JobRow;
    selectedResume: { id: string; name: string; extractedText: string } | null;
    analysis: unknown;
    rawJobText: string;
    careerGoal: string | null;
    // The applicant's own name for the sign-off — see LETTER FORMAT in
    // careerCoach.ts. Null when the profile has no display name set; the
    // prompt is instructed to fall back to an editable placeholder rather
    // than invent one.
    applicantName: string | null;
  },
) {
  // Computed here, not left to the model, so the date line is always
  // today's actual date rather than something the model could get wrong
  // or omit — see LETTER FORMAT in careerCoach.ts.
  const today = new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date());

  const response = await createOpenAIResponse(client, {
    model: COVER_LETTER_MODEL,
    reasoning: { effort: "low" },
    text: {
      format: {
        type: "json_schema",
        name: "bloom_cover_letter",
        strict: true,
        schema: coverLetterSchema,
      },
    },
    input: [
      {
        role: "developer",
        content: [{ type: "input_text", text: buildCoverLetterPrompt() }],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(
              {
                job: {
                  company: params.job.company,
                  title: params.job.title,
                  location: params.job.location,
                },
                selected_resume: params.selectedResume
                  ? {
                      resume_id: params.selectedResume.id,
                      resume_name: params.selectedResume.name,
                      extracted_text: params.selectedResume.extractedText.slice(0, 12000),
                    }
                  : null,
                analysis: params.analysis,
                raw_job_text: params.rawJobText.slice(0, 18000),
                applicant_career_goal: params.careerGoal,
                applicant_name: params.applicantName,
                today,
              },
              null,
              2,
            ),
          },
        ],
      },
    ],
  }, { timeoutMs: COVER_LETTER_TIMEOUT_MS, action: "generate_cover_letter" });

  return coverLetterResponseSchema.parse(JSON.parse(extractResponseText(response)));
}

const resumeScoreDimensionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "description"],
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    description: { type: "string" },
  },
} as const;

const resumeFixJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "stretch_level", "original_text", "proposed_text", "rationale"],
  properties: {
    type: { type: "string", enum: ["safe_wording", "reorder", "confirm_with_user", "genuine_gap"] },
    stretch_level: { type: "string", enum: ["safe", "reasonable_stretch", "aggressive_stretch"] },
    original_text: { type: ["string", "null"] },
    proposed_text: { type: ["string", "null"] },
    rationale: { type: "string" },
  },
} as const;

const resumeClaimJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["text", "status", "note"],
  properties: {
    text: { type: "string" },
    status: { type: "string", enum: ["supported", "needs_evidence", "contradicted"] },
    note: { type: "string" },
  },
} as const;

const resumeClaimCategoryJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["category", "claims"],
  properties: {
    category: { type: "string", enum: ["summary", "experience", "projects", "education", "skills"] },
    claims: { type: "array", items: resumeClaimJsonSchema },
  },
} as const;

const tailorResumeSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "resume_id",
    "resume_name",
    "overall_score",
    "job_match",
    "ats_readability",
    "evidence_strength",
    "truthfulness",
    "covered_keywords",
    "weak_keywords",
    "missing_keywords",
    "tailored_resume",
    "summary_of_changes",
    "suggested_fixes",
    "claim_audit",
  ],
  properties: {
    resume_id: { type: ["string", "null"] },
    resume_name: { type: ["string", "null"] },
    overall_score: { type: "integer", minimum: 0, maximum: 100 },
    job_match: resumeScoreDimensionJsonSchema,
    ats_readability: resumeScoreDimensionJsonSchema,
    evidence_strength: resumeScoreDimensionJsonSchema,
    truthfulness: resumeScoreDimensionJsonSchema,
    covered_keywords: { type: "array", items: { type: "string" } },
    weak_keywords: { type: "array", items: { type: "string" } },
    missing_keywords: { type: "array", items: { type: "string" } },
    tailored_resume: { type: "string" },
    summary_of_changes: { type: "array", items: { type: "string" } },
    suggested_fixes: { type: "array", items: resumeFixJsonSchema },
    claim_audit: { type: "array", items: resumeClaimCategoryJsonSchema },
  },
} as const;

export async function generateTailoredResumeText(
  client: ReturnType<typeof getOpenAIClient>,
  params: {
    job: JobRow;
    selectedResume: { id: string; name: string; extractedText: string };
    rawJobText: string;
    // See RESCORE MODE in careerCoach.ts — when present, the model
    // re-scores/re-audits this exact text instead of doing a fresh
    // rewrite from selectedResume.extractedText.
    currentDraftText?: string;
  },
) {
  const response = await createOpenAIResponse(client, {
    model: TAILOR_RESUME_MODEL,
    reasoning: { effort: "medium" },
    text: {
      format: {
        type: "json_schema",
        name: "bloom_tailored_resume",
        strict: true,
        schema: tailorResumeSchema,
      },
    },
    input: [
      {
        role: "developer",
        content: [{ type: "input_text", text: buildTailorResumePrompt() }],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(
              {
                job: {
                  company: params.job.company,
                  title: params.job.title,
                  location: params.job.location,
                },
                selected_resume: {
                  resume_id: params.selectedResume.id,
                  resume_name: params.selectedResume.name,
                  extracted_text: params.selectedResume.extractedText.slice(0, 12000),
                },
                raw_job_text: params.rawJobText.slice(0, 18000),
                current_draft_text: params.currentDraftText?.slice(0, 12000) ?? null,
              },
              null,
              2,
            ),
          },
        ],
      },
    ],
  }, { timeoutMs: TAILOR_RESUME_TIMEOUT_MS, action: "tailor_resume" });

  return tailorResumeResponseSchema.parse(JSON.parse(extractResponseText(response)));
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  if (error instanceof ZodError) {
    return { status: 400, body: { error: "Invalid request or model response.", code: "validation_error", details: error.flatten() } };
  }
  console.error(error);
  return { status: 500, body: { error: "Something went wrong while running the AI workflow.", code: "internal_error" } };
}
