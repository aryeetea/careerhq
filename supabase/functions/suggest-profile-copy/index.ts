import { corsHeaders, json } from "../_shared/cors.ts";
import { suggestProfileCopyRequestSchema, suggestProfileCopyResponseSchema } from "../_shared/schemas.ts";
import {
  AppError,
  enforceRateLimit,
  errorResponse,
  extractResumeText,
  getOpenAIClient,
  requireUser,
  type ResumeRow,
} from "../_shared/utils.ts";

const MODEL = "gpt-5.6-terra";

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["field", "suggestion", "reason"],
  properties: {
    field: { type: "string", enum: ["bio", "career_status"] },
    suggestion: { type: "string" },
    reason: { type: "string" },
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

async function createSuggestion(openai: ReturnType<typeof getOpenAIClient>, payload: Record<string, unknown>) {
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
          name: "bloom_profile_copy_suggestion",
          strict: true,
          schema: RESPONSE_SCHEMA,
        },
      },
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text:
                "You are Bloom, a calm career coach. Write warm, mature, grounded profile copy. Never invent facts. Use only the evidence provided. Keep suggestions natural and human, never corporate. For field='bio', write 1-2 sentences max, under 160 characters, describing who the person is in a stable way. For field='career_status', write 1 sentence max, under 80 characters, describing their current job-search focus for the next few weeks. Return JSON only.",
            },
          ],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: JSON.stringify(payload, null, 2) }],
        },
      ],
      max_output_tokens: 220,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    // Log the real upstream failure server-side only — never forward OpenAI's
    // raw error body to the browser.
    console.error("OpenAI profile copy suggestion failed", response.status, errorText || response.statusText);
    if (response.status === 429) {
      throw new AppError("You've requested several suggestions. Try again in a moment.", 429, "rate_limited");
    }
    throw new AppError("AI suggestions aren't available right now. Please try again shortly.", 502, "upstream_error");
  }

  let parsedText: unknown;
  try {
    parsedText = JSON.parse(extractResponseText(await response.json()));
  } catch (parseError) {
    console.error("Couldn't parse OpenAI profile copy response as JSON", parseError);
    throw new AppError("We couldn't create a suggestion from the current profile information.", 502, "validation_error");
  }
  return suggestProfileCopyResponseSchema.parse(parsedText);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user, adminClient } = await requireUser(request.headers.get("Authorization"));
    await enforceRateLimit(adminClient, user.id, "suggest_profile_copy", 60 * 60 * 1000, 12);

    const payload = suggestProfileCopyRequestSchema.parse(await request.json());
    const openai = getOpenAIClient();

    const [{ data: profile }, { data: goals }, { data: resumes }] = await Promise.all([
      adminClient
        .from("profiles")
        .select("display_name,bio,career_goal,career_status,skills,primary_job_titles,preferred_locations,status_message")
        .eq("id", user.id)
        .single(),
      adminClient
        .from("goals")
        .select("name,description,unit,target_count")
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(5),
      adminClient
        .from("resumes")
        .select("id,name,target_role,file_path,file_name,file_type,extracted_text,extracted_text_updated_at,is_active,notes")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(3),
    ]);

    const profileRow = (profile ?? null) as Record<string, unknown> | null;
    const goalRows = (goals ?? []) as Array<Record<string, unknown>>;
    const resumeRows = (resumes ?? []) as ResumeRow[];
    const hasContext = Boolean(
      profileRow?.bio ||
        profileRow?.career_goal ||
        profileRow?.career_status ||
        (Array.isArray(profileRow?.skills) && (profileRow!.skills as unknown[]).length > 0) ||
        goalRows.length > 0 ||
        resumeRows.some((resume) => Boolean(resume.extracted_text) || Boolean(resume.notes) || Boolean(resume.target_role)),
    );
    if (!hasContext) {
      throw new AppError(
        "Add a little more to your profile before asking Bloom for a suggestion.",
        422,
        "insufficient_context",
      );
    }

    const resumeEvidence = await Promise.all(
      resumeRows.map(async (resume) => {
        const extractedText = await extractResumeText(openai, adminClient, resume);
        return {
          id: resume.id,
          name: resume.name,
          target_role: resume.target_role,
          notes: resume.notes,
          extracted_text: extractedText ? extractedText.slice(0, 4000) : null,
        };
      }),
    );

    const suggestion = await createSuggestion(openai, {
      field: payload.field,
      user_profile: profile ?? null,
      goals: goals ?? [],
      resumes: resumeEvidence,
      guidance:
        payload.field === "bio"
          ? "Describe who this person is professionally in a steady, lasting way."
          : "Describe their current search focus for the next few weeks, not their identity.",
    });

    return json(suggestion);
  } catch (error) {
    const handled = errorResponse(error);
    return json(handled.body, handled.status);
  }
});
