import { corsHeaders, json } from "../_shared/cors.ts";
import { dailyEncouragementResponseSchema } from "../_shared/schemas.ts";
import { buildDailyEncouragementPrompt, type DailyEncouragementContext } from "../_shared/prompts/dailyEncouragement.ts";
import { AppError, enforceRateLimit, errorResponse, getOpenAIClient, requireUser } from "../_shared/utils.ts";

const MODEL = "gpt-5.6-terra";

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["dashboardMessage", "profileMessage"],
  properties: {
    dashboardMessage: { type: "string" },
    profileMessage: { type: "string" },
  },
} as const;

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

async function createMessages(openai: ReturnType<typeof getOpenAIClient>, context: DailyEncouragementContext) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openai.apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      reasoning: { effort: "low" },
      text: {
        format: {
          type: "json_schema",
          name: "bloom_daily_encouragement",
          strict: true,
          schema: RESPONSE_SCHEMA,
        },
      },
      input: buildDailyEncouragementPrompt(context),
      max_output_tokens: 260,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("OpenAI daily encouragement failed", response.status, errorText || response.statusText);
    if (response.status === 429) {
      throw new AppError("Bloom is a little busy right now. Try again in a moment.", 429, "rate_limited");
    }
    throw new AppError("Today's message isn't available right now. Please try again shortly.", 502, "upstream_error");
  }

  let parsedText: unknown;
  try {
    parsedText = JSON.parse(extractResponseText(await response.json()));
  } catch (parseError) {
    console.error("Couldn't parse OpenAI daily encouragement response as JSON", parseError);
    throw new AppError("Couldn't put together today's message. Please try again shortly.", 502, "validation_error");
  }
  return dailyEncouragementResponseSchema.parse(parsedText);
}

// Monday 00:00 UTC of the current week — mirrors src/lib/stats.ts'
// startOfWeek (ISO week, Monday start), which is itself matched to
// Postgres' date_trunc('week', current_date) used by sync_weekly_progress.
// Keeping this in step means "this week" in the AI's message always agrees
// with what the Dashboard shows, rather than the two silently drifting.
function startOfWeekUtc(d: Date): Date {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = start.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + diffToMonday);
  return start;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user, adminClient } = await requireUser(request.headers.get("Authorization"));
    const todayKey = new Date().toISOString().slice(0, 10);

    // Cache hit — today's pair already exists, never re-call the model.
    // Keeps repeat page loads and having Dashboard + Profile both open in
    // the same day free, and makes concurrent first-loads-of-the-day
    // race-safe (see the upsert below).
    const { data: cached } = await adminClient
      .from("daily_encouragements")
      .select("dashboard_message, profile_message")
      .eq("user_id", user.id)
      .eq("message_date", todayKey)
      .maybeSingle();
    if (cached) {
      return json({ dashboardMessage: cached.dashboard_message, profileMessage: cached.profile_message });
    }

    // A generous safety cap, not the expected call pattern (cache above
    // handles the normal one-per-day case) — guards against a runaway
    // client retry loop still reaching OpenAI every time.
    await enforceRateLimit(adminClient, user.id, "daily_encouragement", 24 * 60 * 60 * 1000, 5);

    const weekStart = startOfWeekUtc(new Date()).toISOString();

    const [{ data: profile }, applicationsThisWeekRes, totalAppliedRes, totalInterviewsRes, totalOffersRes, recentHistoryRes, streakRes] =
      await Promise.all([
        adminClient.from("profiles").select("display_name, weekly_application_goal").eq("id", user.id).single(),
        adminClient.from("jobs").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("date_applied", weekStart),
        adminClient.from("jobs").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("date_applied", "is", null),
        adminClient.from("jobs").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("status", ["interview", "final_interview"]),
        adminClient.from("jobs").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "offer"),
        adminClient
          .from("job_status_history")
          .select("job_id, to_status, changed_at")
          .eq("user_id", user.id)
          .order("changed_at", { ascending: false })
          .limit(5),
        adminClient.rpc("compute_streak", { p_user_id: user.id }),
      ]);

    const recentHistory = (recentHistoryRes.data ?? []) as Array<{ job_id: string; to_status: string; changed_at: string }>;
    const jobIds = Array.from(new Set(recentHistory.map((row) => row.job_id)));
    const { data: recentJobs } = jobIds.length
      ? await adminClient.from("jobs").select("id, company").in("id", jobIds)
      : { data: [] as Array<{ id: string; company: string }> };
    const companyById = new Map((recentJobs ?? []).map((job) => [job.id, job.company] as const));
    const now = Date.now();

    const context: DailyEncouragementContext = {
      displayName: (profile?.display_name as string | null) ?? null,
      currentStreak: typeof streakRes.data === "number" ? streakRes.data : 0,
      applicationsThisWeek: applicationsThisWeekRes.count ?? 0,
      weeklyGoal: (profile?.weekly_application_goal as number | null) ?? 0,
      totalApplied: totalAppliedRes.count ?? 0,
      totalInterviews: totalInterviewsRes.count ?? 0,
      totalOffers: totalOffersRes.count ?? 0,
      recentEvents: recentHistory.map((row) => ({
        status: row.to_status,
        company: companyById.get(row.job_id) ?? "a role",
        daysAgo: Math.max(0, Math.floor((now - new Date(row.changed_at).getTime()) / 86_400_000)),
      })),
    };

    const openai = getOpenAIClient();
    const messages = await createMessages(openai, context);

    // Upsert with do-nothing on conflict, then re-select: if two requests
    // (e.g. Dashboard and Profile both mounting on first load of the day)
    // both miss the cache above and both reach here, only the first insert
    // wins — the second returns the first's row instead of a second,
    // slightly-different AI-generated pair.
    const { error: insertError } = await adminClient
      .from("daily_encouragements")
      .upsert(
        { user_id: user.id, message_date: todayKey, dashboard_message: messages.dashboardMessage, profile_message: messages.profileMessage },
        { onConflict: "user_id,message_date", ignoreDuplicates: true },
      );
    if (insertError) {
      console.error("Failed to cache daily encouragement", insertError);
    }

    const { data: finalRow } = await adminClient
      .from("daily_encouragements")
      .select("dashboard_message, profile_message")
      .eq("user_id", user.id)
      .eq("message_date", todayKey)
      .maybeSingle();

    return json(
      finalRow
        ? { dashboardMessage: finalRow.dashboard_message, profileMessage: finalRow.profile_message }
        : messages,
    );
  } catch (error) {
    const handled = errorResponse(error);
    return json(handled.body, handled.status);
  }
});
