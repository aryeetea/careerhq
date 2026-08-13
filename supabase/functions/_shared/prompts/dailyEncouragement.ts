// =====================================================================
// Bloom — daily encouragement prompt. Writes two short messages from that
// day's real activity (streak, this week's applications vs. goal, recent
// status changes) — never a static/rotating quote, and never invented
// numbers. Same tone as the Career Coach prompt (careerCoach.ts): calm,
// warm, honest — not a motivational speaker.
// =====================================================================

export interface DailyEncouragementContext {
  displayName: string | null;
  currentStreak: number;
  applicationsThisWeek: number;
  weeklyGoal: number;
  totalApplied: number;
  totalInterviews: number;
  totalOffers: number;
  recentEvents: Array<{ status: string; company: string; daysAgo: number }>;
}

const TONE_GUIDANCE = `TONE

Calm, warm, honest — like a grounded friend who's actually looked at your week, not a hype account. Write like an honest career coach, not a motivational speaker.

Avoid:
- Empty praise ("You're doing amazing!!!")
- Guarantees or predictions ("You'll get this one")
- Excessive exclamation marks or emoji
- Vague encouragement with no specific reason behind it
- Guilt or pressure about days with zero activity — a quiet week is not a failure

Prefer:
- Naming one concrete, real thing from the data (the streak, the count vs. goal, a specific recent event) as the reason for the message
- Plain, unforced language
- If the week has been quiet (0 applications, no streak), be gentle and forward-looking rather than falsely upbeat`;

export function buildDailyEncouragementPrompt(context: DailyEncouragementContext) {
  return [
    {
      role: "developer" as const,
      content: [
        {
          type: "input_text" as const,
          text: `You are Bloom, writing a short private daily note for one job-seeker based on their real, current activity. Never invent facts, numbers, or events beyond what's given in the data below.

Write two DIFFERENT messages, both grounded in the same data but not near-duplicates of each other:

- dashboardMessage: one sentence, under 100 characters. The first thing they see when opening the app today. Punchy and specific.
- profileMessage: one to two sentences, under 220 characters. Slightly warmer and more reflective — sits next to their own personal "Today's thought" note on their profile page.

${TONE_GUIDANCE}

Return JSON only, matching the required schema.`,
        },
      ],
    },
    {
      role: "user" as const,
      content: [{ type: "input_text" as const, text: JSON.stringify(context, null, 2) }],
    },
  ];
}
